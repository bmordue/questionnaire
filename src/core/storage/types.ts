/**
 * Storage Types
 * 
 * Core type definitions for the storage layer
 */


import type { JsonObject } from '../schemas/json-value.js';
import type { Questionnaire, QuestionnaireResponse, QuestionnairePermission } from '../schema.js';

/**
 * Storage configuration options
 */
export interface StorageConfig {
  /** Base directory for data storage */
  dataDirectory: string;
  /** Enable automatic backups */
  backupEnabled: boolean;
  /** Maximum number of backup files to keep */
  maxBackups: number;
  /** Delete backup files when session completes */
  deleteBackupsOnCompletion: boolean;
}

/**
 * Session data structure
 */
export interface SessionData {
  /** Unique session identifier */
  sessionId: string;
  /** ID of the questionnaire being answered */
  questionnaireId: string;
  /** Current response ID */
  responseId: string;
  /** Session creation timestamp */
  createdAt: string;
  /** Last update timestamp */
  updatedAt: string;
  /** Session status */
  status: 'active' | 'completed' | 'abandoned';
  /** Authenticated user ID (if the respondent is logged in) */
  userId?: string;
  /** User agent string of the client that started the session */
  userAgent?: string;
  /** IP address of the client that started the session */
  ipAddress?: string;
  /** Expiry timestamp for session-level timeout */
  expiresAt?: string;
  /** Flow state data */
  state?: JsonObject;
  /** Additional metadata */
  metadata?: JsonObject;
}

/**
 * Questionnaire metadata for listing
 */
export interface QuestionnaireMetadataListing {
  id: string;
  version: string;
  title: string;
  description?: string;
  createdAt: string;
  updatedAt: string;
  tags?: string[];
  ownerId?: string;
  permissions?: QuestionnairePermission[];
}

/**
 * Storage service interface
 */
export interface StorageService {
  // Questionnaire operations
  saveQuestionnaire(questionnaire: Questionnaire): Promise<void>;
  loadQuestionnaire(id: string): Promise<Questionnaire>;
  listQuestionnaires(): Promise<QuestionnaireMetadataListing[]>;
  deleteQuestionnaire(id: string): Promise<void>;
  
  // Response operations
  saveResponse(response: QuestionnaireResponse): Promise<void>;
  loadResponse(sessionId: string): Promise<QuestionnaireResponse>;
  listResponses(questionnaireId?: string): Promise<QuestionnaireResponse[]>;
  deleteResponse(sessionId: string): Promise<void>;
  
  // Session operations
  createSession(questionnaireId: string, userId?: string): Promise<string>;
  updateSession(sessionId: string, data: Partial<SessionData>): Promise<void>;
  loadSession(sessionId: string): Promise<SessionData>;
  deleteSession(sessionId: string): Promise<void>;
  listActiveSessions(): Promise<SessionData[]>;

  // Maintenance operations
  cleanup(): Promise<void>;
  cleanupBackups(sessionId: string, questionnaireId: string): Promise<{ deletedCount: number; errors: string[] }>;
  getDataDirectory(): string;
  getConfig(): Readonly<StorageConfig>;
}
