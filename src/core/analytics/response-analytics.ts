/**
 * Response Analytics
 * 
 * Provides analytics and statistics for questionnaire responses
 */

import type { QuestionnaireResponse } from '../schema.js';
import type { StorageService } from '../storage/types.js';

/**
 * Completion statistics for a questionnaire
 */
export interface CompletionStats {
  totalResponses: number;
  completedResponses: number;
  completionRate: number;
  averageCompletionTime: number;
  abandonmentRate: number;
}

/**
 * Question-level statistics
 */
export interface QuestionStats {
  questionId: string;
  totalResponses: number;
  answeredCount: number;
  skippedCount: number;
  averageAttempts: number;
  averageDuration: number;
  responseDistribution: ResponseDistribution;
}

/**
 * Distribution of response values
 */
export interface ResponseDistribution {
  totalResponses: number;
  uniqueValues: number;
  distribution: Array<{
    value: any;
    count: number;
    percentage: number;
  }>;
}

/**
 * Analytics service for questionnaire responses
 */
export class ResponseAnalytics {
  constructor(private storage: StorageService) {}

  /**
   * Get completion statistics for a questionnaire
   */
  async getCompletionStats(questionnaireId: string): Promise<CompletionStats> {
    const responses = await this.storage.listResponses(questionnaireId);

    const total = responses.length;
    const completed = responses.filter(r => r.status === 'completed').length;
    const completedResponses = responses.filter(r => r.status === 'completed');
    const averageTime = this.calculateAverageCompletionTime(completedResponses);

    return {
      totalResponses: total,
      completedResponses: completed,
      completionRate: total > 0 ? (completed / total) * 100 : 0,
      averageCompletionTime: averageTime,
      abandonmentRate: total > 0 ? ((total - completed) / total) * 100 : 0
    };
  }

  /**
   * Get statistics for a specific question
   */
  async getQuestionStats(
    questionnaireId: string,
    questionId: string
  ): Promise<QuestionStats> {
    const responses = await this.storage.listResponses(questionnaireId);
    
    const answeredResponses = responses.filter(r => {
      const answer = r.answers.find(a => a.questionId === questionId);
      return answer && !answer.skipped;
    });

    const values = answeredResponses
      .map(r => r.answers.find(a => a.questionId === questionId)?.value)
      .filter(v => v !== undefined);

    const attempts = answeredResponses
      .map(r => r.answers.find(a => a.questionId === questionId)?.attempts || 0);

    const durations = answeredResponses
      .map(r => r.answers.find(a => a.questionId === questionId)?.duration || 0);

    return {
      questionId,
      totalResponses: responses.length,
      answeredCount: answeredResponses.length,
      skippedCount: responses.length - answeredResponses.length,
      averageAttempts: attempts.length > 0
        ? attempts.reduce((a, b) => a + b, 0) / attempts.length
        : 0,
      averageDuration: durations.length > 0
        ? durations.reduce((a, b) => a + b, 0) / durations.length
        : 0,
      responseDistribution: this.analyzeResponseDistribution(values)
    };
  }

  /**
   * Calculate average completion time for responses
   */
  private calculateAverageCompletionTime(responses: QuestionnaireResponse[]): number {
    if (responses.length === 0) return 0;

    const totalTime = responses.reduce((sum, response) => {
      if (!response.completedAt) return sum;
      
      const startTime = new Date(response.startedAt).getTime();
      const endTime = new Date(response.completedAt).getTime();
      return sum + (endTime - startTime);
    }, 0);

    return totalTime / responses.length;
  }

  /**
   * Analyze distribution of response values
   */
  private analyzeResponseDistribution(values: any[]): ResponseDistribution {
    const distribution: { [key: string]: number } = {};

    values.forEach(value => {
      const key = JSON.stringify(value);
      distribution[key] = (distribution[key] || 0) + 1;
    });

    const total = values.length;
    const distributionWithPercentages = Object.entries(distribution).map(
      ([value, count]) => ({
        value: JSON.parse(value),
        count,
        percentage: total > 0 ? (count / total) * 100 : 0
      })
    );

    return {
      totalResponses: total,
      uniqueValues: Object.keys(distribution).length,
      distribution: distributionWithPercentages
    };
  }
}
