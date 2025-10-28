/**
 * Response Analytics Tests
 */

import { describe, it, expect, beforeEach, afterEach } from '@jest/globals';
import { promises as fs } from 'fs';
import path from 'path';
import { ResponseAnalytics } from '../../core/analytics/response-analytics.js';
import { createStorageService } from '../../core/storage.js';
import { TestDataFactory } from '../helpers/test-data-factory.js';
import { ResponseStatus } from '../../core/schemas/response.js';
import type { StorageService } from '../../core/storage/types.js';

const TEST_DATA_DIR = path.join(process.cwd(), 'test-data', 'analytics');

describe('ResponseAnalytics', () => {
  let storage: StorageService;
  let analytics: ResponseAnalytics;
  const questionnaireId = 'test-q';

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

    analytics = new ResponseAnalytics(storage);

    // Create test questionnaire
    const questionnaire = TestDataFactory.createValidQuestionnaire({
      id: questionnaireId
    });
    await storage.saveQuestionnaire(questionnaire);
  });

  afterEach(async () => {
    // Clean up after tests
    try {
      await fs.rm(TEST_DATA_DIR, { recursive: true });
    } catch {
      // Ignore cleanup errors
    }
  });

  describe('getCompletionStats', () => {
    it('should calculate completion stats for empty questionnaire', async () => {
      const stats = await analytics.getCompletionStats(questionnaireId);

      expect(stats.totalResponses).toBe(0);
      expect(stats.completedResponses).toBe(0);
      expect(stats.completionRate).toBe(0);
      expect(stats.abandonmentRate).toBe(0);
    });

    it('should calculate completion rate', async () => {
      // Create 3 completed and 2 in-progress responses
      for (let i = 0; i < 3; i++) {
        const response = TestDataFactory.createValidResponse({
          questionnaireId,
          sessionId: `session-${i}`,
          status: ResponseStatus.COMPLETED,
          completedAt: new Date().toISOString()
        });
        await storage.saveResponse(response);
      }

      for (let i = 3; i < 5; i++) {
        const response = TestDataFactory.createValidResponse({
          questionnaireId,
          sessionId: `session-${i}`,
          status: ResponseStatus.IN_PROGRESS
        });
        await storage.saveResponse(response);
      }

      const stats = await analytics.getCompletionStats(questionnaireId);

      expect(stats.totalResponses).toBe(5);
      expect(stats.completedResponses).toBe(3);
      expect(stats.completionRate).toBe(60);
      expect(stats.abandonmentRate).toBe(40);
    });

    it('should calculate average completion time', async () => {
      const startTime = new Date('2025-01-01T10:00:00Z');
      
      // Create responses with known durations
      const response1 = TestDataFactory.createValidResponse({
        questionnaireId,
        sessionId: 'session-1',
        status: ResponseStatus.COMPLETED,
        startedAt: startTime.toISOString(),
        completedAt: new Date(startTime.getTime() + 60000).toISOString() // 1 minute
      });
      
      const response2 = TestDataFactory.createValidResponse({
        questionnaireId,
        sessionId: 'session-2',
        status: ResponseStatus.COMPLETED,
        startedAt: startTime.toISOString(),
        completedAt: new Date(startTime.getTime() + 120000).toISOString() // 2 minutes
      });

      await storage.saveResponse(response1);
      await storage.saveResponse(response2);

      const stats = await analytics.getCompletionStats(questionnaireId);

      // Average is (60000 + 120000) / 2 = 90000 ms
      expect(stats.averageCompletionTime).toBe(90000);
    });
  });

  describe('getQuestionStats', () => {
    it('should return stats for a question with no responses', async () => {
      const stats = await analytics.getQuestionStats(questionnaireId, 'q1');

      expect(stats.questionId).toBe('q1');
      expect(stats.totalResponses).toBe(0);
      expect(stats.answeredCount).toBe(0);
      expect(stats.skippedCount).toBe(0);
    });

    it('should count answered vs skipped questions', async () => {
      // Create responses with answered and skipped questions
      const response1 = TestDataFactory.createValidResponse({
        questionnaireId,
        sessionId: 'session-1',
        answers: [
          { questionId: 'q1', value: 'Answer 1', answeredAt: new Date().toISOString() }
        ]
      });

      const response2 = TestDataFactory.createValidResponse({
        questionnaireId,
        sessionId: 'session-2',
        answers: [
          { questionId: 'q1', value: null, answeredAt: new Date().toISOString(), skipped: true }
        ]
      });

      const response3 = TestDataFactory.createValidResponse({
        questionnaireId,
        sessionId: 'session-3',
        answers: [
          { questionId: 'q1', value: 'Answer 3', answeredAt: new Date().toISOString() }
        ]
      });

      await storage.saveResponse(response1);
      await storage.saveResponse(response2);
      await storage.saveResponse(response3);

      const stats = await analytics.getQuestionStats(questionnaireId, 'q1');

      expect(stats.totalResponses).toBe(3);
      expect(stats.answeredCount).toBe(2);
      expect(stats.skippedCount).toBe(1);
    });

    it('should calculate average attempts', async () => {
      const response1 = TestDataFactory.createValidResponse({
        questionnaireId,
        sessionId: 'session-1',
        answers: [
          { questionId: 'q1', value: 'A', answeredAt: new Date().toISOString(), attempts: 1 }
        ]
      });

      const response2 = TestDataFactory.createValidResponse({
        questionnaireId,
        sessionId: 'session-2',
        answers: [
          { questionId: 'q1', value: 'B', answeredAt: new Date().toISOString(), attempts: 3 }
        ]
      });

      await storage.saveResponse(response1);
      await storage.saveResponse(response2);

      const stats = await analytics.getQuestionStats(questionnaireId, 'q1');

      expect(stats.averageAttempts).toBe(2); // (1 + 3) / 2
    });

    it('should calculate average duration', async () => {
      const response1 = TestDataFactory.createValidResponse({
        questionnaireId,
        sessionId: 'session-1',
        answers: [
          { questionId: 'q1', value: 'A', answeredAt: new Date().toISOString(), duration: 5000 }
        ]
      });

      const response2 = TestDataFactory.createValidResponse({
        questionnaireId,
        sessionId: 'session-2',
        answers: [
          { questionId: 'q1', value: 'B', answeredAt: new Date().toISOString(), duration: 7000 }
        ]
      });

      await storage.saveResponse(response1);
      await storage.saveResponse(response2);

      const stats = await analytics.getQuestionStats(questionnaireId, 'q1');

      expect(stats.averageDuration).toBe(6000); // (5000 + 7000) / 2
    });

    it('should analyze response distribution', async () => {
      // Create responses with different values
      const values = ['Yes', 'Yes', 'No', 'Yes'];
      
      for (let i = 0; i < values.length; i++) {
        const response = TestDataFactory.createValidResponse({
          questionnaireId,
          sessionId: `session-${i}`,
          answers: [
            { questionId: 'q1', value: values[i], answeredAt: new Date().toISOString() }
          ]
        });
        await storage.saveResponse(response);
      }

      const stats = await analytics.getQuestionStats(questionnaireId, 'q1');

      expect(stats.responseDistribution.totalResponses).toBe(4);
      expect(stats.responseDistribution.uniqueValues).toBe(2);
      
      const yesDistribution = stats.responseDistribution.distribution.find(d => d.value === 'Yes');
      const noDistribution = stats.responseDistribution.distribution.find(d => d.value === 'No');
      
      expect(yesDistribution?.count).toBe(3);
      expect(yesDistribution?.percentage).toBe(75);
      expect(noDistribution?.count).toBe(1);
      expect(noDistribution?.percentage).toBe(25);
    });
  });
});
