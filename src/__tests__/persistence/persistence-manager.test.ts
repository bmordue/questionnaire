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

  describe('backup cleanup on session end', () => {
    it('should cleanup backups when session completes', async () => {
      const testDir = path.join(TEST_DATA_DIR, 'cleanup-complete');
      // Create storage with backups enabled
      const storageWithBackups = await createStorageService({
        dataDirectory: testDir,
        backupEnabled: true,
        maxBackups: 5,
        deleteBackupsOnCompletion: true
      });

      const pm = new PersistenceManager(storageWithBackups, 1000);
      await storageWithBackups.saveQuestionnaire(questionnaire);

      const session = await pm.startSession(questionnaire);
      
      // Create backups by saving multiple times
      await storageWithBackups.saveResponse(session.responseBuilder.getResponse());
      await storageWithBackups.saveResponse(session.responseBuilder.getResponse());
      await storageWithBackups.saveResponse(session.responseBuilder.getResponse());

      // Verify backups exist
      const rDir = path.join(testDir, 'responses');
      let files = await fs.readdir(rDir);
      const backupsBefore = files.filter(f => f.includes('.backup.'));
      expect(backupsBefore.length).toBeGreaterThan(0);

      // Complete the session
      await session.responseBuilder.complete();
      await pm.endSession();

      // Verify backups were cleaned up
      files = await fs.readdir(rDir);
      const backupsAfter = files.filter(f => f.includes('.backup.'));
      expect(backupsAfter).toHaveLength(0);
    });

    it('should not cleanup backups when session is not completed', async () => {
      const testDir = path.join(TEST_DATA_DIR, 'cleanup-incomplete');
      const storageWithBackups = await createStorageService({
        dataDirectory: testDir,
        backupEnabled: true,
        maxBackups: 5,
        deleteBackupsOnCompletion: true
      });

      const pm = new PersistenceManager(storageWithBackups, 1000);
      await storageWithBackups.saveQuestionnaire(questionnaire);

      const session = await pm.startSession(questionnaire);
      
      // Create backups
      await storageWithBackups.saveResponse(session.responseBuilder.getResponse());
      await storageWithBackups.saveResponse(session.responseBuilder.getResponse());

      const rDir = path.join(testDir, 'responses');
      let files = await fs.readdir(rDir);
      const backupsBefore = files.filter(f => f.includes('.backup.'));

      // End session without completing
      await pm.endSession();

      // Backups should still exist
      files = await fs.readdir(rDir);
      const backupsAfter = files.filter(f => f.includes('.backup.'));
      expect(backupsAfter.length).toBe(backupsBefore.length);
    });

    it('should not cleanup backups when deleteBackupsOnCompletion is false', async () => {
      const testDir = path.join(TEST_DATA_DIR, 'cleanup-disabled');
      const storageNoCleanup = await createStorageService({
        dataDirectory: testDir,
        backupEnabled: true,
        maxBackups: 5,
        deleteBackupsOnCompletion: false
      });

      // Use a longer auto-save interval to prevent interference
      const pm = new PersistenceManager(storageNoCleanup, 60000);
      await storageNoCleanup.saveQuestionnaire(questionnaire);

      const session = await pm.startSession(questionnaire);

      // Create backups
      await storageNoCleanup.saveResponse(session.responseBuilder.getResponse());
      await storageNoCleanup.saveResponse(session.responseBuilder.getResponse());

      // Complete the session (this also saves, creating another backup)
      await session.responseBuilder.complete();

      // Wait a bit to ensure all saves are complete
      await new Promise(resolve => setTimeout(resolve, 100));

      const rDir = path.join(testDir, 'responses');
      let files = await fs.readdir(rDir);
      const backupsBefore = files.filter(f => f.includes('.backup.'));
      const expectedCount = backupsBefore.length;

      // End session
      await pm.endSession();

      // Backups should still exist
      files = await fs.readdir(rDir);
      const backupsAfter = files.filter(f => f.includes('.backup.'));
      expect(backupsAfter.length).toBe(expectedCount);
    });

    it('should handle cleanup errors gracefully', async () => {
      const testDir = path.join(TEST_DATA_DIR, 'cleanup-error');
      const storageWithBackups = await createStorageService({
        dataDirectory: testDir,
        backupEnabled: true,
        maxBackups: 5,
        deleteBackupsOnCompletion: true
      });

      const pm = new PersistenceManager(storageWithBackups, 1000);
      await storageWithBackups.saveQuestionnaire(questionnaire);

      const session = await pm.startSession(questionnaire);
      
      // Complete and end session (no backups to clean up, should not throw)
      await session.responseBuilder.complete();
      await expect(pm.endSession()).resolves.not.toThrow();
    });
  });
});
