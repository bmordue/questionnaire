/**
 * Flow Engine Tests
 */

import { describe, it, expect, beforeEach, afterEach } from '@jest/globals';
import { promises as fs } from 'fs';
import path from 'path';
import { QuestionnaireFlowEngine, FlowError, FlowErrorCode } from '../../core/flow/flow-engine.js';
import { createStorageService } from '../../core/storage.js';
import { TestDataFactory } from '../helpers/test-data-factory.js';
import type { StorageService } from '../../core/storage/types.js';

const TEST_DATA_DIR = path.join(process.cwd(), 'test-data', 'flow-engine');

describe('QuestionnaireFlowEngine', () => {
  let storage: StorageService;
  let engine: QuestionnaireFlowEngine;

  beforeEach(async () => {
    // Clean up test directory
    try {
      await fs.rm(TEST_DATA_DIR, { recursive: true });
    } catch {
      // Ignore if directory doesn't exist
    }

    // Create new storage service
    storage = await createStorageService({
      dataDirectory: TEST_DATA_DIR,
      backupEnabled: false
    });

    engine = new QuestionnaireFlowEngine(storage);
  });

  afterEach(async () => {
    // Clean up after tests
    try {
      await fs.rm(TEST_DATA_DIR, { recursive: true });
    } catch {
      // Ignore cleanup errors
    }
  });

  describe('start', () => {
    it('should start a new questionnaire session', async () => {
      const questionnaire = TestDataFactory.createValidQuestionnaire({
        questions: [
          TestDataFactory.createValidTextQuestion({ id: 'q1' }),
          TestDataFactory.createValidTextQuestion({ id: 'q2' })
        ]
      });

      await storage.saveQuestionnaire(questionnaire);
      await engine.start(questionnaire.id);

      const current = engine.getCurrentQuestion();
      expect(current).not.toBeNull();
      expect(current?.id).toBe('q1');
    });

    it('should initialize progress', async () => {
      const questionnaire = TestDataFactory.createValidQuestionnaire({
        questions: [
          TestDataFactory.createValidTextQuestion({ id: 'q1' }),
          TestDataFactory.createValidTextQuestion({ id: 'q2' })
        ]
      });

      await storage.saveQuestionnaire(questionnaire);
      await engine.start(questionnaire.id);

      const progress = engine.getProgress();
      expect(progress.currentQuestion).toBe(1);
      expect(progress.totalQuestions).toBe(2);
      expect(progress.answeredQuestions).toBe(0);
      expect(progress.percentComplete).toBe(0);
      expect(progress.isCompleted).toBe(false);
    });
  });

  describe('next', () => {
    it('should move to next question', async () => {
      const questionnaire = TestDataFactory.createValidQuestionnaire({
        questions: [
          TestDataFactory.createValidTextQuestion({ id: 'q1' }),
          TestDataFactory.createValidTextQuestion({ id: 'q2' }),
          TestDataFactory.createValidTextQuestion({ id: 'q3' })
        ]
      });

      await storage.saveQuestionnaire(questionnaire);
      await engine.start(questionnaire.id);

      const result = await engine.next();
      expect(result.type).toBe('question');
      if (result.type === 'question') {
        expect(result.question.id).toBe('q2');
      }
    });

    it('should complete questionnaire when reaching end', async () => {
      const questionnaire = TestDataFactory.createValidQuestionnaire({
        questions: [
          TestDataFactory.createValidTextQuestion({ id: 'q1' })
        ]
      });

      await storage.saveQuestionnaire(questionnaire);
      await engine.start(questionnaire.id);

      const result = await engine.next();
      expect(result.type).toBe('complete');
      if (result.type === 'complete') {
        expect(result.responses).toBeInstanceOf(Map);
      }
    });

    it('should skip questions based on conditional logic', async () => {
      const questionnaire = TestDataFactory.createValidQuestionnaire({
        questions: [
          TestDataFactory.createValidBooleanQuestion({ id: 'q1' }),
          TestDataFactory.createValidTextQuestion({
            id: 'q2',
            conditional: {
              showIf: {
                questionId: 'q1',
                operator: 'equals',
                value: true
              }
            }
          }),
          TestDataFactory.createValidTextQuestion({ id: 'q3' })
        ]
      });

      await storage.saveQuestionnaire(questionnaire);
      await engine.start(questionnaire.id);

      // Answer q1 with false, so q2 should be skipped
      await engine.recordResponse('q1', false);

      const result = await engine.next();
      expect(result.type).toBe('question');
      if (result.type === 'question') {
        expect(result.question.id).toBe('q3'); // Should skip q2
      }
    });

    it('should throw error if no current question', async () => {
      await expect(engine.next()).rejects.toThrow(FlowError);
    });
  });

  describe('previous', () => {
    it('should return null at first question', async () => {
      const questionnaire = TestDataFactory.createValidQuestionnaire({
        questions: [
          TestDataFactory.createValidTextQuestion({ id: 'q1' }),
          TestDataFactory.createValidTextQuestion({ id: 'q2' })
        ]
      });

      await storage.saveQuestionnaire(questionnaire);
      await engine.start(questionnaire.id);

      const result = await engine.previous();
      expect(result).toBeNull();
    });

    it('should go back to previous question', async () => {
      const questionnaire = TestDataFactory.createValidQuestionnaire({
        questions: [
          TestDataFactory.createValidTextQuestion({ id: 'q1' }),
          TestDataFactory.createValidTextQuestion({ id: 'q2' }),
          TestDataFactory.createValidTextQuestion({ id: 'q3' })
        ]
      });

      await storage.saveQuestionnaire(questionnaire);
      await engine.start(questionnaire.id);

      // Move to q2
      await engine.next();

      // Go back
      const result = await engine.previous();
      expect(result).not.toBeNull();
      expect(result?.id).toBe('q1');
    });

    it('should update current question', async () => {
      const questionnaire = TestDataFactory.createValidQuestionnaire({
        questions: [
          TestDataFactory.createValidTextQuestion({ id: 'q1' }),
          TestDataFactory.createValidTextQuestion({ id: 'q2' })
        ]
      });

      await storage.saveQuestionnaire(questionnaire);
      await engine.start(questionnaire.id);

      await engine.next();
      await engine.previous();

      const current = engine.getCurrentQuestion();
      expect(current?.id).toBe('q1');
    });
  });

  describe('jumpTo', () => {
    it('should jump to specific question', async () => {
      const questionnaire = TestDataFactory.createValidQuestionnaire({
        questions: [
          TestDataFactory.createValidTextQuestion({ id: 'q1' }),
          TestDataFactory.createValidTextQuestion({ id: 'q2' }),
          TestDataFactory.createValidTextQuestion({ id: 'q3' })
        ]
      });

      await storage.saveQuestionnaire(questionnaire);
      await engine.start(questionnaire.id);

      const result = await engine.jumpTo('q3');
      expect(result.id).toBe('q3');

      const current = engine.getCurrentQuestion();
      expect(current?.id).toBe('q3');
    });

    it('should throw error for non-existent question', async () => {
      const questionnaire = TestDataFactory.createValidQuestionnaire({
        questions: [
          TestDataFactory.createValidTextQuestion({ id: 'q1' })
        ]
      });

      await storage.saveQuestionnaire(questionnaire);
      await engine.start(questionnaire.id);

      await expect(engine.jumpTo('nonexistent')).rejects.toThrow(FlowError);
    });
  });

  describe('recordResponse', () => {
    it('should record a response', async () => {
      const questionnaire = TestDataFactory.createValidQuestionnaire({
        questions: [
          TestDataFactory.createValidTextQuestion({ id: 'q1' })
        ]
      });

      await storage.saveQuestionnaire(questionnaire);
      await engine.start(questionnaire.id);

      await engine.recordResponse('q1', 'test answer');

      const progress = engine.getProgress();
      expect(progress.answeredQuestions).toBe(1);
    });

    it('should update progress percentage', async () => {
      const questionnaire = TestDataFactory.createValidQuestionnaire({
        questions: [
          TestDataFactory.createValidTextQuestion({ id: 'q1' }),
          TestDataFactory.createValidTextQuestion({ id: 'q2' })
        ]
      });

      await storage.saveQuestionnaire(questionnaire);
      await engine.start(questionnaire.id);

      await engine.recordResponse('q1', 'answer1');

      const progress = engine.getProgress();
      expect(progress.percentComplete).toBe(50);
    });
  });

  describe('getProgress', () => {
    it('should return accurate progress information', async () => {
      const questionnaire = TestDataFactory.createValidQuestionnaire({
        questions: [
          TestDataFactory.createValidTextQuestion({ id: 'q1' }),
          TestDataFactory.createValidTextQuestion({ id: 'q2' }),
          TestDataFactory.createValidTextQuestion({ id: 'q3' }),
          TestDataFactory.createValidTextQuestion({ id: 'q4' })
        ]
      });

      await storage.saveQuestionnaire(questionnaire);
      await engine.start(questionnaire.id);

      await engine.recordResponse('q1', 'answer1');
      await engine.next();
      await engine.recordResponse('q2', 'answer2');

      const progress = engine.getProgress();
      expect(progress.totalQuestions).toBe(4);
      expect(progress.answeredQuestions).toBe(2);
      expect(progress.percentComplete).toBe(50);
    });
  });

  describe('saveState and loadState', () => {
    it('should save and restore state', async () => {
      const questionnaire = TestDataFactory.createValidQuestionnaire({
        questions: [
          TestDataFactory.createValidTextQuestion({ id: 'q1' }),
          TestDataFactory.createValidTextQuestion({ id: 'q2' }),
          TestDataFactory.createValidTextQuestion({ id: 'q3' })
        ]
      });

      await storage.saveQuestionnaire(questionnaire);
      await engine.start(questionnaire.id);

      await engine.recordResponse('q1', 'answer1');
      await engine.next();

      const sessions = await storage.listActiveSessions();
      expect(sessions.length).toBeGreaterThan(0);
      const sessionId = sessions[0]!.sessionId;

      // Create new engine and load state
      const newEngine = new QuestionnaireFlowEngine(storage);
      await newEngine.loadState(sessionId);

      const current = newEngine.getCurrentQuestion();
      expect(current?.id).toBe('q2');

      const progress = newEngine.getProgress();
      expect(progress.answeredQuestions).toBe(1);
    });

    it('should preserve responses across save/load', async () => {
      const questionnaire = TestDataFactory.createValidQuestionnaire({
        questions: [
          TestDataFactory.createValidTextQuestion({ id: 'q1' }),
          TestDataFactory.createValidTextQuestion({ id: 'q2' })
        ]
      });

      await storage.saveQuestionnaire(questionnaire);
      await engine.start(questionnaire.id);

      await engine.recordResponse('q1', 'test answer');
      const sessions = await storage.listActiveSessions();
      expect(sessions.length).toBeGreaterThan(0);
      const sessionId = sessions[0]!.sessionId;

      // Load in new engine
      const newEngine = new QuestionnaireFlowEngine(storage);
      await newEngine.loadState(sessionId);

      const response = await storage.loadResponse(sessionId);
      expect(response.answers.length).toBe(1);
      expect(response.answers[0]?.value).toBe('test answer');
    });
  });

  describe('complex conditional scenarios', () => {
    it('should handle multiple conditional branches', async () => {
      const questionnaire = TestDataFactory.createValidQuestionnaire({
        questions: [
          TestDataFactory.createValidSingleChoiceQuestion({
            id: 'q1',
            text: 'Do you have pets?',
            options: [
              { value: 'yes', label: 'Yes' },
              { value: 'no', label: 'No' }
            ]
          }),
          TestDataFactory.createValidTextQuestion({
            id: 'q2-dogs',
            text: 'How many dogs?',
            conditional: {
              showIf: {
                questionId: 'q1',
                operator: 'equals',
                value: 'yes'
              }
            }
          }),
          TestDataFactory.createValidTextQuestion({
            id: 'q2-cats',
            text: 'How many cats?',
            conditional: {
              showIf: {
                questionId: 'q1',
                operator: 'equals',
                value: 'yes'
              }
            }
          }),
          TestDataFactory.createValidTextQuestion({
            id: 'q3',
            text: 'Final question'
          })
        ]
      });

      await storage.saveQuestionnaire(questionnaire);
      await engine.start(questionnaire.id);

      // Answer no to pets
      await engine.recordResponse('q1', 'no');
      const result = await engine.next();

      expect(result.type).toBe('question');
      if (result.type === 'question') {
        expect(result.question.id).toBe('q3'); // Should skip q2-dogs and q2-cats
      }
    });

    it('should handle chained conditions', async () => {
      const questionnaire = TestDataFactory.createValidQuestionnaire({
        questions: [
          TestDataFactory.createValidBooleanQuestion({ id: 'q1' }),
          TestDataFactory.createValidTextQuestion({
            id: 'q2',
            conditional: {
              showIf: {
                questionId: 'q1',
                operator: 'equals',
                value: true
              }
            }
          }),
          TestDataFactory.createValidTextQuestion({
            id: 'q3',
            conditional: {
              showIf: {
                questionId: 'q2',
                operator: 'isNotEmpty'
              }
            }
          })
        ]
      });

      await storage.saveQuestionnaire(questionnaire);
      await engine.start(questionnaire.id);

      // Answer true and provide answer for q2
      await engine.recordResponse('q1', true);
      await engine.next();
      await engine.recordResponse('q2', 'answer');
      const result = await engine.next();

      expect(result.type).toBe('question');
      if (result.type === 'question') {
        expect(result.question.id).toBe('q3');
      }
    });
  });
});
