/**
 * Flow Engine Types
 * 
 * Type definitions for the questionnaire flow engine
 */

import type { Question } from '../schema.js';

/**
 * Flow state tracking current position and history in questionnaire
 */
export interface FlowState {
  questionnaireId: string;
  sessionId: string;
  currentQuestionIndex: number;
  currentQuestionId: string;
  responses: Map<string, any>;
  visitedQuestions: Set<string>;
  skippedQuestions: Set<string>;
  questionHistory: string[];
  isCompleted: boolean;
  startTime: Date;
  lastUpdateTime: Date;
}

/**
 * Progress information for the current questionnaire session
 */
export interface ProgressInfo {
  currentQuestion: number;
  totalQuestions: number;
  answeredQuestions: number;
  percentComplete: number;
  isCompleted: boolean;
}

/**
 * Result of moving to next question
 */
export type QuestionResult = {
  type: 'question';
  question: Question;
};

/**
 * Result indicating questionnaire completion
 */
export type FlowComplete = {
  type: 'complete';
  responses: Map<string, any>;
};

/**
 * Combined result type for next() operation
 */
export type FlowResult = QuestionResult | FlowComplete;

/**
 * Main flow engine interface
 */
export interface FlowEngine {
  start(questionnaireId: string): Promise<void>;
  next(): Promise<FlowResult>;
  previous(): Promise<Question | null>;
  jumpTo(questionId: string): Promise<Question>;
  getCurrentQuestion(): Question | null;
  getProgress(): ProgressInfo;
  recordResponse(questionId: string, answer: any): Promise<void>;
  saveState(): Promise<void>;
  loadState(sessionId: string): Promise<void>;
}
