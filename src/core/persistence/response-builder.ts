/**
 * Response Builder
 * 
 * Manages incremental construction and updating of questionnaire responses
 */

import type { Questionnaire, QuestionnaireResponse } from '../schema.js';
import { ResponseStatus } from '../schemas/response.js';
import type { StorageService } from '../storage/types.js';
import { getLogger } from '../logging/index.js';
import { applyAnswer, applySkip, applySkips, computeProgress } from './response-transforms.js';

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
    this.response = applyAnswer(this.response, questionId, value, metadata);
    await this.saveIncremental();
  }

  /**
   * Mark a question as skipped
   */
  async skipQuestion(questionId: string): Promise<void> {
    this.response = applySkip(this.response, questionId);
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
      const updatedAnswer = {
        questionId,
        value: newValue,
        answeredAt: new Date().toISOString(),
        duration: (existing.duration || 0) + duration,
        attempts: (existing.attempts || 0) + 1,
        skipped: false
      };
      const newAnswers = [...this.response.answers];
      newAnswers[existingIndex] = updatedAnswer;
      const updated = { ...this.response, answers: newAnswers };
      this.response = { ...updated, progress: computeProgress(updated), lastSavedAt: updatedAnswer.answeredAt };
    } else {
      // If no existing answer, create new one via applyAnswer
      this.response = applyAnswer(this.response, questionId, newValue, { duration });
    }

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
    return { ...this.response, answers: [...this.response.answers] };
  }

  /**
   * Get answers as a Map for conditional logic evaluation
   */
  getAnswersMap(): Map<string, any> {
    const map = new Map<string, any>();
    for (const answer of this.response.answers) {
      if (!answer.skipped) {
        map.set(answer.questionId, answer.value);
      }
    }
    return map;
  }

  /**
   * Mark multiple questions as skipped
   */
  async skipQuestions(questionIds: string[]): Promise<void> {
    const updated = applySkips(this.response, questionIds);
    if (updated !== this.response) {
      this.response = updated;
      await this.saveIncremental();
    }
  }

  /**
   * Refresh in-memory response from storage
   */
  async refreshFromStorage(): Promise<void> {
    try {
      const latest = await this.storage.loadResponse(this.response.sessionId);
      this.response = latest;
    } catch (error) {
      logger.warn(
        `Failed to refresh response for sessionId=${this.response.sessionId}:`,
        error
      );
    }
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
