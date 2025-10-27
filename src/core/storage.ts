/**
 * Storage Service
 * 
 * Main storage service that coordinates questionnaire, response, and session storage
 */

import path from 'path';
import type {
  StorageService,
  StorageConfig,
  SessionData,
  QuestionnaireMetadataListing
} from './storage/types.js';
import type { Questionnaire, QuestionnaireResponse } from './schema.js';
import { createResponse } from './schemas/response.js';
import { QuestionnaireStore } from './storage/questionnaire-store.js';
import { ResponseStore } from './storage/response-store.js';
import { SessionStore } from './storage/session-store.js';
import { FileOperations } from './storage/file-operations.js';

/**
 * Default storage configuration
 */
const DEFAULT_CONFIG: StorageConfig = {
  dataDirectory: './data',
  backupEnabled: true,
  maxBackups: 5,
  compressionEnabled: false,
  encryptionEnabled: false
};

/**
 * Main storage service implementation
 */
export class FileStorageService implements StorageService {
  private readonly config: StorageConfig;
  private readonly questionnaireStore: QuestionnaireStore;
  private readonly responseStore: ResponseStore;
  private readonly sessionStore: SessionStore;
  private initialized = false;

  constructor(config: Partial<StorageConfig> = {}) {
    this.config = { ...DEFAULT_CONFIG, ...config };
    this.questionnaireStore = new QuestionnaireStore(this.config);
    this.responseStore = new ResponseStore(this.config);
    this.sessionStore = new SessionStore(this.config);
  }

  /**
   * Initialize the storage service
   * Creates necessary directories and validates configuration
   */
  async initialize(): Promise<void> {
    if (this.initialized) {
      return;
    }

    // Create base directory structure
    await FileOperations.ensureDirectory(this.config.dataDirectory);

    // Initialize all stores
    await Promise.all([
      this.questionnaireStore.initialize(),
      this.responseStore.initialize(),
      this.sessionStore.initialize()
    ]);

    this.initialized = true;
  }

  /**
   * Ensure the storage service is initialized
   */
  private async ensureInitialized(): Promise<void> {
    if (!this.initialized) {
      await this.initialize();
    }
  }

  // Questionnaire operations

  async saveQuestionnaire(questionnaire: Questionnaire): Promise<void> {
    await this.ensureInitialized();
    await this.questionnaireStore.save(questionnaire);
  }

  async loadQuestionnaire(id: string): Promise<Questionnaire> {
    await this.ensureInitialized();
    return this.questionnaireStore.load(id);
  }

  async listQuestionnaires(): Promise<QuestionnaireMetadataListing[]> {
    await this.ensureInitialized();
    return this.questionnaireStore.list();
  }

  async deleteQuestionnaire(id: string): Promise<void> {
    await this.ensureInitialized();
    await this.questionnaireStore.delete(id);
  }

  // Response operations

  async saveResponse(response: QuestionnaireResponse): Promise<void> {
    await this.ensureInitialized();
    await this.responseStore.save(response);
  }

  async loadResponse(sessionId: string): Promise<QuestionnaireResponse> {
    await this.ensureInitialized();
    return this.responseStore.load(sessionId);
  }

  async listResponses(questionnaireId?: string): Promise<QuestionnaireResponse[]> {
    await this.ensureInitialized();
    return this.responseStore.list(questionnaireId);
  }

  async deleteResponse(sessionId: string): Promise<void> {
    await this.ensureInitialized();
    await this.responseStore.delete(sessionId);
  }

  // Session operations

  async createSession(questionnaireId: string): Promise<string> {
    await this.ensureInitialized();

    // Verify questionnaire exists
    const questionnaire = await this.questionnaireStore.load(questionnaireId);

    // Generate a single session ID to use for both session and response
    const sessionId = FileOperations.generateSessionId();
    
    // Create initial response with the session ID
    const response = createResponse(
      questionnaire.id,
      questionnaire.version,
      sessionId,
      questionnaire.questions.length
    );

    // Save response first
    await this.responseStore.save(response);

    // Create session record with the pre-generated session ID
    await this.sessionStore.create(questionnaireId, response.id, sessionId);

    return sessionId;
  }

  async updateSession(sessionId: string, data: Partial<SessionData>): Promise<void> {
    await this.ensureInitialized();
    await this.sessionStore.update(sessionId, data);
  }

  async loadSession(sessionId: string): Promise<SessionData> {
    await this.ensureInitialized();
    return this.sessionStore.load(sessionId);
  }

  async deleteSession(sessionId: string): Promise<void> {
    await this.ensureInitialized();
    await this.sessionStore.delete(sessionId);
  }

  async listActiveSessions(): Promise<SessionData[]> {
    await this.ensureInitialized();
    return this.sessionStore.listActive();
  }

  /**
   * Perform cleanup operations
   * - Remove old backup files
   * - Clean up old abandoned sessions
   */
  async cleanup(): Promise<void> {
    await this.ensureInitialized();
    await this.sessionStore.cleanup();
  }

  /**
   * Get the data directory path
   */
  getDataDirectory(): string {
    return this.config.dataDirectory;
  }

  /**
   * Get the current configuration
   */
  getConfig(): Readonly<StorageConfig> {
    return { ...this.config };
  }
}

/**
 * Create a new storage service instance
 * @param config - Optional storage configuration
 * @returns Initialized storage service
 */
export async function createStorageService(
  config?: Partial<StorageConfig>
): Promise<StorageService> {
  const service = new FileStorageService(config);
  await service.initialize();
  return service;
}
