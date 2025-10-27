/**
 * Flow Engine
 * 
 * Core questionnaire flow engine managing question navigation and state
 */

import type { Questionnaire, Question } from '../schema.js';
import type { StorageService } from '../storage/types.js';
import type {
  FlowEngine,
  FlowState,
  FlowResult,
  ProgressInfo
} from '../types/flow-types.js';
import { ConditionalLogicEngine } from './conditional-logic.js';
import { ProgressTracker } from './progress-tracker.js';

/**
 * Error codes for flow engine errors
 */
export enum FlowErrorCode {
  QUESTION_NOT_FOUND = 'QUESTION_NOT_FOUND',
  INVALID_NAVIGATION = 'INVALID_NAVIGATION',
  CONDITION_ERROR = 'CONDITION_ERROR',
  SESSION_ERROR = 'SESSION_ERROR',
  STATE_CORRUPTION = 'STATE_CORRUPTION',
  NO_CURRENT_QUESTION = 'NO_CURRENT_QUESTION',
  QUESTIONNAIRE_NOT_LOADED = 'QUESTIONNAIRE_NOT_LOADED'
}

/**
 * Error thrown by flow engine
 */
export class FlowError extends Error {
  constructor(
    message: string,
    public readonly code: FlowErrorCode,
    public readonly context?: any
  ) {
    super(message);
    this.name = 'FlowError';
  }
}

/**
 * Main questionnaire flow engine implementation
 */
export class QuestionnaireFlowEngine implements FlowEngine {
  private questionnaire: Questionnaire | null = null;
  private state: FlowState | null = null;
  private readonly conditionalEngine: ConditionalLogicEngine;
  private readonly storage: StorageService;

  constructor(storage: StorageService) {
    this.storage = storage;
    this.conditionalEngine = new ConditionalLogicEngine();
  }

  /**
   * Start a new questionnaire session
   */
  async start(questionnaireId: string): Promise<void> {
    // Load questionnaire
    this.questionnaire = await this.storage.loadQuestionnaire(questionnaireId);

    if (this.questionnaire.questions.length === 0) {
      throw new FlowError(
        'Questionnaire has no questions',
        FlowErrorCode.INVALID_NAVIGATION
      );
    }

    const firstQuestion = this.questionnaire.questions[0];
    if (!firstQuestion) {
      throw new FlowError(
        'Questionnaire has no questions',
        FlowErrorCode.INVALID_NAVIGATION
      );
    }

    // Create new session
    const sessionId = await this.storage.createSession(questionnaireId);

    // Initialize state
    this.state = {
      questionnaireId: this.questionnaire.id,
      sessionId,
      currentQuestionIndex: 0,
      currentQuestionId: firstQuestion.id,
      responses: new Map(),
      visitedQuestions: new Set(),
      skippedQuestions: new Set(),
      questionHistory: [],
      isCompleted: false,
      startTime: new Date(),
      lastUpdateTime: new Date()
    };

    await this.saveState();
  }

  /**
   * Move to the next question
   */
  async next(): Promise<FlowResult> {
    this.ensureLoaded();

    const currentQuestion = this.getCurrentQuestion();
    if (!currentQuestion) {
      throw new FlowError(
        'No current question available',
        FlowErrorCode.NO_CURRENT_QUESTION
      );
    }

    // Mark current question as visited
    this.state!.visitedQuestions.add(currentQuestion.id);
    this.state!.questionHistory.push(currentQuestion.id);

    // Find next visible question
    const nextQuestion = await this.findNextVisibleQuestion();
    
    if (!nextQuestion) {
      // Questionnaire complete
      this.state!.isCompleted = true;
      await this.saveState();
      return { 
        type: 'complete', 
        responses: new Map(this.state!.responses)
      };
    }

    // Update state to next question
    this.state!.currentQuestionId = nextQuestion.id;
    this.state!.currentQuestionIndex = this.findQuestionIndex(nextQuestion.id);
    this.state!.lastUpdateTime = new Date();
    
    await this.saveState();
    return { type: 'question', question: nextQuestion };
  }

  /**
   * Go back to the previous question
   */
  async previous(): Promise<Question | null> {
    this.ensureLoaded();

    if (this.state!.questionHistory.length <= 1) {
      return null; // Already at first question
    }

    // Remove current question from history
    this.state!.questionHistory.pop();
    
    // Get previous question
    const previousQuestionId = this.state!.questionHistory[this.state!.questionHistory.length - 1];
    if (!previousQuestionId) {
      return null;
    }
    
    const previousQuestion = this.findQuestionById(previousQuestionId);
    
    if (previousQuestion) {
      this.state!.currentQuestionId = previousQuestion.id;
      this.state!.currentQuestionIndex = this.findQuestionIndex(previousQuestion.id);
      this.state!.lastUpdateTime = new Date();
      await this.saveState();
    }

    return previousQuestion;
  }

  /**
   * Jump to a specific question
   */
  async jumpTo(questionId: string): Promise<Question> {
    this.ensureLoaded();

    const question = this.findQuestionById(questionId);
    if (!question) {
      throw new FlowError(
        `Question not found: ${questionId}`,
        FlowErrorCode.QUESTION_NOT_FOUND,
        { questionId }
      );
    }

    // Update state
    this.state!.currentQuestionId = question.id;
    this.state!.currentQuestionIndex = this.findQuestionIndex(question.id);
    this.state!.questionHistory.push(question.id);
    this.state!.lastUpdateTime = new Date();
    
    await this.saveState();
    return question;
  }

  /**
   * Get the current question
   */
  getCurrentQuestion(): Question | null {
    if (!this.state) return null;
    return this.findQuestionById(this.state.currentQuestionId);
  }

  /**
   * Get progress information
   */
  getProgress(): ProgressInfo {
    this.ensureLoaded();

    const totalQuestions = this.questionnaire!.questions.length;
    const answeredQuestions = this.state!.responses.size;
    const currentIndex = this.state!.currentQuestionIndex;

    return ProgressTracker.calculateProgress(
      totalQuestions,
      currentIndex,
      answeredQuestions,
      this.state!.isCompleted
    );
  }

  /**
   * Record a response to a question
   */
  async recordResponse(questionId: string, answer: any): Promise<void> {
    this.ensureLoaded();

    this.state!.responses.set(questionId, answer);
    this.state!.lastUpdateTime = new Date();
    
    // Update the response in storage
    const response = await this.storage.loadResponse(this.state!.sessionId);
    response.answers.push({
      questionId,
      value: answer,
      answeredAt: new Date().toISOString()
    });
    response.progress.answeredCount = this.state!.responses.size;
    await this.storage.saveResponse(response);
    
    await this.saveState();
  }

  /**
   * Save current state to storage
   */
  async saveState(): Promise<void> {
    if (!this.state) return;

    // Convert state to serializable format for session data
    const sessionData = {
      currentQuestionIndex: this.state.currentQuestionIndex,
      currentQuestionId: this.state.currentQuestionId,
      responses: Array.from(this.state.responses.entries()),
      visitedQuestions: Array.from(this.state.visitedQuestions),
      skippedQuestions: Array.from(this.state.skippedQuestions),
      questionHistory: this.state.questionHistory,
      isCompleted: this.state.isCompleted,
      startTime: this.state.startTime.toISOString(),
      lastUpdateTime: this.state.lastUpdateTime.toISOString()
    };

    await this.storage.updateSession(this.state.sessionId, {
      state: sessionData as any
    });
  }

  /**
   * Load state from storage
   */
  async loadState(sessionId: string): Promise<void> {
    const session = await this.storage.loadSession(sessionId);
    
    // Load questionnaire
    this.questionnaire = await this.storage.loadQuestionnaire(session.questionnaireId);

    // Reconstruct state from session data
    const sessionData = session.state as any;
    if (!sessionData) {
      throw new FlowError(
        'Session has no state data',
        FlowErrorCode.STATE_CORRUPTION,
        { sessionId }
      );
    }

    this.state = {
      questionnaireId: session.questionnaireId,
      sessionId,
      currentQuestionIndex: sessionData.currentQuestionIndex,
      currentQuestionId: sessionData.currentQuestionId,
      responses: new Map(sessionData.responses),
      visitedQuestions: new Set(sessionData.visitedQuestions),
      skippedQuestions: new Set(sessionData.skippedQuestions),
      questionHistory: sessionData.questionHistory,
      isCompleted: sessionData.isCompleted,
      startTime: new Date(sessionData.startTime),
      lastUpdateTime: new Date(sessionData.lastUpdateTime)
    };
  }

  /**
   * Find the next visible question based on conditional logic
   */
  private async findNextVisibleQuestion(): Promise<Question | null> {
    this.ensureLoaded();

    const currentIndex = this.state!.currentQuestionIndex;
    
    for (let i = currentIndex + 1; i < this.questionnaire!.questions.length; i++) {
      const question = this.questionnaire!.questions[i];
      
      if (!question) continue;
      
      if (await this.isQuestionVisible(question)) {
        return question;
      } else {
        // Mark as skipped
        this.state!.skippedQuestions.add(question.id);
      }
    }
    
    return null; // No more questions
  }

  /**
   * Check if a question should be visible
   */
  private async isQuestionVisible(question: Question): Promise<boolean> {
    this.ensureLoaded();

    // Skip if conditional logic says to skip
    if (this.conditionalEngine.shouldSkipQuestion(question, this.state!.responses)) {
      return false;
    }

    // Show if conditional logic allows
    return this.conditionalEngine.shouldShowQuestion(question, this.state!.responses);
  }

  /**
   * Find a question by ID
   */
  private findQuestionById(questionId: string): Question | null {
    if (!this.questionnaire) return null;
    return this.questionnaire.questions.find(q => q.id === questionId) || null;
  }

  /**
   * Find the index of a question by ID
   */
  private findQuestionIndex(questionId: string): number {
    if (!this.questionnaire) return -1;
    return this.questionnaire.questions.findIndex(q => q.id === questionId);
  }

  /**
   * Ensure questionnaire and state are loaded
   */
  private ensureLoaded(): void {
    if (!this.questionnaire || !this.state) {
      throw new FlowError(
        'Questionnaire not loaded. Call start() or loadState() first.',
        FlowErrorCode.QUESTIONNAIRE_NOT_LOADED
      );
    }
  }
}
