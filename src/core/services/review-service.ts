/**
 * Review Service
 *
 * Analytics, reporting, and export functionality for questionnaire responses.
 */

import type { StorageService } from '../storage/types.js';
import type { QuestionnaireResponse, Answer } from '../schemas/response.js';
import { ResponseStatus } from '../schemas/response.js';
import type { Questionnaire } from '../schemas/questionnaire.js';

export interface CompletionStats {
  totalResponses: number;
  completedResponses: number;
  inProgressResponses: number;
  abandonedResponses: number;
  completionRate: number;
  abandonmentRate: number;
  /** Average ms from session start to completion (only for completed) */
  averageCompletionTimeMs: number | null;
}

export interface QuestionSummary {
  questionId: string;
  questionText: string;
  totalAnswered: number;
  totalSkipped: number;
  /** For choice-based questions: distribution of selected values */
  valueDistribution: Array<{ value: unknown; count: number; percentage: number }>;
}

export interface QuestionnaireSummary {
  questionnaireId: string;
  questionnaireTitle: string;
  stats: CompletionStats;
  questions: QuestionSummary[];
}

export interface ResponseFilter {
  status?: 'in_progress' | 'completed' | 'abandoned';
  completedAfter?: string;
  completedBefore?: string;
  limit?: number;
  offset?: number;
}

export class ReviewService {
  constructor(private readonly storage: StorageService) {}

  /**
   * Get completion statistics for a questionnaire.
   */
  async getCompletionStats(questionnaireId: string): Promise<CompletionStats> {
    const responses = await this.storage.listResponses(questionnaireId);

    const completedResponses = responses.filter(r => r.status === ResponseStatus.COMPLETED);
    const inProgressResponses = responses.filter(r => r.status === ResponseStatus.IN_PROGRESS);
    const abandonedResponses = responses.filter(r => r.status === ResponseStatus.ABANDONED);

    const averageCompletionTimeMs = this.computeAverageCompletionTime(completedResponses);

    return {
      totalResponses: responses.length,
      completedResponses: completedResponses.length,
      inProgressResponses: inProgressResponses.length,
      abandonedResponses: abandonedResponses.length,
      completionRate:
        responses.length > 0
          ? Math.round((completedResponses.length / responses.length) * 100) / 100
          : 0,
      abandonmentRate:
        responses.length > 0
          ? Math.round((abandonedResponses.length / responses.length) * 100) / 100
          : 0,
      averageCompletionTimeMs,
    };
  }

  /**
   * Get a full analytics summary for a questionnaire including per-question breakdowns.
   */
  async getSummary(questionnaireId: string): Promise<QuestionnaireSummary> {
    const [questionnaire, responses] = await Promise.all([
      this.storage.loadQuestionnaire(questionnaireId),
      this.storage.listResponses(questionnaireId),
    ]);

    const stats = await this.getCompletionStats(questionnaireId);
    const questions = this.buildQuestionSummaries(questionnaire, responses);

    return {
      questionnaireId,
      questionnaireTitle: questionnaire.metadata.title,
      stats,
      questions,
    };
  }

  /**
   * List responses for a questionnaire with optional filtering and pagination.
   */
  async listResponses(
    questionnaireId: string,
    filter: ResponseFilter = {},
  ): Promise<QuestionnaireResponse[]> {
    let responses = await this.storage.listResponses(questionnaireId);

    if (filter.status) {
      responses = responses.filter(r => r.status === filter.status);
    }
    if (filter.completedAfter) {
      const after = new Date(filter.completedAfter).getTime();
      responses = responses.filter(
        r => r.completedAt && new Date(r.completedAt).getTime() >= after,
      );
    }
    if (filter.completedBefore) {
      const before = new Date(filter.completedBefore).getTime();
      responses = responses.filter(
        r => r.completedAt && new Date(r.completedAt).getTime() <= before,
      );
    }

    const offset = filter.offset ?? 0;
    const limit = filter.limit;
    return responses.slice(offset, limit !== undefined ? offset + limit : undefined);
  }

  /**
   * Export responses to CSV format.
   */
  async exportToCsv(questionnaireId: string, filter: ResponseFilter = {}): Promise<string> {
    const [questionnaire, responses] = await Promise.all([
      this.storage.loadQuestionnaire(questionnaireId),
      this.listResponses(questionnaireId, filter),
    ]);

    if (responses.length === 0) return '';

    const questionIds = questionnaire.questions.map(q => q.id);
    const questionTexts = questionnaire.questions.map(q => q.text);

    // Header row
    const headers = [
      'sessionId',
      'status',
      'startedAt',
      'completedAt',
      'answeredCount',
      'skippedCount',
      ...questionIds,
    ];

    const rows: string[][] = [headers.map(h => csvEscape(h))];

    for (const response of responses) {
      const answerMap = new Map<string, Answer>(response.answers.map(a => [a.questionId, a]));

      const row = [
        response.sessionId,
        response.status,
        response.startedAt ?? '',
        response.completedAt ?? '',
        String(response.progress.answeredCount),
        String(response.progress.skippedCount),
        ...questionIds.map(qid => {
          const answer = answerMap.get(qid);
          if (!answer) return '';
          if (answer.skipped) return '[skipped]';
          return csvEscape(String(answer.value ?? ''));
        }),
      ];

      rows.push(row);
    }

    // Prepend question text sub-header
    const questionHeader = [
      '', '', '', '', '', '',
      ...questionTexts.map(t => csvEscape(t)),
    ];
    rows.splice(1, 0, questionHeader);

    return rows.map(r => r.join(',')).join('\n');
  }

  /**
   * Export responses to JSON format (pretty-printed array).
   */
  async exportToJson(questionnaireId: string, filter: ResponseFilter = {}): Promise<string> {
    const responses = await this.listResponses(questionnaireId, filter);
    return JSON.stringify(responses, null, 2);
  }

  // ── Private helpers ──────────────────────────────────────────────────────────

  private computeAverageCompletionTime(responses: QuestionnaireResponse[]): number | null {
    const times: number[] = [];

    for (const r of responses) {
      if (r.startedAt && r.completedAt) {
        const duration = new Date(r.completedAt).getTime() - new Date(r.startedAt).getTime();
        if (duration >= 0) times.push(duration);
      }
    }

    if (times.length === 0) return null;
    return Math.round(times.reduce((a, b) => a + b, 0) / times.length);
  }

  private buildQuestionSummaries(
    questionnaire: Questionnaire,
    responses: QuestionnaireResponse[],
  ): QuestionSummary[] {
    return questionnaire.questions.map(question => {
      const answers = responses.flatMap(r =>
        r.answers.filter(a => a.questionId === question.id),
      );

      const answered = answers.filter(a => !a.skipped);
      const skipped = answers.filter(a => a.skipped);

      // Value distribution
      const countMap = new Map<string, number>();
      for (const a of answered) {
        const key = JSON.stringify(a.value);
        countMap.set(key, (countMap.get(key) ?? 0) + 1);
      }

      const valueDistribution = [...countMap.entries()].map(([key, count]) => ({
        value: JSON.parse(key) as unknown,
        count,
        percentage: answered.length > 0 ? Math.round((count / answered.length) * 100) / 100 : 0,
      }));

      return {
        questionId: question.id,
        questionText: question.text,
        totalAnswered: answered.length,
        totalSkipped: skipped.length,
        valueDistribution,
      };
    });
  }
}

function csvEscape(value: string): string {
  if (value.includes(',') || value.includes('"') || value.includes('\n')) {
    return `"${value.replace(/"/g, '""')}"`;
  }
  return value;
}
