/**
 * Response Builder
 * 
 * Manages incremental construction and updating of questionnaire responses
 */

import type { Questionnaire, QuestionnaireResponse, Answer } from '../schema.js';
import { ResponseStatus } from '../schemas/response.js';
import type { StorageService } from '../storage/types.js';
import { getLogger } from '../logging/index.js';

const logger = getLogger();

/**
 * Metadata for recording an answer
 */
export interface AnswerMetadata {
  duration?: number;
  timestamp?: string;
}

/**
 * Response builder for incremental response construction
 */
export class ResponseBuilder {
  private response: QuestionnaireResponse;
  private storage: StorageService;

  constructor(
    questionnaire: Questionnaire,
    response: QuestionnaireResponse,
    storage: StorageService
  ) {
    this.response = response;
    this.storage = storage;
  }

  /**
   * Record a new answer to a question
   */
  async recordAnswer(
    questionId: string,
    value: any,
    metadata: AnswerMetadata = {}
  ): Promise<void> {
    const now = metadata.timestamp || new Date().toISOString();
    
    // Find existing answer
    const existingIndex = this.response.answers.findIndex(a => a.questionId === questionId);
    
    if (existingIndex >= 0) {
      // Update existing answer
      const existing = this.response.answers[existingIndex]!;
      this.response.answers[existingIndex] = {
        questionId,
        value,
        answeredAt: now,
        duration: (existing.duration || 0) + (metadata.duration || 0),
        attempts: (existing.attempts || 0) + 1,
        skipped: false
      };
    } else {
      // Add new answer
      this.response.answers.push({
        questionId,
        value,
        answeredAt: now,
        duration: metadata.duration || 0,
        attempts: 1,
        skipped: false
      });
    }

    this.updateProgress();
    await this.saveIncremental();
  }

  /**
   * Mark a question as skipped
   */
  async skipQuestion(questionId: string): Promise<void> {
    const now = new Date().toISOString();
    
    // Find existing answer
    const existingIndex = this.response.answers.findIndex(a => a.questionId === questionId);
    
    if (existingIndex >= 0) {
      // Update existing to skipped
      const existing = this.response.answers[existingIndex]!;
      this.response.answers[existingIndex] = {
        questionId: existing.questionId,
        value: existing.value,
        answeredAt: now,
        duration: existing.duration,
        attempts: existing.attempts,
        skipped: true
      };
    } else {
      // Add skipped answer
      this.response.answers.push({
        questionId,
        value: null,
        answeredAt: now,
        duration: 0,
        attempts: 0,
        skipped: true
      });
    }

    this.updateProgress();
    await this.saveIncremental();
  }

  /**
   * Update an existing answer
   */
  async updateAnswer(
    questionId: string,
    newValue: any,
    duration: number = 0
  ): Promise<void> {
    const existingIndex = this.response.answers.findIndex(a => a.questionId === questionId);
    
    if (existingIndex >= 0) {
      const existing = this.response.answers[existingIndex]!;
      this.response.answers[existingIndex] = {
        questionId,
        value: newValue,
        answeredAt: new Date().toISOString(),
        duration: (existing.duration || 0) + duration,
        attempts: (existing.attempts || 0) + 1,
        skipped: false
      };
    } else {
      // If no existing answer, create new one
      await this.recordAnswer(questionId, newValue, { duration });
      return;
    }

    this.updateProgress();
    await this.saveIncremental();
  }

  /**
   * Complete the response
   */
  async complete(): Promise<QuestionnaireResponse> {
    const now = new Date().toISOString();
    
    this.response.completedAt = now;
    this.response.status = ResponseStatus.COMPLETED;
    this.response.totalDuration = this.calculateTotalDuration();
    
    // Update progress to 100%
    this.response.progress.percentComplete = 100;

    // Save final response
    await this.storage.saveResponse(this.response);
    
    // Update session status
    await this.storage.updateSession(this.response.sessionId, {
      status: 'completed'
    });

    return this.response;
  }

  /**
   * Abandon the response
   */
  async abandon(): Promise<void> {
    this.response.status = ResponseStatus.ABANDONED;
    
    await this.storage.saveResponse(this.response);
    await this.storage.updateSession(this.response.sessionId, {
      status: 'abandoned'
    });
  }

  /**
   * Get the current response
   */
  getResponse(): QuestionnaireResponse {
    return { ...this.response };
  }

  /**
   * Update progress tracking
   */
  private updateProgress(): void {
    const answeredCount = this.response.answers.filter(
      a => !a.skipped && a.value !== null
    ).length;
    
    const skippedCount = this.response.answers.filter(a => a.skipped).length;

    this.response.progress.answeredCount = answeredCount;
    this.response.progress.skippedCount = skippedCount;
    this.response.progress.percentComplete = Math.round(
      (answeredCount / this.response.progress.totalQuestions) * 100
    );

    this.response.lastSavedAt = new Date().toISOString();
  }

  /**
   * Save response incrementally
   */
  private async saveIncremental(): Promise<void> {
    try {
      await this.storage.saveResponse(this.response);
      await this.storage.updateSession(this.response.sessionId, {
        status: 'active'
      });
    } catch (error) {
      // Log but don't throw - incremental saves should not block user
      logger.warn(
        `Failed to save incremental response for sessionId=${this.response.sessionId}:`,
        error
      );
    }
  }

  /**
   * Calculate total duration from all answers
   */
  private calculateTotalDuration(): number {
    return this.response.answers.reduce(
      (total, answer) => total + (answer.duration || 0),
      0
    );
  }

  /**
   * Load state from existing response
   */
  async loadFromResponse(existingResponse: QuestionnaireResponse): Promise<void> {
    this.response = existingResponse;
  }
}
