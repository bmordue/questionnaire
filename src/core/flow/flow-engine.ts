/**
 * Flow Engine
 * 
 * Core questionnaire flow engine managing question navigation and state
 */

import { z } from 'zod';
import type { Questionnaire, Question } from '../schema.js';
import type { StorageService } from '../storage/types.js';
import type {
  FlowEngine,
  FlowState,
  FlowResult,
  ProgressInfo,
  FlowStartOptions
} from '../types/flow-types.js';
import { ConditionalLogicEngine } from './conditional-logic.js';
import { ProgressTracker } from './progress-tracker.js';
import { applyNavigation } from './flow-transforms.js';

const PersistedFlowStateSchema = z.object({
  currentQuestionIndex: z.number().int().min(0),
  currentQuestionId: z.string(),
  visitedQuestions: z.array(z.string()),
  skippedQuestions: z.array(z.string()),
  questionHistory: z.array(z.string()),
  isCompleted: z.boolean(),
  startTime: z.string().datetime(),
  lastUpdateTime: z.string().datetime()
});

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
    public readonly context?: unknown
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
  async start(
    questionnaireId: string,
    options: FlowStartOptions = {}
  ): Promise<void> {
    const {
      sessionId,
      initialResponses,
      skippedQuestions,
      currentQuestionId,
      startTime
    } = options;

    // Load questionnaire
    this.questionnaire = await this.storage.loadQuestionnaire(questionnaireId);

    if (this.questionnaire.questions.length === 0) {
      throw new FlowError(
        'Questionnaire has no questions',
        FlowErrorCode.INVALID_NAVIGATION
      );
    }

    const firstQuestion = currentQuestionId
      ? this.findQuestionById(currentQuestionId) ?? this.questionnaire.questions[0]
      : this.questionnaire.questions[0];
    if (!firstQuestion) {
      throw new FlowError(
        'Questionnaire has no questions',
        FlowErrorCode.INVALID_NAVIGATION
      );
    }

    // Create new session
    const sessionIdentifier = sessionId ?? await this.storage.createSession(questionnaireId);
    const responses = initialResponses ? new Map(initialResponses) : new Map<string, any>();
    const skipped = skippedQuestions ? new Set(skippedQuestions) : new Set<string>();
    const visited = new Set<string>([...responses.keys(), ...skipped, firstQuestion.id]);
    const currentQuestionIndex = Math.max(0, this.findQuestionIndex(firstQuestion.id));
    const questionHistory = this.buildInitialHistory(firstQuestion.id, responses);

    // Initialize state
    this.state = {
      questionnaireId: this.questionnaire.id,
      sessionId: sessionIdentifier,
      currentQuestionIndex,
      currentQuestionId: firstQuestion.id,
      visitedQuestions: visited,
      skippedQuestions: skipped,
      questionHistory,
      isCompleted: false,
      startTime: startTime ?? new Date(),
      lastUpdateTime: new Date()
    };

    await this.saveState();
  }

  /**
   * Move to the next question
   */
  async next(responses: Map<string, any> = new Map()): Promise<FlowResult> {
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

    // Find next visible question
    const { nextQuestion, skippedQuestionIds } = await this.findNextVisibleQuestion(responses);

    if (!nextQuestion) {
      this.state = applyNavigation(this.state!, { direction: 'complete', skippedIds: skippedQuestionIds });
      await this.saveState();
      return {
        type: 'complete',
        responses: new Map(responses),
        skippedQuestionIds
      };
    }

    this.state = applyNavigation(this.state!, {
      direction: 'next',
      nextQuestion,
      nextQuestionIndex: this.findQuestionIndex(nextQuestion.id),
      skippedIds: skippedQuestionIds
    });

    await this.saveState();
    return { type: 'question', question: nextQuestion, skippedQuestionIds };
  }

  /**
   * Go back to the previous question
   */
  async previous(_responses?: Map<string, any>): Promise<Question | null> {
    this.ensureLoaded();

    if (this.state!.questionHistory.length <= 1) {
      return null; // Already at first question
    }

    const prevState = applyNavigation(this.state!, { direction: 'previous' });
    const previousQuestion = this.findQuestionById(prevState.currentQuestionId);

    if (previousQuestion) {
      this.state = {
        ...prevState,
        currentQuestionIndex: this.findQuestionIndex(previousQuestion.id)
      };
      await this.saveState();
    }

    return previousQuestion;
  }

  /**
   * Jump to a specific question
   */
  async jumpTo(questionId: string, _responses?: Map<string, any>): Promise<Question> {
    this.ensureLoaded();

    const question = this.findQuestionById(questionId);
    if (!question) {
      throw new FlowError(
        `Question not found: ${questionId}`,
        FlowErrorCode.QUESTION_NOT_FOUND,
        { questionId }
      );
    }

    this.state = applyNavigation(this.state!, {
      direction: 'jumpTo',
      question,
      questionIndex: this.findQuestionIndex(question.id)
    });

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
  getProgress(answeredCount?: number): ProgressInfo {
    this.ensureLoaded();

    const totalQuestions = this.questionnaire!.questions.length;
    const answeredQuestions = answeredCount ?? 0;
    const currentIndex = this.state!.currentQuestionIndex;

    return ProgressTracker.calculateProgress(
      totalQuestions,
      currentIndex,
      answeredQuestions,
      this.state!.isCompleted
    );
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
      visitedQuestions: Array.from(this.state.visitedQuestions),
      skippedQuestions: Array.from(this.state.skippedQuestions),
      questionHistory: this.state.questionHistory,
      isCompleted: this.state.isCompleted,
      startTime: this.state.startTime.toISOString(),
      lastUpdateTime: this.state.lastUpdateTime.toISOString()
    };

    await this.storage.updateSession(this.state.sessionId, {
      state: sessionData
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
    if (!session.state) {
      throw new FlowError(
        'Session has no state data',
        FlowErrorCode.STATE_CORRUPTION,
        { sessionId }
      );
    }
    const parsedSessionData = PersistedFlowStateSchema.safeParse(session.state);
    if (!parsedSessionData.success) {
      throw new FlowError(
        'Session has invalid state data',
        FlowErrorCode.STATE_CORRUPTION,
        {
          sessionId,
          issues: parsedSessionData.error.issues
        }
      );
    }
    const sessionData = parsedSessionData.data;

    this.state = {
      questionnaireId: session.questionnaireId,
      sessionId,
      currentQuestionIndex: sessionData.currentQuestionIndex,
      currentQuestionId: sessionData.currentQuestionId,
      visitedQuestions: new Set(sessionData.visitedQuestions),
      skippedQuestions: new Set(sessionData.skippedQuestions),
      questionHistory: sessionData.questionHistory,
      isCompleted: sessionData.isCompleted,
      startTime: new Date(sessionData.startTime),
      lastUpdateTime: new Date(sessionData.lastUpdateTime)
    };

    if (!this.state.questionHistory || this.state.questionHistory.length === 0) {
      const response = await this.storage.loadResponse(sessionId);
      const responsesMap = new Map();
      for (const answer of response.answers) {
        if (!answer.skipped) responsesMap.set(answer.questionId, answer.value);
      }

      this.state.questionHistory = this.buildInitialHistory(
        this.state.currentQuestionId,
        responsesMap
      );
    }
  }

  /**
   * Find the next visible question based on conditional logic
   */
  private async findNextVisibleQuestion(responses: Map<string, any>): Promise<{ nextQuestion: Question | null, skippedQuestionIds: string[] }> {
    this.ensureLoaded();

    const currentIndex = this.state!.currentQuestionIndex;
    const skippedQuestionIds: string[] = [];
    
    for (let i = currentIndex + 1; i < this.questionnaire!.questions.length; i++) {
      const question = this.questionnaire!.questions[i];
      
      if (!question) continue;
      
      if (await this.isQuestionVisible(question, responses)) {
        return { nextQuestion: question, skippedQuestionIds };
      } else {
        // Collect skipped IDs; they will be applied to state via applyNavigation
        skippedQuestionIds.push(question.id);
      }
    }
    
    return { nextQuestion: null, skippedQuestionIds }; // No more questions
  }

  /**
   * Check if a question should be visible
   */
  private async isQuestionVisible(question: Question, responses: Map<string, any>): Promise<boolean> {
    this.ensureLoaded();

    // Skip if conditional logic says to skip
    if (this.conditionalEngine.shouldSkipQuestion(question, responses)) {
      return false;
    }

    // Show if conditional logic allows
    return this.conditionalEngine.shouldShowQuestion(question, responses);
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

  private buildInitialHistory(
    currentQuestionId: string,
    responses: Map<string, any>
  ): string[] {
    if (!this.questionnaire) return [currentQuestionId];

    const answeredInOrder = this.questionnaire.questions
      .filter(question => responses.has(question.id))
      .map(question => question.id);

    if (!answeredInOrder.includes(currentQuestionId)) {
      answeredInOrder.push(currentQuestionId);
    }

    return answeredInOrder;
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
