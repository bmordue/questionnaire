/**
 * Storage Types
 * 
 * Core type definitions for the storage layer
 */

import type { Questionnaire, QuestionnaireResponse } from '../schema.js';

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
  /** Enable compression (not implemented) */
  compressionEnabled: boolean;
  /** Enable encryption (not implemented) */
  encryptionEnabled: boolean;
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
  /** Additional metadata */
  metadata?: Record<string, any>;
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
  createSession(questionnaireId: string): Promise<string>;
  updateSession(sessionId: string, data: Partial<SessionData>): Promise<void>;
  loadSession(sessionId: string): Promise<SessionData>;
  deleteSession(sessionId: string): Promise<void>;
  listActiveSessions(): Promise<SessionData[]>;
  
  // Maintenance operations
  cleanup(): Promise<void>;
  getDataDirectory(): string;
  getConfig(): Readonly<StorageConfig>;
}
