/**
 * Persistence Manager
 * 
 * Manages response persistence with auto-save and session recovery
 */

import type { Questionnaire, QuestionnaireResponse } from '../schema.js';
import { createResponse } from '../schemas/response.js';
import type { StorageService } from '../storage/types.js';
import { ResponseBuilder } from './response-builder.js';
import { getLogger } from '../logging/index.js';

const logger = getLogger();

/**
 * Active response session
 */
export interface ResponseSession {
  sessionId: string;
  responseBuilder: ResponseBuilder;
  questionnaire: Questionnaire;
}

/**
 * Export format options
 */
export type ExportFormat = 'json' | 'csv';

/**
 * Persistence manager coordinates response saving and recovery
 */
export class PersistenceManager {
  private storage: StorageService;
  private autoSaveInterval: number;
  private autoSaveTimer: NodeJS.Timeout | null = null;
  private currentBuilder: ResponseBuilder | null = null;

  constructor(storage: StorageService, autoSaveIntervalMs: number = 30000) {
    this.storage = storage;
    this.autoSaveInterval = autoSaveIntervalMs;
  }

  /**
   * Start a new session or resume an existing one
   */
  async startSession(
    questionnaire: Questionnaire,
    sessionId?: string
  ): Promise<ResponseSession> {
    let actualSessionId: string;
    let responseBuilder: ResponseBuilder;

    if (sessionId) {
      // Try to resume existing session
      try {
        const existingResponse = await this.storage.loadResponse(sessionId);
        responseBuilder = new ResponseBuilder(
          questionnaire,
          existingResponse,
          this.storage
        );
        actualSessionId = sessionId;
      } catch (error) {
        // Session not found, create new one
        actualSessionId = await this.createNewSession(questionnaire);
        const response = await this.storage.loadResponse(actualSessionId);
        responseBuilder = new ResponseBuilder(questionnaire, response, this.storage);
      }
    } else {
      // Create new session
      actualSessionId = await this.createNewSession(questionnaire);
      const response = await this.storage.loadResponse(actualSessionId);
      responseBuilder = new ResponseBuilder(questionnaire, response, this.storage);
    }

    // Store current builder for auto-save
    this.currentBuilder = responseBuilder;

    // Start auto-save
    this.startAutoSave();

    return {
      sessionId: actualSessionId,
      responseBuilder,
      questionnaire
    };
  }

  /**
   * Create a new session
   */
  private async createNewSession(questionnaire: Questionnaire): Promise<string> {
    return await this.storage.createSession(questionnaire.id);
  }

  /**
   * Resume an existing session by session ID
   */
  async resumeSession(sessionId: string): Promise<ResponseSession> {
    const session = await this.storage.loadSession(sessionId);
    const questionnaire = await this.storage.loadQuestionnaire(session.questionnaireId);
    const response = await this.storage.loadResponse(sessionId);

    const responseBuilder = new ResponseBuilder(questionnaire, response, this.storage);
    
    // Store current builder for auto-save
    this.currentBuilder = responseBuilder;

    // Start auto-save
    this.startAutoSave();

    return {
      sessionId,
      responseBuilder,
      questionnaire
    };
  }

  /**
   * End a session (stops auto-save)
   */
  async endSession(): Promise<void> {
    this.stopAutoSave();
    this.currentBuilder = null;
  }

  /**
   * Export a response in the specified format
   */
  async exportResponse(sessionId: string, format: ExportFormat): Promise<string> {
    const response = await this.storage.loadResponse(sessionId);

    switch (format) {
      case 'json':
        return this.exportAsJSON(response);
      case 'csv':
        return this.exportAsCSV(response);
      default:
        throw new Error(`Unsupported export format: ${format}`);
    }
  }

  /**
   * Start auto-save timer
   */
  private startAutoSave(): void {
    // Clear any existing timer
    this.stopAutoSave();

    this.autoSaveTimer = setInterval(async () => {
      if (this.currentBuilder) {
        try {
          const response = this.currentBuilder.getResponse();
          await this.storage.saveResponse(response);
        } catch (error) {
          const sessionId = this.currentBuilder.getResponse().sessionId;
          logger.warn(`Auto-save failed for session ${sessionId}:`, error);
        }
      }
    }, this.autoSaveInterval);
  }

  /**
   * Stop auto-save timer
   */
  private stopAutoSave(): void {
    if (this.autoSaveTimer) {
      clearInterval(this.autoSaveTimer);
      this.autoSaveTimer = null;
    }
  }

  /**
   * Export response as JSON
   */
  private exportAsJSON(response: QuestionnaireResponse): string {
    return JSON.stringify(response, null, 2);
  }

  /**
   * Export response as CSV
   */
  private exportAsCSV(response: QuestionnaireResponse): string {
    const headers = [
      'questionId',
      'value',
      'answeredAt',
      'duration',
      'attempts',
      'skipped'
    ];
    
    const rows = response.answers.map(answer => [
      answer.questionId,
      JSON.stringify(answer.value),
      answer.answeredAt,
      (answer.duration || 0).toString(),
      (answer.attempts || 0).toString(),
      (answer.skipped || false).toString()
    ]);

    return [
      headers.join(','),
      ...rows.map(row => row.join(','))
    ].join('\n');
  }
}
