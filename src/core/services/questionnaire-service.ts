/**
 * Questionnaire Service
 *
 * Business logic for questionnaire CRUD operations.
 * Decoupled from both TUI and HTTP layers so it can be used by both.
 */

import crypto from 'crypto';
import type { StorageService } from '../storage/types.js';
import type { Questionnaire } from '../schemas/questionnaire.js';
import { validateQuestionnaire, safeValidateQuestionnaire } from '../schemas/questionnaire.js';
import type { QuestionnaireMetadataListing } from '../storage/types.js';
import type { FileQuestionnaireRepository } from '../repositories/file-questionnaire-repository.js';
import type { VersionedQuestionnaire, QuestionnaireListOptions } from '../repositories/interfaces.js';

export interface QuestionnaireCreateData {
  id?: string;
  title: string;
  description?: string;
  author?: string;
  questions: Questionnaire['questions'];
  config?: Questionnaire['config'];
  tags?: string[];
}

export interface QuestionnaireUpdateData {
  title?: string;
  description?: string;
  author?: string;
  questions?: Questionnaire['questions'];
  config?: Questionnaire['config'];
  tags?: string[];
}

export class QuestionnaireNotFoundError extends Error {
  constructor(public readonly id: string) {
    super(`Questionnaire not found: ${id}`);
    this.name = 'QuestionnaireNotFoundError';
  }
}

export class QuestionnaireValidationError extends Error {
  constructor(
    message: string,
    public readonly details: unknown,
  ) {
    super(message);
    this.name = 'QuestionnaireValidationError';
  }
}

/**
 * Service that provides questionnaire CRUD business logic.
 * Can operate on top of either the StorageService facade or the repository layer.
 */
export class QuestionnaireService {
  constructor(private readonly storage: StorageService) {}

  /**
   * Create a new questionnaire.
   */
  async create(data: QuestionnaireCreateData): Promise<Questionnaire> {
    const now = new Date().toISOString();
    const raw = {
      id: data.id ?? `q_${crypto.randomBytes(8).toString('hex')}`,
      version: '1.0',
      metadata: {
        title: data.title,
        ...(data.description !== undefined && { description: data.description }),
        ...(data.author !== undefined && { author: data.author }),
        createdAt: now,
        updatedAt: now,
        ...(data.tags !== undefined && { tags: data.tags }),
      },
      questions: data.questions,
      ...(data.config !== undefined && { config: data.config }),
    };

    const result = safeValidateQuestionnaire(raw);
    if (!result.success) {
      throw new QuestionnaireValidationError('Invalid questionnaire data', result.error);
    }

    await this.storage.saveQuestionnaire(result.data);
    return result.data;
  }

  /**
   * Get a questionnaire by ID.
   */
  async getById(id: string): Promise<Questionnaire> {
    try {
      return await this.storage.loadQuestionnaire(id);
    } catch {
      throw new QuestionnaireNotFoundError(id);
    }
  }

  /**
   * List all questionnaires (metadata only).
   */
  async list(): Promise<QuestionnaireMetadataListing[]> {
    return this.storage.listQuestionnaires();
  }

  /**
   * Update an existing questionnaire.
   */
  async update(id: string, data: QuestionnaireUpdateData): Promise<Questionnaire> {
    const existing = await this.getById(id);
    const now = new Date().toISOString();

    const updated = {
      ...existing,
      metadata: {
        ...existing.metadata,
        ...(data.title !== undefined && { title: data.title }),
        ...(data.description !== undefined && { description: data.description }),
        ...(data.author !== undefined && { author: data.author }),
        ...(data.tags !== undefined && { tags: data.tags }),
        updatedAt: now,
      },
      ...(data.questions !== undefined && { questions: data.questions }),
      ...(data.config !== undefined && { config: data.config }),
    };

    const result = safeValidateQuestionnaire(updated);
    if (!result.success) {
      throw new QuestionnaireValidationError('Invalid questionnaire data', result.error);
    }

    await this.storage.saveQuestionnaire(result.data);
    return result.data;
  }

  /**
   * Delete a questionnaire by ID.
   */
  async delete(id: string): Promise<void> {
    try {
      await this.storage.deleteQuestionnaire(id);
    } catch {
      throw new QuestionnaireNotFoundError(id);
    }
  }

  /**
   * Check whether a questionnaire exists.
   */
  async exists(id: string): Promise<boolean> {
    try {
      await this.storage.loadQuestionnaire(id);
      return true;
    } catch {
      return false;
    }
  }

  /**
   * Validate questionnaire data without saving.
   */
  validate(data: unknown): Questionnaire {
    return validateQuestionnaire(data);
  }
}
