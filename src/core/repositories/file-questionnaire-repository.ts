/**
 * File Questionnaire Repository
 *
 * Implements IQuestionnaireRepository backed by the file system.
 * Wraps the existing QuestionnaireStore with the repository interface,
 * adding concurrency controls via the write queue.
 */

import path from 'path';
import type {
  IQuestionnaireRepository,
  VersionedQuestionnaire,
  QuestionnaireCreateInput,
  QuestionnaireListOptions,
} from './interfaces.js';
import { EntityNotFoundError } from './interfaces.js';
import type { StorageConfig } from '../storage/types.js';
import { FileOperations } from '../storage/file-operations.js';
import { globalWriteQueue } from '../concurrency/write-queue.js';
import { validateQuestionnaire } from '../schemas/questionnaire.js';

export class FileQuestionnaireRepository implements IQuestionnaireRepository {
  private readonly questionnairesDir: string;
  private readonly config: StorageConfig;

  constructor(config: StorageConfig) {
    this.config = config;
    this.questionnairesDir = path.join(config.dataDirectory, 'questionnaires');
  }

  async initialize(): Promise<void> {
    await FileOperations.ensureDirectory(this.questionnairesDir);
  }

  private filePath(id: string): string {
    return path.join(this.questionnairesDir, `${id}.json`);
  }

  private queueKey(id: string): string {
    return `questionnaire:${id}`;
  }

  // ── IRepository ─────────────────────────────────────────────────────────────

  async create(data: QuestionnaireCreateInput): Promise<VersionedQuestionnaire> {
    return globalWriteQueue.enqueue(this.queueKey(data.id), async () => {
      const questionnaire: VersionedQuestionnaire = {
        id: data.id,
        version: data.version,
        metadata: {
          title: data.title,
          ...(data.description !== undefined && { description: data.description }),
          ...(data.author !== undefined && { author: data.author }),
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
          ...(data.tags !== undefined && { tags: data.tags }),
        },
        questions: data.questions,
        ...(data.config !== undefined && { config: data.config }),
      };

      const validated = validateQuestionnaire(questionnaire) as VersionedQuestionnaire;
      await FileOperations.atomicWrite(this.filePath(validated.id), JSON.stringify(validated, null, 2));
      return validated;
    });
  }

  async findById(id: string): Promise<VersionedQuestionnaire | null> {
    const fp = this.filePath(id);
    const exists = await FileOperations.exists(fp);
    if (!exists) return null;

    try {
      const data = await FileOperations.safeRead(fp);
      return JSON.parse(data) as VersionedQuestionnaire;
    } catch {
      return null;
    }
  }

  async findAll(): Promise<VersionedQuestionnaire[]> {
    return this.list();
  }

  async update(id: string, data: Partial<VersionedQuestionnaire>): Promise<VersionedQuestionnaire> {
    return globalWriteQueue.enqueue(this.queueKey(id), async () => {
      const existing = await this.findById(id);
      if (!existing) throw new EntityNotFoundError(`Questionnaire not found: ${id}`, 'Questionnaire', id);

      const updated: VersionedQuestionnaire = {
        ...existing,
        ...data,
        id, // ID is immutable
        metadata: {
          ...existing.metadata,
          ...(data.metadata ?? {}),
          updatedAt: new Date().toISOString(),
        },
      };

      if (this.config.backupEnabled) {
        const fp = this.filePath(id);
        const fileExists = await FileOperations.exists(fp);
        if (fileExists) {
          await FileOperations.createBackup(fp);
          await this.cleanupBackups(id);
        }
      }

      await FileOperations.atomicWrite(this.filePath(id), JSON.stringify(updated, null, 2));
      return updated;
    });
  }

  async delete(id: string): Promise<void> {
    return globalWriteQueue.enqueue(this.queueKey(id), async () => {
      const fp = this.filePath(id);
      const exists = await FileOperations.exists(fp);
      if (!exists) throw new EntityNotFoundError(`Questionnaire not found: ${id}`, 'Questionnaire', id);
      await FileOperations.delete(fp);
    });
  }

  async exists(id: string): Promise<boolean> {
    return FileOperations.exists(this.filePath(id));
  }

  // ── IQuestionnaireRepository ─────────────────────────────────────────────────

  async getById(id: string): Promise<VersionedQuestionnaire | null> {
    return this.findById(id);
  }

  async list(options: QuestionnaireListOptions = {}): Promise<VersionedQuestionnaire[]> {
    const files = await FileOperations.listFiles(this.questionnairesDir, '.json');
    const results: VersionedQuestionnaire[] = [];

    for (const file of files) {
      if (file.includes('.backup.')) continue;

      try {
        const data = await FileOperations.safeRead(path.join(this.questionnairesDir, file));
        const q = JSON.parse(data) as VersionedQuestionnaire;

        if (options.publishedOnly && !q.publishedAt) continue;
        if (options.tags?.length && !options.tags.some(t => q.metadata.tags?.includes(t))) continue;

        results.push(q);
      } catch {
        // Skip unreadable files
      }
    }

    const offset = options.offset ?? 0;
    const limit = options.limit;

    const sliced = results.slice(offset, limit !== undefined ? offset + limit : undefined);
    return sliced;
  }

  async publish(id: string, userId: string): Promise<VersionedQuestionnaire> {
    return this.update(id, {
      publishedAt: new Date().toISOString(),
      publishedBy: userId,
    });
  }

  async unpublish(id: string): Promise<VersionedQuestionnaire> {
    return globalWriteQueue.enqueue(this.queueKey(id), async () => {
      const existing = await this.findById(id);
      if (!existing) throw new EntityNotFoundError(`Questionnaire not found: ${id}`, 'Questionnaire', id);

      const updated: VersionedQuestionnaire = { ...existing };
      delete updated.publishedAt;
      delete updated.publishedBy;
      updated.metadata = { ...existing.metadata, updatedAt: new Date().toISOString() };

      await FileOperations.atomicWrite(this.filePath(id), JSON.stringify(updated, null, 2));
      return updated;
    });
  }

  async isPublished(id: string): Promise<boolean> {
    const q = await this.findById(id);
    return q?.publishedAt !== undefined;
  }

  // ── Helpers ──────────────────────────────────────────────────────────────────

  private async cleanupBackups(id: string): Promise<void> {
    const escaped = id.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const pattern = new RegExp(`^${escaped}\\.backup\\..*\\.json$`);
    await FileOperations.cleanupBackups(this.questionnairesDir, pattern, this.config.maxBackups);
  }

  async cleanupAllBackups(id: string): Promise<number> {
    const escaped = id.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const pattern = new RegExp(`^${escaped}\\.backup\\..*\\.json$`);
    return FileOperations.deleteMatchingFiles(this.questionnairesDir, pattern);
  }
}
