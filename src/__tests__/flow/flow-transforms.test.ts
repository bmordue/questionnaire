/**
 * Flow Transforms Tests
 *
 * Unit tests for the pure flow state-transition function.
 * No storage mocks required.
 */

import { describe, it, expect } from '@jest/globals';
import { applyNavigation } from '../../core/flow/flow-transforms.js';
import type { FlowState } from '../../core/types/flow-types.js';
import type { Question } from '../../core/schema.js';
import { QuestionType } from '../../core/schemas/question.js';

function makeState(overrides: Partial<FlowState> = {}): FlowState {
  return {
    questionnaireId: 'q1',
    sessionId: 's1',
    currentQuestionIndex: 0,
    currentQuestionId: 'q1',
    visitedQuestions: new Set(['q1']),
    skippedQuestions: new Set(),
    questionHistory: ['q1'],
    isCompleted: false,
    startTime: new Date('2024-01-01T00:00:00.000Z'),
    lastUpdateTime: new Date('2024-01-01T00:00:00.000Z'),
    ...overrides
  };
}

function makeQuestion(id: string): Question {
  return {
    id,
    type: QuestionType.TEXT,
    text: `Question ${id}`,
    required: false,
    validation: {}
  };
}

describe('applyNavigation — next', () => {
  it('advances currentQuestionId and index', () => {
    const state = makeState();
    const q2 = makeQuestion('q2');

    const result = applyNavigation(state, {
      direction: 'next',
      nextQuestion: q2,
      nextQuestionIndex: 1,
      skippedIds: []
    });

    expect(result.currentQuestionId).toBe('q2');
    expect(result.currentQuestionIndex).toBe(1);
  });

  it('appends the new question to history if not already last', () => {
    const state = makeState();
    const q2 = makeQuestion('q2');

    const result = applyNavigation(state, {
      direction: 'next',
      nextQuestion: q2,
      nextQuestionIndex: 1,
      skippedIds: []
    });

    expect(result.questionHistory).toEqual(['q1', 'q2']);
  });

  it('does not duplicate history entry if next question is already last', () => {
    const state = makeState({ questionHistory: ['q1', 'q2'], currentQuestionId: 'q1' });
    const q2 = makeQuestion('q2');

    const result = applyNavigation(state, {
      direction: 'next',
      nextQuestion: q2,
      nextQuestionIndex: 1,
      skippedIds: []
    });

    expect(result.questionHistory).toEqual(['q1', 'q2']);
  });

  it('adds skipped question IDs to skippedQuestions set', () => {
    const state = makeState();
    const q3 = makeQuestion('q3');

    const result = applyNavigation(state, {
      direction: 'next',
      nextQuestion: q3,
      nextQuestionIndex: 2,
      skippedIds: ['q2']
    });

    expect(result.skippedQuestions.has('q2')).toBe(true);
  });

  it('does not mutate input state', () => {
    const state = makeState();
    const q2 = makeQuestion('q2');

    applyNavigation(state, {
      direction: 'next',
      nextQuestion: q2,
      nextQuestionIndex: 1,
      skippedIds: ['skipped-q']
    });

    expect(state.currentQuestionId).toBe('q1');
    expect(state.skippedQuestions.size).toBe(0);
    expect(state.questionHistory).toEqual(['q1']);
  });
});

describe('applyNavigation — complete', () => {
  it('sets isCompleted to true', () => {
    const state = makeState();
    const result = applyNavigation(state, { direction: 'complete', skippedIds: [] });

    expect(result.isCompleted).toBe(true);
  });

  it('adds skipped IDs to skippedQuestions', () => {
    const state = makeState();
    const result = applyNavigation(state, { direction: 'complete', skippedIds: ['q2', 'q3'] });

    expect(result.skippedQuestions.has('q2')).toBe(true);
    expect(result.skippedQuestions.has('q3')).toBe(true);
  });

  it('does not mutate input state', () => {
    const state = makeState();
    applyNavigation(state, { direction: 'complete', skippedIds: [] });

    expect(state.isCompleted).toBe(false);
  });
});

describe('applyNavigation — previous', () => {
  it('moves back to the previous question', () => {
    const state = makeState({
      currentQuestionId: 'q2',
      currentQuestionIndex: 1,
      questionHistory: ['q1', 'q2']
    });

    const result = applyNavigation(state, { direction: 'previous' });

    expect(result.currentQuestionId).toBe('q1');
    expect(result.questionHistory).toEqual(['q1']);
  });

  it('returns same state when already at first question', () => {
    const state = makeState({ questionHistory: ['q1'] });
    const result = applyNavigation(state, { direction: 'previous' });

    expect(result).toBe(state); // identical reference
  });

  it('does not mutate input state', () => {
    const state = makeState({
      currentQuestionId: 'q2',
      questionHistory: ['q1', 'q2']
    });
    applyNavigation(state, { direction: 'previous' });

    expect(state.currentQuestionId).toBe('q2');
    expect(state.questionHistory).toEqual(['q1', 'q2']);
  });
});

describe('applyNavigation — jumpTo', () => {
  it('sets currentQuestionId and index to the target question', () => {
    const state = makeState();
    const q3 = makeQuestion('q3');

    const result = applyNavigation(state, {
      direction: 'jumpTo',
      question: q3,
      questionIndex: 2
    });

    expect(result.currentQuestionId).toBe('q3');
    expect(result.currentQuestionIndex).toBe(2);
  });

  it('appends the target to history if not already last', () => {
    const state = makeState();
    const q3 = makeQuestion('q3');

    const result = applyNavigation(state, {
      direction: 'jumpTo',
      question: q3,
      questionIndex: 2
    });

    expect(result.questionHistory).toEqual(['q1', 'q3']);
  });

  it('does not duplicate history entry if target is already last', () => {
    const state = makeState({ questionHistory: ['q1', 'q3'] });
    const q3 = makeQuestion('q3');

    const result = applyNavigation(state, {
      direction: 'jumpTo',
      question: q3,
      questionIndex: 2
    });

    expect(result.questionHistory).toEqual(['q1', 'q3']);
  });

  it('does not mutate input state', () => {
    const state = makeState();
    const q3 = makeQuestion('q3');

    applyNavigation(state, { direction: 'jumpTo', question: q3, questionIndex: 2 });

    expect(state.currentQuestionId).toBe('q1');
    expect(state.questionHistory).toEqual(['q1']);
  });
});
