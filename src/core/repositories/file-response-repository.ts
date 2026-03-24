/**
 * File Response Repository
 *
 * Implements IResponseRepository backed by the file system.
 * Wraps the existing ResponseStore with the repository interface,
 * adding optimistic locking and write-queue serialization.
 */

import path from 'path';
import crypto from 'crypto';
import type {
  IResponseRepository,
  ResponseCreateInput,
  ResponseListOptions,
} from './interfaces.js';
import { EntityNotFoundError, ConcurrencyError } from './interfaces.js';
import type { QuestionnaireResponse } from '../schemas/response.js';
import { createResponse, validateResponse } from '../schemas/response.js';
import type { StorageConfig } from '../storage/types.js';
import { FileOperations } from '../storage/file-operations.js';
import { globalWriteQueue } from '../concurrency/write-queue.js';

export class FileResponseRepository implements IResponseRepository {
  private readonly responsesDir: string;
  private readonly config: StorageConfig;

  constructor(config: StorageConfig) {
    this.config = config;
    this.responsesDir = path.join(config.dataDirectory, 'responses');
  }

  async initialize(): Promise<void> {
    await FileOperations.ensureDirectory(this.responsesDir);
  }

  private filePath(sessionId: string): string {
    return path.join(this.responsesDir, `${sessionId}.json`);
  }

  private queueKey(sessionId: string): string {
    return `response:${sessionId}`;
  }

  private generateVersion(): string {
    return crypto.randomBytes(8).toString('hex');
  }

  // ── IRepository ─────────────────────────────────────────────────────────────

  async create(data: ResponseCreateInput): Promise<QuestionnaireResponse> {
    return globalWriteQueue.enqueue(this.queueKey(data.sessionId), async () => {
      const response = createResponse(
        data.questionnaireId,
        data.questionnaireVersion,
        data.sessionId,
        data.totalQuestions,
      );

      const responseWithVersion = {
        ...response,
        _version: this.generateVersion(),
      };

      const validated = validateResponse(responseWithVersion);
      await FileOperations.atomicWrite(this.filePath(data.sessionId), JSON.stringify(validated, null, 2));
      return validated;
    });
  }

  async findById(id: string): Promise<QuestionnaireResponse | null> {
    return this.findBySessionId(id);
  }

  async findAll(): Promise<QuestionnaireResponse[]> {
    return this.list();
  }

  async list(questionnaireId?: string): Promise<QuestionnaireResponse[]> {
    const files = await FileOperations.listFiles(this.responsesDir, '.json');
    const results: QuestionnaireResponse[] = [];

    for (const file of files) {
      if (file.includes('.backup.')) continue;

      try {
        const data = await FileOperations.safeRead(path.join(this.responsesDir, file));
        const response = validateResponse(JSON.parse(data));

        if (questionnaireId && response.questionnaireId !== questionnaireId) continue;

        results.push(response);
      } catch {
        // Skip unreadable files
      }
    }

    return results;
  }

  async update(id: string, data: Partial<QuestionnaireResponse>): Promise<QuestionnaireResponse> {
    return globalWriteQueue.enqueue(this.queueKey(id), async () => {
      const existing = await this.findBySessionId(id);
      if (!existing) throw new EntityNotFoundError(`Response not found: ${id}`, 'Response', id);

      const updated = validateResponse({
        ...existing,
        ...data,
        sessionId: existing.sessionId, // immutable
        lastSavedAt: new Date().toISOString(),
      });

      await this.writeWithBackup(updated);
      return updated;
    });
  }

  async delete(id: string): Promise<void> {
    return globalWriteQueue.enqueue(this.queueKey(id), async () => {
      const fp = this.filePath(id);
      const exists = await FileOperations.exists(fp);
      if (!exists) throw new EntityNotFoundError(`Response not found: ${id}`, 'Response', id);
      await FileOperations.delete(fp);
    });
  }

  async exists(id: string): Promise<boolean> {
    return FileOperations.exists(this.filePath(id));
  }

  // ── IResponseRepository ──────────────────────────────────────────────────────

  async findBySessionId(sessionId: string): Promise<QuestionnaireResponse | null> {
    const fp = this.filePath(sessionId);
    if (!(await FileOperations.exists(fp))) return null;

    try {
      const data = await FileOperations.safeRead(fp);
      return validateResponse(JSON.parse(data));
    } catch {
      return null;
    }
  }

  async listByQuestionnaire(
    questionnaireId: string,
    options: ResponseListOptions = {},
  ): Promise<QuestionnaireResponse[]> {
    const all = await this.list(questionnaireId);

    let results = all;

    if (options.status) {
      results = results.filter(r => r.status === options.status);
    }
    if (options.completedAfter) {
      const after = new Date(options.completedAfter).getTime();
      results = results.filter(r => r.completedAt && new Date(r.completedAt).getTime() >= after);
    }
    if (options.completedBefore) {
      const before = new Date(options.completedBefore).getTime();
      results = results.filter(r => r.completedAt && new Date(r.completedAt).getTime() <= before);
    }

    const offset = options.offset ?? 0;
    const limit = options.limit;
    return results.slice(offset, limit !== undefined ? offset + limit : undefined);
  }

  async updateWithLock(
    id: string,
    data: Partial<QuestionnaireResponse>,
    expectedVersion?: string,
  ): Promise<QuestionnaireResponse> {
    return globalWriteQueue.enqueue(this.queueKey(id), async () => {
      const existing = await this.findBySessionId(id);
      if (!existing) throw new EntityNotFoundError(`Response not found: ${id}`, 'Response', id);

      // Optimistic locking: check that the version matches
      if (expectedVersion !== undefined) {
        const actualVersion = (existing as QuestionnaireResponse & { _version?: string })._version;
        if (actualVersion !== expectedVersion) {
          throw new ConcurrencyError(
            `Optimistic lock failed for response ${id}`,
            id,
            expectedVersion,
            actualVersion,
          );
        }
      }

      const updated = validateResponse({
        ...existing,
        ...data,
        sessionId: existing.sessionId,
        lastSavedAt: new Date().toISOString(),
      }) as QuestionnaireResponse & { _version?: string };

      // Stamp new version
      updated._version = this.generateVersion();

      await this.writeWithBackup(updated);
      return updated;
    });
  }

  // ── Helpers ──────────────────────────────────────────────────────────────────

  private async writeWithBackup(response: QuestionnaireResponse): Promise<void> {
    const fp = this.filePath(response.sessionId);

    if (this.config.backupEnabled) {
      const exists = await FileOperations.exists(fp);
      if (exists) {
        await FileOperations.createBackup(fp);
        await this.cleanupBackups(response.sessionId);
      }
    }

    await FileOperations.atomicWrite(fp, JSON.stringify(response, null, 2));
  }

  private async cleanupBackups(sessionId: string): Promise<void> {
    const escaped = sessionId.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const pattern = new RegExp(`^${escaped}\\.backup\\..*\\.json$`);
    await FileOperations.cleanupBackups(this.responsesDir, pattern, this.config.maxBackups);
  }

  async cleanupAllBackups(sessionId: string): Promise<number> {
    const escaped = sessionId.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const pattern = new RegExp(`^${escaped}\\.backup\\..*\\.json$`);
    return FileOperations.deleteMatchingFiles(this.responsesDir, pattern);
  }
}
