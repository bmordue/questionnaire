/**
 * Response Transforms Tests
 *
 * Unit tests for the pure response state-transition functions.
 * No storage mocks required.
 */

import { describe, it, expect } from '@jest/globals';
import { applyAnswer, applySkip, applySkips, computeProgress } from '../../core/persistence/response-transforms.js';
import type { QuestionnaireResponse } from '../../core/schema.js';
import { ResponseStatus } from '../../core/schemas/response.js';

function makeResponse(overrides: Partial<QuestionnaireResponse> = {}): QuestionnaireResponse {
  return {
    id: 'r1',
    questionnaireId: 'q1',
    questionnaireVersion: '1.0',
    sessionId: 's1',
    startedAt: '2024-01-01T00:00:00.000Z',
    status: ResponseStatus.IN_PROGRESS,
    answers: [],
    progress: {
      currentQuestionIndex: 0,
      totalQuestions: 3,
      answeredCount: 0,
      skippedCount: 0,
      percentComplete: 0
    },
    version: '1.0',
    ...overrides
  };
}

describe('computeProgress', () => {
  it('returns zero progress for empty answers', () => {
    const response = makeResponse();
    const progress = computeProgress(response);
    expect(progress.answeredCount).toBe(0);
    expect(progress.skippedCount).toBe(0);
    expect(progress.percentComplete).toBe(0);
  });

  it('counts non-skipped answers with non-null values', () => {
    const response = makeResponse({
      answers: [
        { questionId: 'q1', value: 'hello', answeredAt: '2024-01-01T00:00:00.000Z', skipped: false },
        { questionId: 'q2', value: null, answeredAt: '2024-01-01T00:00:00.000Z', skipped: true }
      ]
    });
    const progress = computeProgress(response);
    expect(progress.answeredCount).toBe(1);
    expect(progress.skippedCount).toBe(1);
  });

  it('calculates percentComplete based on totalQuestions', () => {
    const response = makeResponse({
      answers: [
        { questionId: 'q1', value: 'a', answeredAt: '2024-01-01T00:00:00.000Z', skipped: false },
        { questionId: 'q2', value: 'b', answeredAt: '2024-01-01T00:00:00.000Z', skipped: false }
      ]
    });
    // 2 of 3 questions answered → 67 %
    const progress = computeProgress(response);
    expect(progress.percentComplete).toBe(67);
  });

  it('does not mutate the input response', () => {
    const response = makeResponse();
    const originalProgress = { ...response.progress };
    computeProgress(response);
    expect(response.progress).toEqual(originalProgress);
  });
});

describe('applyAnswer', () => {
  it('adds a new answer when none exists', () => {
    const response = makeResponse();
    const result = applyAnswer(response, 'q1', 'hello');

    expect(result.answers).toHaveLength(1);
    expect(result.answers[0]!.questionId).toBe('q1');
    expect(result.answers[0]!.value).toBe('hello');
    expect(result.answers[0]!.attempts).toBe(1);
    expect(result.answers[0]!.skipped).toBe(false);
  });

  it('updates an existing answer and increments attempts', () => {
    const response = makeResponse({
      answers: [
        { questionId: 'q1', value: 'original', answeredAt: '2024-01-01T00:00:00.000Z', attempts: 1, duration: 500, skipped: false }
      ]
    });
    const result = applyAnswer(response, 'q1', 'updated');

    expect(result.answers).toHaveLength(1);
    expect(result.answers[0]!.value).toBe('updated');
    expect(result.answers[0]!.attempts).toBe(2);
  });

  it('accumulates duration across attempts', () => {
    const response = makeResponse({
      answers: [
        { questionId: 'q1', value: 'first', answeredAt: '2024-01-01T00:00:00.000Z', attempts: 1, duration: 1000, skipped: false }
      ]
    });
    const result = applyAnswer(response, 'q1', 'second', { duration: 2000 });

    expect(result.answers[0]!.duration).toBe(3000);
  });

  it('recomputes progress after applying an answer', () => {
    const response = makeResponse();
    const result = applyAnswer(response, 'q1', 'hello');

    expect(result.progress.answeredCount).toBe(1);
    expect(result.progress.percentComplete).toBe(33); // 1 of 3
  });

  it('does not mutate the input response', () => {
    const response = makeResponse();
    applyAnswer(response, 'q1', 'hello');

    expect(response.answers).toHaveLength(0);
  });

  it('uses provided timestamp when supplied', () => {
    const response = makeResponse();
    const ts = '2024-06-01T12:00:00.000Z';
    const result = applyAnswer(response, 'q1', 'val', { timestamp: ts });

    expect(result.answers[0]!.answeredAt).toBe(ts);
  });
});

describe('applySkip', () => {
  it('adds a skipped answer for a new question', () => {
    const response = makeResponse();
    const result = applySkip(response, 'q2');

    expect(result.answers).toHaveLength(1);
    expect(result.answers[0]!.questionId).toBe('q2');
    expect(result.answers[0]!.skipped).toBe(true);
    expect(result.answers[0]!.value).toBeNull();
  });

  it('marks an existing answered question as skipped', () => {
    const response = makeResponse({
      answers: [
        { questionId: 'q1', value: 'hello', answeredAt: '2024-01-01T00:00:00.000Z', attempts: 1, skipped: false }
      ]
    });
    const result = applySkip(response, 'q1');

    expect(result.answers).toHaveLength(1);
    expect(result.answers[0]!.skipped).toBe(true);
    expect(result.answers[0]!.value).toBe('hello'); // value is preserved
  });

  it('recomputes progress (skipped not counted in answeredCount)', () => {
    const response = makeResponse();
    const result = applySkip(response, 'q1');

    expect(result.progress.skippedCount).toBe(1);
    expect(result.progress.answeredCount).toBe(0);
  });

  it('does not mutate the input response', () => {
    const response = makeResponse();
    applySkip(response, 'q1');

    expect(response.answers).toHaveLength(0);
  });
});

describe('applySkips', () => {
  it('marks multiple new questions as skipped', () => {
    const response = makeResponse();
    const result = applySkips(response, ['q1', 'q2']);

    expect(result.answers).toHaveLength(2);
    expect(result.answers.every(a => a.skipped)).toBe(true);
  });

  it('returns the same reference when there is nothing to change', () => {
    const response = makeResponse({
      answers: [
        { questionId: 'q1', value: null, answeredAt: '2024-01-01T00:00:00.000Z', skipped: true }
      ]
    });
    const result = applySkips(response, ['q1']); // already skipped

    expect(result).toBe(response); // identical reference — answers array is not cloned
  });

  it('does not re-skip already-skipped questions', () => {
    const alreadySkipped = { questionId: 'q1', value: null, answeredAt: '2024-01-01T00:00:00.000Z', skipped: true };
    const response = makeResponse({ answers: [alreadySkipped] });
    const result = applySkips(response, ['q1', 'q2']);

    const q1Answer = result.answers.find(a => a.questionId === 'q1');
    expect(q1Answer).toEqual(alreadySkipped); // unchanged
  });

  it('does not mutate the input response', () => {
    const response = makeResponse();
    applySkips(response, ['q1', 'q2']);

    expect(response.answers).toHaveLength(0);
  });

  it('recomputes progress once at the end', () => {
    const response = makeResponse();
    const result = applySkips(response, ['q1', 'q2']);

    expect(result.progress.skippedCount).toBe(2);
    expect(result.progress.answeredCount).toBe(0);
  });
});
