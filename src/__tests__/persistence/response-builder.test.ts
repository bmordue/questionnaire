/**
 * Response Builder Tests
 */

import { describe, it, expect, beforeEach, afterEach } from '@jest/globals';
import { promises as fs } from 'fs';
import path from 'path';
import { ResponseBuilder } from '../../core/persistence/response-builder.js';
import { createStorageService } from '../../core/storage.js';
import { TestDataFactory } from '../helpers/test-data-factory.js';
import { ResponseStatus } from '../../core/schemas/response.js';
import { QuestionType } from '../../core/schemas/question.js';
import type { StorageService } from '../../core/storage/types.js';

const TEST_DATA_DIR = path.join(process.cwd(), 'test-data', 'response-builder');

describe('ResponseBuilder', () => {
  let storage: StorageService;
  let builder: ResponseBuilder;
  let questionnaire: any;
  let sessionId: string;

  beforeEach(async () => {
    // Clean up test directory
    try {
      await fs.rm(TEST_DATA_DIR, { recursive: true });
    } catch {
      // Ignore if directory doesn't exist
    }

    // Create storage service
    storage = await createStorageService({
      dataDirectory: TEST_DATA_DIR,
      backupEnabled: false,
      maxBackups: 3,
      compressionEnabled: false,
      encryptionEnabled: false
    });

    // Create test questionnaire
    questionnaire = TestDataFactory.createValidQuestionnaire({
      id: 'test-q',
      questions: [
        {
          id: 'q1',
          type: QuestionType.TEXT,
          text: 'Question 1',
          required: true,
          validation: {}
        },
        {
          id: 'q2',
          type: QuestionType.NUMBER,
          text: 'Question 2',
          required: false,
          validation: {}
        }
      ]
    });

    await storage.saveQuestionnaire(questionnaire);
    
    // Create a session
    sessionId = await storage.createSession('test-q');
    const response = await storage.loadResponse(sessionId);
    
    // Create builder
    builder = new ResponseBuilder(questionnaire, response, storage);
  });

  afterEach(async () => {
    // Clean up after tests
    try {
      await fs.rm(TEST_DATA_DIR, { recursive: true });
    } catch {
      // Ignore cleanup errors
    }
  });

  describe('recordAnswer', () => {
    it('should record a new answer', async () => {
      await builder.recordAnswer('q1', 'Test answer');

      const response = builder.getResponse();
      expect(response.answers).toHaveLength(1);
      expect(response.answers[0]!.questionId).toBe('q1');
      expect(response.answers[0]!.value).toBe('Test answer');
      expect(response.answers[0]!.attempts).toBe(1);
      expect(response.answers[0]!.skipped).toBe(false);
    });

    it('should include duration metadata', async () => {
      await builder.recordAnswer('q1', 'Test', { duration: 5000 });

      const response = builder.getResponse();
      expect(response.answers[0]!.duration).toBe(5000);
    });

    it('should update progress when answer is recorded', async () => {
      await builder.recordAnswer('q1', 'Test');

      const response = builder.getResponse();
      expect(response.progress.answeredCount).toBe(1);
      expect(response.progress.percentComplete).toBe(50); // 1 of 2 questions
    });

    it('should increment attempts when answer is updated', async () => {
      await builder.recordAnswer('q1', 'First answer');
      await builder.recordAnswer('q1', 'Updated answer');

      const response = builder.getResponse();
      expect(response.answers).toHaveLength(1);
      expect(response.answers[0]!.value).toBe('Updated answer');
      expect(response.answers[0]!.attempts).toBe(2);
    });

    it('should accumulate duration across attempts', async () => {
      await builder.recordAnswer('q1', 'First', { duration: 1000 });
      await builder.recordAnswer('q1', 'Second', { duration: 2000 });

      const response = builder.getResponse();
      expect(response.answers[0]!.duration).toBe(3000);
    });
  });

  describe('skipQuestion', () => {
    it('should mark question as skipped', async () => {
      await builder.skipQuestion('q2');

      const response = builder.getResponse();
      expect(response.answers).toHaveLength(1);
      expect(response.answers[0]!.questionId).toBe('q2');
      expect(response.answers[0]!.skipped).toBe(true);
      expect(response.answers[0]!.value).toBeNull();
    });

    it('should update progress to track skipped questions', async () => {
      await builder.skipQuestion('q2');

      const response = builder.getResponse();
      expect(response.progress.skippedCount).toBe(1);
      expect(response.progress.answeredCount).toBe(0);
    });

    it('should mark previously answered question as skipped', async () => {
      await builder.recordAnswer('q1', 'Answer');
      await builder.skipQuestion('q1');

      const response = builder.getResponse();
      expect(response.answers).toHaveLength(1);
      expect(response.answers[0]!.skipped).toBe(true);
    });
  });

  describe('updateAnswer', () => {
    it('should update existing answer value', async () => {
      await builder.recordAnswer('q1', 'Original');
      await builder.updateAnswer('q1', 'Updated', 1000);

      const response = builder.getResponse();
      expect(response.answers).toHaveLength(1);
      expect(response.answers[0]!.value).toBe('Updated');
      expect(response.answers[0]!.attempts).toBe(2);
    });

    it('should create new answer if none exists', async () => {
      await builder.updateAnswer('q1', 'New', 500);

      const response = builder.getResponse();
      expect(response.answers).toHaveLength(1);
      expect(response.answers[0]!.value).toBe('New');
      expect(response.answers[0]!.duration).toBe(500);
    });
  });

  describe('complete', () => {
    it('should mark response as completed', async () => {
      await builder.recordAnswer('q1', 'Answer 1');
      await builder.recordAnswer('q2', 42);
      
      const completed = await builder.complete();

      expect(completed.status).toBe(ResponseStatus.COMPLETED);
      expect(completed.completedAt).toBeDefined();
      expect(completed.progress.percentComplete).toBe(100);
    });

    it('should calculate total duration', async () => {
      await builder.recordAnswer('q1', 'Answer', { duration: 3000 });
      await builder.recordAnswer('q2', 42, { duration: 2000 });
      
      const completed = await builder.complete();

      expect(completed.totalDuration).toBe(5000);
    });

    it('should persist completed response', async () => {
      await builder.recordAnswer('q1', 'Answer');
      await builder.complete();

      const loaded = await storage.loadResponse(sessionId);
      expect(loaded.status).toBe(ResponseStatus.COMPLETED);
    });

    it('should update session status to completed', async () => {
      await builder.recordAnswer('q1', 'Answer');
      await builder.complete();

      const session = await storage.loadSession(sessionId);
      expect(session.status).toBe('completed');
    });
  });

  describe('abandon', () => {
    it('should mark response as abandoned', async () => {
      await builder.recordAnswer('q1', 'Partial answer');
      await builder.abandon();

      const loaded = await storage.loadResponse(sessionId);
      expect(loaded.status).toBe(ResponseStatus.ABANDONED);
    });

    it('should update session status to abandoned', async () => {
      await builder.abandon();

      const session = await storage.loadSession(sessionId);
      expect(session.status).toBe('abandoned');
    });
  });

  describe('getResponse', () => {
    it('should return current response state', async () => {
      await builder.recordAnswer('q1', 'Test');
      
      const response = builder.getResponse();

      expect(response.answers).toHaveLength(1);
      expect(response.status).toBe(ResponseStatus.IN_PROGRESS);
    });

    it('should return a copy of response', async () => {
      const response1 = builder.getResponse();
      const response2 = builder.getResponse();

      expect(response1).not.toBe(response2);
      expect(response1).toEqual(response2);
    });
  });

  describe('progress tracking', () => {
    it('should calculate percentComplete correctly', async () => {
      const response1 = builder.getResponse();
      expect(response1.progress.percentComplete).toBe(0);

      await builder.recordAnswer('q1', 'Answer');
      const response2 = builder.getResponse();
      expect(response2.progress.percentComplete).toBe(50);

      await builder.recordAnswer('q2', 42);
      const response3 = builder.getResponse();
      expect(response3.progress.percentComplete).toBe(100);
    });

    it('should not count skipped questions in answeredCount', async () => {
      await builder.recordAnswer('q1', 'Answer');
      await builder.skipQuestion('q2');

      const response = builder.getResponse();
      expect(response.progress.answeredCount).toBe(1);
      expect(response.progress.skippedCount).toBe(1);
    });

    it('should update lastSavedAt on each change', async () => {
      const before = new Date();
      
      await builder.recordAnswer('q1', 'Answer');
      
      const response = builder.getResponse();
      const lastSaved = new Date(response.lastSavedAt!);
      
      expect(lastSaved.getTime()).toBeGreaterThanOrEqual(before.getTime());
    });
  });
});
