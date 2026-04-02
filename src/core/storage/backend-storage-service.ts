/**
 * Backend Storage Service
 *
 * An implementation of StorageService that delegates all persistence to a
 * StorageBackend (local filesystem, S3, etc.) instead of using the
 * filesystem-specific QuestionnaireStore / ResponseStore / SessionStore.
 *
 * This allows the web server to transparently use S3 or any other backend
 * supported by the StorageBackend interface.
 */

import crypto from 'crypto';
import type { StorageBackend } from './backend.js';
import type {
  StorageService,
  StorageConfig,
  SessionData,
  QuestionnaireMetadataListing
} from './types.js';
import type { Questionnaire, QuestionnaireResponse } from '../schema.js';
import { validateQuestionnaire } from '../schemas/questionnaire.js';
import { validateResponse, createResponse } from '../schemas/response.js';

// Key layout within the backend:
//   questionnaires/{id}.json
//   responses/{sessionId}.json
//   sessions/{sessionId}.json

const QUESTIONNAIRE_PREFIX = 'questionnaires/';
const RESPONSE_PREFIX = 'responses/';
const SESSION_PREFIX = 'sessions/';

function questionnaireKey(id: string): string {
  return `${QUESTIONNAIRE_PREFIX}${id}.json`;
}

function responseKey(sessionId: string): string {
  return `${RESPONSE_PREFIX}${sessionId}.json`;
}

function sessionKey(sessionId: string): string {
  return `${SESSION_PREFIX}${sessionId}.json`;
}

function generateSessionId(): string {
  return `session-${Date.now()}-${crypto.randomBytes(8).toString('hex')}`;
}

/**
 * Configuration for BackendStorageService.
 * Only `backend` is required; the rest falls back to sensible defaults.
 */
export interface BackendStorageServiceConfig {
  /** The underlying storage backend to use */
  backend: StorageBackend;
  /** Whether backup / cleanup features are enabled (no-op for now) */
  backupEnabled?: boolean;
}

/**
 * StorageService implementation backed by a generic StorageBackend.
 */
export class BackendStorageService implements StorageService {
  private readonly backend: StorageBackend;
  private readonly config: StorageConfig;

  constructor(opts: BackendStorageServiceConfig) {
    this.backend = opts.backend;
    // Provide a StorageConfig so callers of getConfig() get something reasonable.
    this.config = {
      dataDirectory: '(backend-managed)',
      backupEnabled: opts.backupEnabled ?? false,
      maxBackups: 0,
      compressionEnabled: false,
      encryptionEnabled: false,
      deleteBackupsOnCompletion: false
    };
  }

  // ── Questionnaire operations ──────────────────────────────────────────────

  async saveQuestionnaire(questionnaire: Questionnaire): Promise<void> {
    const validated = validateQuestionnaire(questionnaire);
    await this.backend.write(
      questionnaireKey(validated.id),
      JSON.stringify(validated, null, 2)
    );
  }

  async loadQuestionnaire(id: string): Promise<Questionnaire> {
    const data = await this.backend.read(questionnaireKey(id));
    return validateQuestionnaire(JSON.parse(data));
  }

  async listQuestionnaires(): Promise<QuestionnaireMetadataListing[]> {
    const keys = await this.backend.list(QUESTIONNAIRE_PREFIX);
    const listings: QuestionnaireMetadataListing[] = [];

    for (const key of keys) {
      // Skip backup files
      if (key.includes('.backup.')) continue;
      try {
        const data = await this.backend.read(key);
        const q = JSON.parse(data) as Questionnaire;
        const listing: QuestionnaireMetadataListing = {
          id: q.id,
          version: q.version,
          title: q.metadata.title,
          createdAt: q.metadata.createdAt,
          updatedAt: q.metadata.updatedAt
        };
        if (q.metadata.description !== undefined) listing.description = q.metadata.description;
        if (q.metadata.tags !== undefined) listing.tags = q.metadata.tags;
        listings.push(listing);
      } catch (error) {
        console.warn(
          `BackendStorageService: skipping unreadable questionnaire entry for key "${key}"`,
          error
        );
      }
    }

    return listings;
  }

  async deleteQuestionnaire(id: string): Promise<void> {
    await this.backend.delete(questionnaireKey(id));
  }

  // ── Response operations ───────────────────────────────────────────────────

  async saveResponse(response: QuestionnaireResponse): Promise<void> {
    const validated = validateResponse(response);
    await this.backend.write(
      responseKey(validated.sessionId),
      JSON.stringify(validated, null, 2)
    );
  }

  async loadResponse(sessionId: string): Promise<QuestionnaireResponse> {
    const data = await this.backend.read(responseKey(sessionId));
    return validateResponse(JSON.parse(data));
  }

  async listResponses(questionnaireId?: string): Promise<QuestionnaireResponse[]> {
    const keys = await this.backend.list(RESPONSE_PREFIX);
    const responses: QuestionnaireResponse[] = [];

    for (const key of keys) {
      if (key.includes('.backup.')) continue;
      try {
        const data = await this.backend.read(key);
        const r = JSON.parse(data) as QuestionnaireResponse;
        if (questionnaireId && r.questionnaireId !== questionnaireId) continue;
        responses.push(r);
      } catch (error) {
        console.warn('BackendStorageService: failed to read or parse response', {
          key,
          error
        });
      }
    }

    return responses;
  }

  async deleteResponse(sessionId: string): Promise<void> {
    await this.backend.delete(responseKey(sessionId));
  }

  // ── Session operations ────────────────────────────────────────────────────

  async createSession(questionnaireId: string): Promise<string> {
    // Verify questionnaire exists (will throw if missing)
    const questionnaire = await this.loadQuestionnaire(questionnaireId);

    const sessionId = generateSessionId();

    // Create initial response
    const response = createResponse(
      questionnaire.id,
      questionnaire.version,
      sessionId,
      questionnaire.questions.length
    );

    await this.saveResponse(response);

    // Create session record
    const now = new Date().toISOString();
    const session: SessionData = {
      sessionId,
      questionnaireId,
      responseId: response.id,
      createdAt: now,
      updatedAt: now,
      status: 'active'
    };

    await this.backend.write(sessionKey(sessionId), JSON.stringify(session, null, 2));

    return sessionId;
  }

  async updateSession(sessionId: string, data: Partial<SessionData>): Promise<void> {
    const existing = await this.loadSession(sessionId);
    const updated: SessionData = {
      ...existing,
      ...data,
      sessionId, // Prevent overwriting the key
      updatedAt: data.updatedAt ?? new Date().toISOString()
    };
    await this.backend.write(sessionKey(sessionId), JSON.stringify(updated, null, 2));
  }

  async loadSession(sessionId: string): Promise<SessionData> {
    const data = await this.backend.read(sessionKey(sessionId));
    return JSON.parse(data) as SessionData;
  }

  async deleteSession(sessionId: string): Promise<void> {
    await this.backend.delete(sessionKey(sessionId));
  }

  async listActiveSessions(): Promise<SessionData[]> {
    const keys = await this.backend.list(SESSION_PREFIX);
    const sessions: SessionData[] = [];

    for (const key of keys) {
      try {
        const data = await this.backend.read(key);
        const s = JSON.parse(data) as SessionData;
        if (s.status === 'active') {
          sessions.push(s);
        }
      } catch (err) {
        console.warn(`BackendStorageService: failed to load session for key "${key}":`, err);
      }
    }

    return sessions;
  }

  // ── Maintenance operations ────────────────────────────────────────────────

  async cleanup(): Promise<void> {
    // No-op for backend-based storage (no temp files or backup rotation)
  }

  async cleanupBackups(
    _sessionId: string,
    _questionnaireId: string
  ): Promise<{ deletedCount: number; errors: string[] }> {
    // Backup management is not supported for generic backends
    return { deletedCount: 0, errors: [] };
  }

  getDataDirectory(): string {
    return this.config.dataDirectory;
  }

  getConfig(): Readonly<StorageConfig> {
    return { ...this.config };
  }
}
