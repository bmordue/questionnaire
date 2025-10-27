/**
 * Session Store
 * 
 * Storage operations for active questionnaire sessions
 */

import path from 'path';
import type { SessionData, StorageConfig } from './types.js';
import { FileOperations, FileOperationError } from './file-operations.js';

/**
 * Session-specific storage operations
 */
export class SessionStore {
  private readonly sessionsDir: string;
  private readonly config: StorageConfig;

  constructor(config: StorageConfig) {
    this.config = config;
    this.sessionsDir = path.join(config.dataDirectory, 'sessions');
  }

  /**
   * Initialize the sessions directory
   */
  async initialize(): Promise<void> {
    await FileOperations.ensureDirectory(this.sessionsDir);
  }

  /**
   * Get the file path for a session
   */
  private getFilePath(sessionId: string): string {
    return path.join(this.sessionsDir, `${sessionId}.json`);
  }

  /**
   * Create a new session
   * @param questionnaireId - ID of the questionnaire
   * @param responseId - ID of the associated response
   * @param sessionId - Optional session ID (will be generated if not provided)
   * @returns Session ID
   */
  async create(questionnaireId: string, responseId: string, sessionId?: string): Promise<string> {
    const id = sessionId || FileOperations.generateSessionId();
    const now = new Date().toISOString();

    const sessionData: SessionData = {
      sessionId: id,
      questionnaireId,
      responseId,
      createdAt: now,
      updatedAt: now,
      status: 'active'
    };

    const filePath = this.getFilePath(id);
    const data = JSON.stringify(sessionData, null, 2);
    await FileOperations.atomicWrite(filePath, data);

    return id;
  }

  /**
   * Update an existing session
   * @param sessionId - Session ID
   * @param updates - Partial session data to update
   */
  async update(sessionId: string, updates: Partial<SessionData>): Promise<void> {
    const filePath = this.getFilePath(sessionId);

    try {
      // Load existing session
      const existing = await this.load(sessionId);

      // Merge updates
      const updated: SessionData = {
        ...existing,
        ...updates,
        sessionId, // Ensure sessionId can't be changed
        updatedAt: new Date().toISOString()
      };

      // Save updated session
      const data = JSON.stringify(updated, null, 2);
      await FileOperations.atomicWrite(filePath, data);
    } catch (error) {
      throw new FileOperationError(
        `Failed to update session: ${error instanceof Error ? error.message : String(error)}`,
        'update',
        filePath,
        error instanceof Error ? error : undefined
      );
    }
  }

  /**
   * Load a session by ID
   * @param sessionId - Session ID
   * @returns Session data
   */
  async load(sessionId: string): Promise<SessionData> {
    const filePath = this.getFilePath(sessionId);

    try {
      const data = await FileOperations.safeRead(filePath);
      const parsed = JSON.parse(data) as SessionData;
      return parsed;
    } catch (error) {
      if (error instanceof FileOperationError && error.cause) {
        throw error;
      }
      throw new FileOperationError(
        `Failed to load session: ${error instanceof Error ? error.message : String(error)}`,
        'load',
        filePath,
        error instanceof Error ? error : undefined
      );
    }
  }

  /**
   * Delete a session
   * @param sessionId - Session ID
   */
  async delete(sessionId: string): Promise<void> {
    const filePath = this.getFilePath(sessionId);
    await FileOperations.delete(filePath);
  }

  /**
   * List all active sessions
   * @returns Array of active session data
   */
  async listActive(): Promise<SessionData[]> {
    const files = await FileOperations.listFiles(this.sessionsDir, '.json');

    const sessions: SessionData[] = [];

    for (const file of files) {
      try {
        const filePath = path.join(this.sessionsDir, file);
        const data = await FileOperations.safeRead(filePath);
        const session = JSON.parse(data) as SessionData;

        if (session.status === 'active') {
          sessions.push(session);
        }
      } catch (error) {
        // Skip files that can't be parsed
        console.warn(`Failed to read session file ${file}:`, error);
      }
    }

    return sessions;
  }

  /**
   * Check if a session exists
   * @param sessionId - Session ID
   * @returns True if session exists
   */
  async exists(sessionId: string): Promise<boolean> {
    const filePath = this.getFilePath(sessionId);
    return FileOperations.exists(filePath);
  }

  /**
   * Clean up old sessions based on age or status
   * @param maxAgeMs - Maximum age in milliseconds
   */
  async cleanup(maxAgeMs: number = 7 * 24 * 60 * 60 * 1000): Promise<void> {
    const files = await FileOperations.listFiles(this.sessionsDir, '.json');
    const now = Date.now();

    for (const file of files) {
      try {
        const filePath = path.join(this.sessionsDir, file);
        const data = await FileOperations.safeRead(filePath);
        const session = JSON.parse(data) as SessionData;

        const updatedAt = new Date(session.updatedAt).getTime();
        const age = now - updatedAt;

        // Delete old abandoned sessions
        if (session.status === 'abandoned' && age > maxAgeMs) {
          await FileOperations.delete(filePath);
        }
      } catch (error) {
        // Skip files that can't be processed
        console.warn(`Failed to cleanup session file ${file}:`, error);
      }
    }
  }
}
