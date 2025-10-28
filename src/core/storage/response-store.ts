/**
 * Response Store
 * 
 * Storage operations for questionnaire responses
 */

import path from 'path';
import type { QuestionnaireResponse } from '../schema.js';
import { validateResponse } from '../schemas/response.js';
import type { StorageConfig } from './types.js';
import { FileOperations, FileOperationError } from './file-operations.js';
import { getLogger } from '../logging/index.js';

const logger = getLogger();

/**
 * Response-specific storage operations
 */
export class ResponseStore {
  private readonly responsesDir: string;
  private readonly config: StorageConfig;

  constructor(config: StorageConfig) {
    this.config = config;
    this.responsesDir = path.join(config.dataDirectory, 'responses');
  }

  /**
   * Initialize the responses directory
   */
  async initialize(): Promise<void> {
    await FileOperations.ensureDirectory(this.responsesDir);
  }

  /**
   * Get the file path for a response
   */
  private getFilePath(sessionId: string): string {
    return path.join(this.responsesDir, `${sessionId}.json`);
  }

  /**
   * Save a response
   * @param response - Response to save
   */
  async save(response: QuestionnaireResponse): Promise<void> {
    // Validate response
    const validated = validateResponse(response);

    const filePath = this.getFilePath(validated.sessionId);

    // Create backup if file exists and backups are enabled
    if (this.config.backupEnabled) {
      const exists = await FileOperations.exists(filePath);
      if (exists) {
        await FileOperations.createBackup(filePath);
        await this.cleanupBackups(validated.sessionId);
      }
    }

    // Write response
    const data = JSON.stringify(validated, null, 2);
    await FileOperations.atomicWrite(filePath, data);
  }

  /**
   * Load a response by session ID
   * @param sessionId - Session ID
   * @returns Loaded and validated response
   */
  async load(sessionId: string): Promise<QuestionnaireResponse> {
    const filePath = this.getFilePath(sessionId);

    try {
      const data = await FileOperations.safeRead(filePath);
      const parsed = JSON.parse(data);
      return validateResponse(parsed);
    } catch (error) {
      if (error instanceof FileOperationError && error.cause) {
        throw error;
      }
      throw new FileOperationError(
        `Failed to load response: ${error instanceof Error ? error.message : String(error)}`,
        'load',
        filePath,
        error instanceof Error ? error : undefined
      );
    }
  }

  /**
   * List all responses, optionally filtered by questionnaire ID
   * @param questionnaireId - Optional questionnaire ID filter
   * @returns Array of responses
   */
  async list(questionnaireId?: string): Promise<QuestionnaireResponse[]> {
    const files = await FileOperations.listFiles(this.responsesDir, '.json');

    const responses: QuestionnaireResponse[] = [];

    for (const file of files) {
      // Skip backup files
      if (file.includes('.backup.')) {
        continue;
      }

      try {
        const filePath = path.join(this.responsesDir, file);
        const data = await FileOperations.safeRead(filePath);
        const response = validateResponse(JSON.parse(data));

        // Filter by questionnaire ID if specified
        if (!questionnaireId || response.questionnaireId === questionnaireId) {
          responses.push(response);
        }
      } catch (error) {
        // Skip files that can't be parsed
        logger.warn(`Failed to read response file ${file}:`, error);
      }
    }

    return responses;
  }

  /**
   * Delete a response
   * @param sessionId - Session ID
   */
  async delete(sessionId: string): Promise<void> {
    const filePath = this.getFilePath(sessionId);
    await FileOperations.delete(filePath);
  }

  /**
   * Check if a response exists
   * @param sessionId - Session ID
   * @returns True if response exists
   */
  async exists(sessionId: string): Promise<boolean> {
    const filePath = this.getFilePath(sessionId);
    return FileOperations.exists(filePath);
  }

  /**
   * Clean up old backup files for a response
   */
  private async cleanupBackups(sessionId: string): Promise<void> {
    const pattern = new RegExp(`^${sessionId}\\.backup\\..*\\.json$`);
    await FileOperations.cleanupBackups(
      this.responsesDir,
      pattern,
      this.config.maxBackups
    );
  }
}
