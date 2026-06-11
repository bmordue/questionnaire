/**
 * ReviewService Tests
 */

import { describe, it, expect, beforeEach, afterEach } from '@jest/globals';
import { promises as fs } from 'fs';
import path from 'path';
import { ReviewService } from '../../core/services/review-service.js';
import { createStorageService } from '../../core/storage/index.js';
import type { StorageService } from '../../core/storage/types.js';
import { TestDataFactory } from '../helpers/test-data-factory.js';

const TEST_DIR = path.join(process.cwd(), 'test-data', 'review-service');

describe('ReviewService', () => {
  let storage: StorageService;
  let service: ReviewService;

  beforeEach(async () => {
    await fs.rm(TEST_DIR, { recursive: true, force: true });
    storage = await createStorageService({ dataDirectory: TEST_DIR });
    service = new ReviewService(storage);
  });

  afterEach(async () => {
    await fs.rm(TEST_DIR, { recursive: true, force: true });
  });

  it('returns zero stats when no responses exist', async () => {
    const questionnaire = TestDataFactory.createValidQuestionnaire();
    await storage.saveQuestionnaire(questionnaire);

    const stats = await service.getCompletionStats(questionnaire.id);
    expect(stats.totalResponses).toBe(0);
    expect(stats.completionRate).toBe(0);
    expect(stats.averageCompletionTimeMs).toBeNull();
  });

  it('exports to JSON correctly', async () => {
    const questionnaire = TestDataFactory.createValidQuestionnaire();
    await storage.saveQuestionnaire(questionnaire);

    const sessionId = await storage.createSession(questionnaire.id);
    const response = await storage.loadResponse(sessionId);
    response.status = 'completed' as any;
    response.completedAt = new Date().toISOString();
    await storage.saveResponse(response);

    const json = await service.exportToJson(questionnaire.id);
    const parsed = JSON.parse(json);
    expect(Array.isArray(parsed)).toBe(true);
    expect(parsed.length).toBe(1);
  });

  it('exports to CSV correctly', async () => {
    const questionnaire = TestDataFactory.createValidQuestionnaire();
    await storage.saveQuestionnaire(questionnaire);

    const sessionId = await storage.createSession(questionnaire.id);
    const response = await storage.loadResponse(sessionId);
    response.status = 'completed' as any;
    response.completedAt = new Date().toISOString();
    await storage.saveResponse(response);

    const csv = await service.exportToCsv(questionnaire.id);
    expect(typeof csv).toBe('string');
    expect(csv).toContain('sessionId');
  });

  it('calculates numeric statistics for number questions', async () => {
    const questionnaire = TestDataFactory.createValidQuestionnaire();
    questionnaire.questions = [
      {
        id: 'q1',
        type: 'number' as any,
        text: 'Age',
        required: true,
      },
    ];
    await storage.saveQuestionnaire(questionnaire);

    // Response 1: Value 20
    const s1 = await storage.createSession(questionnaire.id);
    const r1 = await storage.loadResponse(s1);
    r1.answers = [
      {
        questionId: 'q1',
        value: 20,
        answeredAt: new Date().toISOString(),
      },
    ];
    await storage.saveResponse(r1);

    // Response 2: Value 40
    const s2 = await storage.createSession(questionnaire.id);
    const r2 = await storage.loadResponse(s2);
    r2.answers = [
      {
        questionId: 'q1',
        value: 40,
        answeredAt: new Date().toISOString(),
      },
    ];
    await storage.saveResponse(r2);

    const summary = await service.getSummary(questionnaire.id);
    const qStats = summary.questions.find(q => q.questionId === 'q1');

    expect(qStats).toBeDefined();
    expect(qStats?.average).toBe(30);
    expect(qStats?.min).toBe(20);
    expect(qStats?.max).toBe(40);
  });

  it('calculates numeric statistics for rating questions', async () => {
    const questionnaire = TestDataFactory.createValidQuestionnaire();
    questionnaire.questions = [
      {
        id: 'r1',
        type: 'rating' as any,
        text: 'Score',
        required: true,
        validation: { min: 1, max: 5 },
      },
    ];
    await storage.saveQuestionnaire(questionnaire);

    const values = [1, 3, 5];
    for (const val of values) {
      const sid = await storage.createSession(questionnaire.id);
      const resp = await storage.loadResponse(sid);
      resp.answers = [
        {
          questionId: 'r1',
          value: val,
          answeredAt: new Date().toISOString(),
        },
      ];
      await storage.saveResponse(resp);
    }

    const summary = await service.getSummary(questionnaire.id);
    const qStats = summary.questions.find(q => q.questionId === 'r1');

    expect(qStats).toBeDefined();
    expect(qStats?.average).toBe(3);
    expect(qStats?.min).toBe(1);
    expect(qStats?.max).toBe(5);
  });
});
