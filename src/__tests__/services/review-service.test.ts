/**
 * ReviewService Tests
 */

import { describe, it, expect, beforeEach, afterEach } from '@jest/globals';
import { promises as fs } from 'fs';
import path from 'path';
import { ReviewService } from '../../core/services/review-service.js';
import { createStorageService } from '../../core/storage.js';
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
});
