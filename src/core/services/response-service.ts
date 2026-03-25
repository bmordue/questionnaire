/**
 * Response Service
 *
 * Business logic for answer processing, session management, and response lifecycle.
 */

import type { StorageService } from '../storage/types.js';
import type { QuestionnaireResponse, Answer } from '../schemas/response.js';
import { ResponseStatus } from '../schemas/response.js';
import type { Questionnaire } from '../schemas/questionnaire.js';

export class ResponseNotFoundError extends Error {
  constructor(public readonly sessionId: string) {
    super(`Response not found for session: ${sessionId}`);
    this.name = 'ResponseNotFoundError';
  }
}

export class InvalidAnswerError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'InvalidAnswerError';
  }
}

export interface SessionState {
  sessionId: string;
  questionnaire: {
    id: string;
    title: string;
    totalQuestions: number;
    config: Questionnaire['config'];
  };
  currentQuestion: Questionnaire['questions'][number] | null;
  currentQuestionIndex: number;
  progress: QuestionnaireResponse['progress'];
  answers: Answer[];
  isComplete: boolean;
}

export interface AnswerResult {
  nextQuestion: Questionnaire['questions'][number] | null;
  nextQuestionIndex: number | null;
  progress: QuestionnaireResponse['progress'];
  isComplete: boolean;
}

/**
 * Service that handles answer processing and questionnaire session lifecycle.
 */
export class ResponseService {
  constructor(private readonly storage: StorageService) {}

  /**
   * Start a new questionnaire session.
   * Returns the new session ID.
   */
  async startSession(
    questionnaireId: string,
    opts: { userId?: string; userAgent?: string; ipAddress?: string } = {},
  ): Promise<string> {
    const sessionId = await this.storage.createSession(questionnaireId);

    if (opts.userId || opts.userAgent || opts.ipAddress) {
      await this.storage.updateSession(sessionId, {
        ...(opts.userId !== undefined && { userId: opts.userId }),
        ...(opts.userAgent !== undefined && { userAgent: opts.userAgent }),
        ...(opts.ipAddress !== undefined && { ipAddress: opts.ipAddress }),
      });
    }

    return sessionId;
  }

  /**
   * Get current session state including questionnaire and progress.
   */
  async getSessionState(sessionId: string): Promise<SessionState> {
    const session = await this.storage.loadSession(sessionId).catch(() => {
      throw new ResponseNotFoundError(sessionId);
    });

    const questionnaire = await this.storage.loadQuestionnaire(session.questionnaireId);
    const response = await this.storage.loadResponse(sessionId);

    const currentIndex = response.progress.currentQuestionIndex;
    const totalQuestions = questionnaire.questions.length;
    const isComplete = currentIndex >= totalQuestions;
    const currentQuestion = isComplete ? null : (questionnaire.questions[currentIndex] ?? null);

    return {
      sessionId,
      questionnaire: {
        id: questionnaire.id,
        title: questionnaire.metadata.title,
        totalQuestions,
        config: questionnaire.config,
      },
      currentQuestion,
      currentQuestionIndex: currentIndex,
      progress: response.progress,
      answers: response.answers,
      isComplete,
    };
  }

  /**
   * Submit an answer and advance the session to the next question.
   */
  async submitAnswer(
    sessionId: string,
    questionId: string,
    value: unknown,
    skipped = false,
  ): Promise<AnswerResult> {
    const session = await this.storage.loadSession(sessionId).catch(() => {
      throw new ResponseNotFoundError(sessionId);
    });

    const questionnaire = await this.storage.loadQuestionnaire(session.questionnaireId);
    const response = await this.storage.loadResponse(sessionId);

    const totalQuestions = questionnaire.questions.length;

    if (totalQuestions === 0) {
      throw new InvalidAnswerError('Questionnaire has no questions');
    }

    const currentIndex = response.progress.currentQuestionIndex;
    if (currentIndex < 0 || currentIndex >= totalQuestions) {
      throw new InvalidAnswerError('Invalid current question index');
    }

    const expectedQuestionId = questionnaire.questions[currentIndex]?.id;
    if (expectedQuestionId && questionId !== expectedQuestionId) {
      throw new InvalidAnswerError(
        `Answers must be submitted in order. Expected: ${expectedQuestionId}`,
      );
    }

    const answer: Answer = {
      questionId,
      value: value !== undefined ? value : null,
      answeredAt: new Date().toISOString(),
      skipped,
    };

    const existingIdx = response.answers.findIndex(a => a.questionId === questionId);
    const updatedAnswers: Answer[] =
      existingIdx >= 0
        ? response.answers.map((a, i) => (i === existingIdx ? answer : a))
        : [...response.answers, answer];

    const hasExistingAnswer = existingIdx >= 0;
    const rawNextIndex = hasExistingAnswer ? currentIndex : currentIndex + 1;
    const nextIndex = Math.min(rawNextIndex, totalQuestions);

    const answeredCount = updatedAnswers.filter(a => !a.skipped).length;
    const skippedCount = updatedAnswers.filter(a => a.skipped === true).length;
    const isComplete = nextIndex >= totalQuestions;
    const percentComplete =
      totalQuestions > 0 ? Math.round((nextIndex / totalQuestions) * 100) : 100;

    const updatedResponse: QuestionnaireResponse = {
      ...response,
      answers: updatedAnswers,
      lastSavedAt: new Date().toISOString(),
      progress: {
        ...response.progress,
        currentQuestionIndex: nextIndex,
        answeredCount,
        skippedCount,
        percentComplete,
      },
    };

    await this.storage.saveResponse(updatedResponse);

    const nextQuestion = isComplete ? null : (questionnaire.questions[nextIndex] ?? null);

    return {
      nextQuestion,
      nextQuestionIndex: isComplete ? null : nextIndex,
      progress: updatedResponse.progress,
      isComplete,
    };
  }

  /**
   * Complete a questionnaire session.
   */
  async completeSession(sessionId: string): Promise<QuestionnaireResponse> {
    const response = await this.storage.loadResponse(sessionId).catch(() => {
      throw new ResponseNotFoundError(sessionId);
    });

    const now = new Date().toISOString();
    const completedResponse: QuestionnaireResponse = {
      ...response,
      status: ResponseStatus.COMPLETED,
      completedAt: now,
      lastSavedAt: now,
    };

    await this.storage.saveResponse(completedResponse);
    await this.storage.updateSession(sessionId, { status: 'completed', updatedAt: now });

    return completedResponse;
  }

  /**
   * Abandon a session.
   */
  async abandonSession(sessionId: string): Promise<void> {
    const now = new Date().toISOString();
    const response = await this.storage.loadResponse(sessionId).catch(() => {
      throw new ResponseNotFoundError(sessionId);
    });

    const updatedResponse: QuestionnaireResponse = {
      ...response,
      status: ResponseStatus.ABANDONED,
      lastSavedAt: now,
    };

    await this.storage.saveResponse(updatedResponse);
    await this.storage.updateSession(sessionId, { status: 'abandoned', updatedAt: now });
  }

  /**
   * Get a response by session ID.
   */
  async getResponse(sessionId: string): Promise<QuestionnaireResponse> {
    try {
      return await this.storage.loadResponse(sessionId);
    } catch {
      throw new ResponseNotFoundError(sessionId);
    }
  }

  /**
   * List all responses, optionally filtered by questionnaire ID.
   */
  async listResponses(questionnaireId?: string): Promise<QuestionnaireResponse[]> {
    return this.storage.listResponses(questionnaireId);
  }
}
