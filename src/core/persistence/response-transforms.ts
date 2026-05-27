/**
 * Response Transforms
 *
 * Pure functions for computing new QuestionnaireResponse values from existing
 * ones.  These functions perform no I/O and have no side-effects, making them
 * independently unit-testable without storage mocks.
 */

import type { QuestionnaireResponse, Answer, ResponseProgress } from '../schema.js';
import type { AnswerMetadata } from './response-builder.js';

/**
 * Compute updated progress fields from the current answers list.
 * Returns a new ResponseProgress value; does not mutate the input.
 */
export function computeProgress(response: QuestionnaireResponse): ResponseProgress {
  const answeredCount = response.answers.filter(
    a => !a.skipped && a.value !== null
  ).length;

  const skippedCount = response.answers.filter(a => a.skipped).length;

  return {
    ...response.progress,
    answeredCount,
    skippedCount,
    percentComplete: Math.round(
      (answeredCount / response.progress.totalQuestions) * 100
    )
  };
}

/**
 * Apply a single answer (new or updated) to the response and return the
 * resulting response value.  Progress is recomputed automatically.
 * Does not mutate the input.
 */
export function applyAnswer(
  response: QuestionnaireResponse,
  questionId: string,
  value: any,
  metadata: AnswerMetadata = {}
): QuestionnaireResponse {
  const now = metadata.timestamp || new Date().toISOString();
  const existingIndex = response.answers.findIndex(a => a.questionId === questionId);

  let newAnswers: Answer[];
  if (existingIndex >= 0) {
    const existing = response.answers[existingIndex]!;
    newAnswers = [...response.answers];
    newAnswers[existingIndex] = {
      questionId,
      value,
      answeredAt: now,
      duration: (existing.duration || 0) + (metadata.duration || 0),
      attempts: (existing.attempts || 0) + 1,
      skipped: false
    };
  } else {
    newAnswers = [
      ...response.answers,
      {
        questionId,
        value,
        answeredAt: now,
        duration: metadata.duration || 0,
        attempts: 1,
        skipped: false
      }
    ];
  }

  const updated: QuestionnaireResponse = { ...response, answers: newAnswers };
  return { ...updated, progress: computeProgress(updated), lastSavedAt: now };
}

/**
 * Mark a single question as skipped in the response and return the resulting
 * response value.  Progress is recomputed automatically.
 * Does not mutate the input.
 */
export function applySkip(
  response: QuestionnaireResponse,
  questionId: string,
  now: string = new Date().toISOString()
): QuestionnaireResponse {
  const existingIndex = response.answers.findIndex(a => a.questionId === questionId);

  let newAnswers: Answer[];
  if (existingIndex >= 0) {
    const existing = response.answers[existingIndex]!;
    newAnswers = [...response.answers];
    newAnswers[existingIndex] = {
      questionId: existing.questionId,
      value: existing.value,
      answeredAt: now,
      duration: existing.duration,
      attempts: existing.attempts,
      skipped: true
    };
  } else {
    newAnswers = [
      ...response.answers,
      {
        questionId,
        value: null,
        answeredAt: now,
        duration: 0,
        attempts: 0,
        skipped: true
      }
    ];
  }

  const updated: QuestionnaireResponse = { ...response, answers: newAnswers };
  return { ...updated, progress: computeProgress(updated), lastSavedAt: now };
}

/**
 * Mark multiple questions as skipped in the response and return the resulting
 * response value.  Already-skipped questions are left unchanged.
 * Progress is recomputed once at the end.
 * Does not mutate the input.
 */
export function applySkips(
  response: QuestionnaireResponse,
  questionIds: string[],
  now: string = new Date().toISOString()
): QuestionnaireResponse {
  let newAnswers = [...response.answers];
  let modified = false;

  for (const questionId of questionIds) {
    const existingIndex = newAnswers.findIndex(a => a.questionId === questionId);

    if (existingIndex >= 0) {
      const existing = newAnswers[existingIndex]!;
      if (!existing.skipped) {
        newAnswers[existingIndex] = { ...existing, answeredAt: now, skipped: true };
        modified = true;
      }
    } else {
      newAnswers = [
        ...newAnswers,
        {
          questionId,
          value: null,
          answeredAt: now,
          duration: 0,
          attempts: 0,
          skipped: true
        }
      ];
      modified = true;
    }
  }

  if (!modified) return response;

  const updated: QuestionnaireResponse = { ...response, answers: newAnswers };
  return { ...updated, progress: computeProgress(updated), lastSavedAt: now };
}
