/**
 * Questionnaire Store
 * 
 * Storage operations for questionnaire definitions
 */

import path from 'path';
import type { Questionnaire } from '../schema.js';
import { validateQuestionnaire } from '../schemas/questionnaire.js';
import type { QuestionnaireMetadataListing, StorageConfig } from './types.js';
import { FileOperations, FileOperationError } from './file-operations.js';
import { getLogger } from '../logging/index.js';

const logger = getLogger();

/**
 * Questionnaire-specific storage operations
 */
export class QuestionnaireStore {
  private readonly questionnairesDir: string;
  private readonly config: StorageConfig;

  constructor(config: StorageConfig) {
    this.config = config;
    this.questionnairesDir = path.join(config.dataDirectory, 'questionnaires');
  }

  /**
   * Initialize the questionnaires directory
   */
  async initialize(): Promise<void> {
    await FileOperations.ensureDirectory(this.questionnairesDir);
  }

  /**
   * Get the file path for a questionnaire
   */
  private getFilePath(id: string): string {
    return path.join(this.questionnairesDir, `${id}.json`);
  }

  /**
   * Save a questionnaire
   * @param questionnaire - Questionnaire to save
   */
  async save(questionnaire: Questionnaire): Promise<void> {
    // Validate questionnaire
    const validated = validateQuestionnaire(questionnaire);

    const filePath = this.getFilePath(validated.id);

    // Create backup if file exists and backups are enabled
    if (this.config.backupEnabled) {
      const exists = await FileOperations.exists(filePath);
      if (exists) {
        await FileOperations.createBackup(filePath);
        await this.cleanupBackups(validated.id);
      }
    }

    // Write questionnaire
    const data = JSON.stringify(validated, null, 2);
    await FileOperations.atomicWrite(filePath, data);
  }

  /**
   * Load a questionnaire by ID
   * @param id - Questionnaire ID
   * @returns Loaded and validated questionnaire
   */
  async load(id: string): Promise<Questionnaire> {
    const filePath = this.getFilePath(id);

    try {
      const data = await FileOperations.safeRead(filePath);
      const parsed = JSON.parse(data);
      return validateQuestionnaire(parsed);
    } catch (error) {
      if (error instanceof FileOperationError && error.cause) {
        throw error;
      }
      throw new FileOperationError(
        `Failed to load questionnaire: ${error instanceof Error ? error.message : String(error)}`,
        'load',
        filePath,
        error instanceof Error ? error : undefined
      );
    }
  }

  /**
   * List all questionnaires with metadata
   * @returns Array of questionnaire metadata
   */
  async list(): Promise<QuestionnaireMetadataListing[]> {
    const files = await FileOperations.listFiles(this.questionnairesDir, '.json');

    const metadata: QuestionnaireMetadataListing[] = [];

    for (const file of files) {
      // Skip backup files
      if (file.includes('.backup.')) {
        continue;
      }

      try {
        const filePath = path.join(this.questionnairesDir, file);
        const data = await FileOperations.safeRead(filePath);
        const questionnaire = JSON.parse(data) as Questionnaire;

        metadata.push({
          id: questionnaire.id,
          version: questionnaire.version,
          title: questionnaire.metadata.title,
          ...(questionnaire.metadata.description !== undefined && { description: questionnaire.metadata.description }),
          createdAt: questionnaire.metadata.createdAt,
          updatedAt: questionnaire.metadata.updatedAt,
          ...(questionnaire.metadata.tags !== undefined && { tags: questionnaire.metadata.tags })
        });
      } catch (error) {
        // Skip files that can't be parsed
        logger.warn(`Failed to read questionnaire file ${file}:`, error);
      }
    }

    return metadata;
  }

  /**
   * Delete a questionnaire
   * @param id - Questionnaire ID
   */
  async delete(id: string): Promise<void> {
    const filePath = this.getFilePath(id);
    await FileOperations.delete(filePath);
  }

  /**
   * Check if a questionnaire exists
   * @param id - Questionnaire ID
   * @returns True if questionnaire exists
   */
  async exists(id: string): Promise<boolean> {
    const filePath = this.getFilePath(id);
    return FileOperations.exists(filePath);
  }

  /**
   * Clean up old backup files for a questionnaire
   */
  private async cleanupBackups(id: string): Promise<void> {
    const pattern = new RegExp(`^${id}\\.backup\\..*\\.json$`);
    await FileOperations.cleanupBackups(
      this.questionnairesDir,
      pattern,
      this.config.maxBackups
    );
  }
}
