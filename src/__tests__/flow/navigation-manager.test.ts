/**
 * Navigation Manager Tests
 */

import { describe, it, expect, beforeEach, afterEach } from '@jest/globals';
import { promises as fs } from 'fs';
import path from 'path';
import { QuestionnaireFlowEngine } from '../../core/flow/flow-engine.js';
import { NavigationManager } from '../../core/flow/navigation-manager.js';
import { PersistenceManager } from '../../core/persistence/persistence-manager.js';
import { createStorageService } from '../../core/storage/index.js';
import { TestDataFactory } from '../helpers/test-data-factory.js';
import type { StorageService } from '../../core/storage/types.js';

const TEST_DATA_DIR = path.join(process.cwd(), 'test-data', 'navigation-manager');

describe('NavigationManager', () => {
  let storage: StorageService;
  let engine: QuestionnaireFlowEngine;
  let navManager: NavigationManager;
  let persistence: PersistenceManager;

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
    persistence = new PersistenceManager(storage);
    navManager = new NavigationManager(engine);
  });

  afterEach(async () => {
    // Clean up after tests
    try {
      await fs.rm(TEST_DATA_DIR, { recursive: true });
    } catch {
      // Ignore cleanup errors
    }
  });

  describe('handleNavigation - next', () => {
    it('should handle next action without answer', async () => {
      const questionnaire = TestDataFactory.createValidQuestionnaire({
        questions: [
          TestDataFactory.createValidTextQuestion({ id: 'q1' }),
          TestDataFactory.createValidTextQuestion({ id: 'q2' })
        ]
      });

      await storage.saveQuestionnaire(questionnaire);
      await engine.start(questionnaire.id);

      const result = await navManager.handleNavigation({ type: 'next' });

      expect(result.success).toBe(true);
      expect(result.result?.type).toBe('question');
      if (result.result?.type === 'question') {
        expect(result.result.question.id).toBe('q2');
      }
    });

    it('should handle next action with answer', async () => {
      const questionnaire = TestDataFactory.createValidQuestionnaire({
        questions: [
          TestDataFactory.createValidTextQuestion({ id: 'q1' }),
          TestDataFactory.createValidTextQuestion({ id: 'q2' })
        ]
      });

      await storage.saveQuestionnaire(questionnaire);
      const session = await persistence.startSession(questionnaire);
      navManager = new NavigationManager(engine, session.responseBuilder);
      await engine.start(questionnaire.id, { sessionId: session.sessionId });

      const result = await navManager.handleNavigation({
        type: 'next',
        answer: 'test answer'
      });

      expect(result.success).toBe(true);

      const progress = engine.getProgress(1);
      expect(progress.answeredQuestions).toBe(1);

      const response = session.responseBuilder.getResponse();
      expect(response.answers.length).toBe(1);
      expect(response.answers[0]?.value).toBe('test answer');
    });

    it('should handle completion', async () => {
      const questionnaire = TestDataFactory.createValidQuestionnaire({
        questions: [
          TestDataFactory.createValidTextQuestion({ id: 'q1' })
        ]
      });

      await storage.saveQuestionnaire(questionnaire);
      await engine.start(questionnaire.id);

      const result = await navManager.handleNavigation({ type: 'next' });

      expect(result.success).toBe(true);
      expect(result.result?.type).toBe('complete');
    });
  });

  describe('handleNavigation - previous', () => {
    it('should handle previous action', async () => {
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
      const result = await navManager.handleNavigation({ type: 'previous' });

      expect(result.success).toBe(true);
      expect(result.result?.type).toBe('question');
      if (result.result?.type === 'question') {
        expect(result.result.question.id).toBe('q1');
      }
    });

    it('should return error when at first question', async () => {
      const questionnaire = TestDataFactory.createValidQuestionnaire({
        questions: [
          TestDataFactory.createValidTextQuestion({ id: 'q1' }),
          TestDataFactory.createValidTextQuestion({ id: 'q2' })
        ]
      });

      await storage.saveQuestionnaire(questionnaire);
      await engine.start(questionnaire.id);

      const result = await navManager.handleNavigation({ type: 'previous' });

      expect(result.success).toBe(false);
      expect(result.error).toContain('first question');
    });
  });

  describe('handleNavigation - skip', () => {
    it('should skip current question', async () => {
      const questionnaire = TestDataFactory.createValidQuestionnaire({
        questions: [
          TestDataFactory.createValidTextQuestion({ id: 'q1' }),
          TestDataFactory.createValidTextQuestion({ id: 'q2' }),
          TestDataFactory.createValidTextQuestion({ id: 'q3' })
        ]
      });

      await storage.saveQuestionnaire(questionnaire);
      await engine.start(questionnaire.id);

      const result = await navManager.handleNavigation({ type: 'skip' });

      expect(result.success).toBe(true);
      expect(result.result?.type).toBe('question');
      if (result.result?.type === 'question') {
        expect(result.result.question.id).toBe('q2');
      }
    });

    it('should not record an answer when skipping', async () => {
      const questionnaire = TestDataFactory.createValidQuestionnaire({
        questions: [
          TestDataFactory.createValidTextQuestion({ id: 'q1' }),
          TestDataFactory.createValidTextQuestion({ id: 'q2' })
        ]
      });

      await storage.saveQuestionnaire(questionnaire);
      const session = await persistence.startSession(questionnaire);
      navManager = new NavigationManager(engine, session.responseBuilder);
      await engine.start(questionnaire.id, { sessionId: session.sessionId });

      await navManager.handleNavigation({ type: 'skip' });

      const progress = engine.getProgress(0);
      expect(progress.answeredQuestions).toBe(0);

      const response = session.responseBuilder.getResponse();
      expect(response.answers.length).toBe(1);
      expect(response.answers[0]?.skipped).toBe(true);
    });
  });

  describe('handleNavigation - jumpTo', () => {
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

      const result = await navManager.handleNavigation({
        type: 'jumpTo',
        questionId: 'q3'
      });

      expect(result.success).toBe(true);
      expect(result.result?.type).toBe('question');
      if (result.result?.type === 'question') {
        expect(result.result.question.id).toBe('q3');
      }
    });

    it('should return error when questionId is missing', async () => {
      const questionnaire = TestDataFactory.createValidQuestionnaire({
        questions: [
          TestDataFactory.createValidTextQuestion({ id: 'q1' })
        ]
      });

      await storage.saveQuestionnaire(questionnaire);
      await engine.start(questionnaire.id);

      const result = await navManager.handleNavigation({ type: 'jumpTo' });

      expect(result.success).toBe(false);
      expect(result.error).toContain('Question ID is required');
    });

    it('should return error for non-existent question', async () => {
      const questionnaire = TestDataFactory.createValidQuestionnaire({
        questions: [
          TestDataFactory.createValidTextQuestion({ id: 'q1' })
        ]
      });

      await storage.saveQuestionnaire(questionnaire);
      await engine.start(questionnaire.id);

      const result = await navManager.handleNavigation({
        type: 'jumpTo',
        questionId: 'nonexistent'
      });

      expect(result.success).toBe(false);
      expect(result.error).toBeDefined();
    });
  });

  describe('handleNavigation - exit', () => {
    it('should save state on exit', async () => {
      const questionnaire = TestDataFactory.createValidQuestionnaire({
        questions: [
          TestDataFactory.createValidTextQuestion({ id: 'q1' }),
          TestDataFactory.createValidTextQuestion({ id: 'q2' })
        ]
      });

      await storage.saveQuestionnaire(questionnaire);
      const session = await persistence.startSession(questionnaire);
      navManager = new NavigationManager(engine, session.responseBuilder);
      await engine.start(questionnaire.id, { sessionId: session.sessionId });

      await session.responseBuilder.recordAnswer('q1', 'answer');

      const result = await navManager.handleNavigation({ type: 'exit' });

      expect(result.success).toBe(true);

      // Verify state was saved
      const sessions = await storage.listActiveSessions();
      expect(sessions.length).toBe(1);
    });
  });

  describe('error handling', () => {
    it('should catch and return errors', async () => {
      // Try to navigate without starting
      const result = await navManager.handleNavigation({ type: 'next' });

      expect(result.success).toBe(false);
      expect(result.error).toBeDefined();
    });
  });
});
