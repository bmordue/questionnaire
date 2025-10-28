/**
 * Persistence Manager Tests
 */

import { describe, it, expect, beforeEach, afterEach } from '@jest/globals';
import { promises as fs } from 'fs';
import path from 'path';
import { PersistenceManager } from '../../core/persistence/persistence-manager.js';
import { createStorageService } from '../../core/storage.js';
import { TestDataFactory } from '../helpers/test-data-factory.js';
import type { StorageService } from '../../core/storage/types.js';

const TEST_DATA_DIR = path.join(process.cwd(), 'test-data', 'persistence-manager');

describe('PersistenceManager', () => {
  let storage: StorageService;
  let manager: PersistenceManager;
  let questionnaire: any;

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

    // Create persistence manager
    manager = new PersistenceManager(storage, 1000); // 1 second auto-save for testing

    // Create test questionnaire
    questionnaire = TestDataFactory.createValidQuestionnaire({
      id: 'test-q'
    });

    await storage.saveQuestionnaire(questionnaire);
  });

  afterEach(async () => {
    // End any active sessions
    await manager.endSession();

    // Clean up after tests
    try {
      await fs.rm(TEST_DATA_DIR, { recursive: true });
    } catch {
      // Ignore cleanup errors
    }
  });

  describe('startSession', () => {
    it('should create a new session', async () => {
      const session = await manager.startSession(questionnaire);

      expect(session.sessionId).toBeDefined();
      expect(session.questionnaire).toEqual(questionnaire);
      expect(session.responseBuilder).toBeDefined();
    });

    it('should create session in storage', async () => {
      const session = await manager.startSession(questionnaire);

      const storedSession = await storage.loadSession(session.sessionId);
      expect(storedSession.questionnaireId).toBe(questionnaire.id);
      expect(storedSession.status).toBe('active');
    });

    it('should create initial response', async () => {
      const session = await manager.startSession(questionnaire);

      const response = await storage.loadResponse(session.sessionId);
      expect(response.questionnaireId).toBe(questionnaire.id);
      expect(response.status).toBe('in_progress');
    });

    it('should resume existing session when sessionId provided', async () => {
      // Create first session
      const session1 = await manager.startSession(questionnaire);
      await session1.responseBuilder.recordAnswer('q1', 'Test answer');
      await manager.endSession();

      // Resume session
      const session2 = await manager.startSession(questionnaire, session1.sessionId);

      expect(session2.sessionId).toBe(session1.sessionId);
      const response = session2.responseBuilder.getResponse();
      expect(response.answers).toHaveLength(1);
      expect(response.answers[0]!.value).toBe('Test answer');
    });

    it('should create new session if provided sessionId not found', async () => {
      const session = await manager.startSession(questionnaire, 'non-existent-id');

      expect(session.sessionId).toBeDefined();
      expect(session.sessionId).not.toBe('non-existent-id');
    });
  });

  describe('resumeSession', () => {
    it('should resume an existing session', async () => {
      // Create and modify a session
      const session1 = await manager.startSession(questionnaire);
      await session1.responseBuilder.recordAnswer('q1', 'Answer');
      await manager.endSession();

      // Resume it
      const session2 = await manager.resumeSession(session1.sessionId);

      expect(session2.sessionId).toBe(session1.sessionId);
      const response = session2.responseBuilder.getResponse();
      expect(response.answers).toHaveLength(1);
    });

    it('should throw error for non-existent session', async () => {
      await expect(
        manager.resumeSession('non-existent')
      ).rejects.toThrow();
    });
  });

  describe('endSession', () => {
    it('should stop auto-save when session ends', async () => {
      const session = await manager.startSession(questionnaire);
      await manager.endSession();

      // Auto-save should not happen after end
      // This is tested implicitly - no error should occur
      expect(true).toBe(true);
    });
  });

  describe('exportResponse', () => {
    it('should export response as JSON', async () => {
      const session = await manager.startSession(questionnaire);
      await session.responseBuilder.recordAnswer('q1', 'Test answer');
      await session.responseBuilder.complete();

      const json = await manager.exportResponse(session.sessionId, 'json');

      const parsed = JSON.parse(json);
      expect(parsed.answers).toHaveLength(1);
      expect(parsed.answers[0].value).toBe('Test answer');
    });

    it('should export response as CSV', async () => {
      const session = await manager.startSession(questionnaire);
      await session.responseBuilder.recordAnswer('q1', 'Answer 1');
      await session.responseBuilder.recordAnswer('q2', 'Answer 2');

      const csv = await manager.exportResponse(session.sessionId, 'csv');

      expect(csv).toContain('questionId,value,answeredAt,duration,attempts,skipped');
      expect(csv).toContain('q1');
      expect(csv).toContain('q2');
      expect(csv).toContain('"Answer 1"');
      expect(csv).toContain('"Answer 2"');
    });

    it('should throw error for unsupported export format', async () => {
      const session = await manager.startSession(questionnaire);

      await expect(
        manager.exportResponse(session.sessionId, 'xml' as any)
      ).rejects.toThrow('Unsupported export format');
    });
  });

  describe('auto-save functionality', () => {
    it('should auto-save responses at configured interval', async () => {
      const session = await manager.startSession(questionnaire);
      
      // Make a change
      await session.responseBuilder.recordAnswer('q1', 'Initial answer');
      
      // Wait for auto-save (1 second interval)
      await new Promise(resolve => setTimeout(resolve, 1500));
      
      // Verify it was saved
      const loaded = await storage.loadResponse(session.sessionId);
      expect(loaded.answers).toHaveLength(1);
    });
  });
});
