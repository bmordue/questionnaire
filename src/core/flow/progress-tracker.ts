/**
 * Progress Tracker
 * 
 * Tracks progress through a questionnaire session
 */

import type { ProgressInfo } from '../types/flow-types.js';

/**
 * Tracks questionnaire completion progress
 */
export class ProgressTracker {
  /**
   * Calculate progress information
   */
  static calculateProgress(
    totalQuestions: number,
    currentIndex: number,
    answeredQuestions: number,
    isCompleted: boolean
  ): ProgressInfo {
    const percentComplete = totalQuestions > 0 
      ? Math.round((answeredQuestions / totalQuestions) * 100)
      : 0;

    return {
      currentQuestion: currentIndex + 1,
      totalQuestions,
      answeredQuestions,
      percentComplete,
      isCompleted
    };
  }

  /**
   * Determine if questionnaire is complete
   */
  static isComplete(
    currentIndex: number,
    totalQuestions: number,
    requiredQuestionsAnswered: boolean
  ): boolean {
    return currentIndex >= totalQuestions && requiredQuestionsAnswered;
  }
}
