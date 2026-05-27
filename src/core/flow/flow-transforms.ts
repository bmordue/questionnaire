/**
 * Flow Transforms
 *
 * Pure functions for computing new FlowState values from existing ones.
 * These functions perform no I/O and have no side-effects, making them
 * independently unit-testable without storage mocks.
 */

import type { Question } from '../schema.js';
import type { FlowState } from '../types/flow-types.js';

/**
 * Discriminated union describing a navigation transition to apply to FlowState.
 */
export type FlowTransitionAction =
  | {
      direction: 'next';
      nextQuestion: Question;
      nextQuestionIndex: number;
      skippedIds: string[];
    }
  | { direction: 'complete'; skippedIds: string[] }
  | { direction: 'previous' }
  | {
      direction: 'jumpTo';
      question: Question;
      questionIndex: number;
    };

/**
 * Apply a navigation action to the current FlowState and return the new
 * FlowState.  Does not mutate the input.
 *
 * For the 'previous' direction the caller should inspect the returned state to
 * determine whether navigation was possible (history length did not decrease if
 * it was already at the first question).
 */
export function applyNavigation(state: FlowState, action: FlowTransitionAction): FlowState {
  const now = new Date();

  switch (action.direction) {
    case 'next': {
      const { nextQuestion, nextQuestionIndex, skippedIds } = action;
      const newSkipped = new Set(state.skippedQuestions);
      for (const id of skippedIds) newSkipped.add(id);

      const newHistory = [...state.questionHistory];
      if (newHistory[newHistory.length - 1] !== nextQuestion.id) {
        newHistory.push(nextQuestion.id);
      }

      return {
        ...state,
        currentQuestionId: nextQuestion.id,
        currentQuestionIndex: nextQuestionIndex,
        skippedQuestions: newSkipped,
        questionHistory: newHistory,
        lastUpdateTime: now
      };
    }

    case 'complete': {
      const newSkipped = new Set(state.skippedQuestions);
      for (const id of action.skippedIds) newSkipped.add(id);

      return {
        ...state,
        isCompleted: true,
        skippedQuestions: newSkipped,
        lastUpdateTime: now
      };
    }

    case 'previous': {
      if (state.questionHistory.length <= 1) {
        return state; // Already at first question — no change
      }

      const newHistory = state.questionHistory.slice(0, -1);
      const previousQuestionId = newHistory[newHistory.length - 1]!;

      return {
        ...state,
        currentQuestionId: previousQuestionId,
        questionHistory: newHistory,
        lastUpdateTime: now
      };
    }

    case 'jumpTo': {
      const { question, questionIndex } = action;
      const newHistory = [...state.questionHistory];
      if (newHistory[newHistory.length - 1] !== question.id) {
        newHistory.push(question.id);
      }

      return {
        ...state,
        currentQuestionId: question.id,
        currentQuestionIndex: questionIndex,
        questionHistory: newHistory,
        lastUpdateTime: now
      };
    }
  }
}
