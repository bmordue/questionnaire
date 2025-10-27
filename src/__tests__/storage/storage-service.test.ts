/**
 * Storage Service Tests
 */

import { describe, it, expect, beforeEach, afterEach } from '@jest/globals';
import { promises as fs } from 'fs';
import path from 'path';
import { createStorageService } from '../../core/storage.js';
import { TestDataFactory } from '../helpers/test-data-factory.js';
import { ResponseStatus } from '../../core/schemas/response.js';
import type { StorageService } from '../../core/storage/types.js';

const TEST_DATA_DIR = path.join(process.cwd(), 'test-data', 'storage-service');

describe('StorageService', () => {
  let storage: StorageService;

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
      backupEnabled: true,
      maxBackups: 3,
      compressionEnabled: false,
      encryptionEnabled: false
    });
  });

  afterEach(async () => {
    // Clean up after tests
    try {
      await fs.rm(TEST_DATA_DIR, { recursive: true });
    } catch {
      // Ignore cleanup errors
    }
  });

  describe('Questionnaire Operations', () => {
    it('should save and load a questionnaire', async () => {
      const questionnaire = TestDataFactory.createValidQuestionnaire();

      await storage.saveQuestionnaire(questionnaire);
      const loaded = await storage.loadQuestionnaire(questionnaire.id);

      expect(loaded).toEqual(questionnaire);
    });

    it('should list all questionnaires', async () => {
      const q1 = TestDataFactory.createValidQuestionnaire({ id: 'q1' });
      const q2 = TestDataFactory.createValidQuestionnaire({ id: 'q2' });

      await storage.saveQuestionnaire(q1);
      await storage.saveQuestionnaire(q2);

      const list = await storage.listQuestionnaires();

      expect(list).toHaveLength(2);
      expect(list.map(q => q.id)).toContain('q1');
      expect(list.map(q => q.id)).toContain('q2');
    });

    it('should delete a questionnaire', async () => {
      const questionnaire = TestDataFactory.createValidQuestionnaire();

      await storage.saveQuestionnaire(questionnaire);
      await storage.deleteQuestionnaire(questionnaire.id);

      await expect(
        storage.loadQuestionnaire(questionnaire.id)
      ).rejects.toThrow();
    });

    it('should overwrite existing questionnaire', async () => {
      const questionnaire = TestDataFactory.createValidQuestionnaire();

      await storage.saveQuestionnaire(questionnaire);

      const updated = {
        ...questionnaire,
        metadata: {
          ...questionnaire.metadata,
          title: 'Updated Title'
        }
      };

      await storage.saveQuestionnaire(updated);
      const loaded = await storage.loadQuestionnaire(questionnaire.id);

      expect(loaded.metadata.title).toBe('Updated Title');
    });

    it('should validate questionnaire on save', async () => {
      const invalid = {
        id: 'test',
        // Missing required fields
      };

      await expect(
        storage.saveQuestionnaire(invalid as any)
      ).rejects.toThrow();
    });

    it('should validate questionnaire on load', async () => {
      const questionnaire = TestDataFactory.createValidQuestionnaire();
      await storage.saveQuestionnaire(questionnaire);

      // Manually corrupt the file
      const filePath = path.join(TEST_DATA_DIR, 'questionnaires', `${questionnaire.id}.json`);
      await fs.writeFile(filePath, '{"id": "test"}', 'utf8');

      await expect(
        storage.loadQuestionnaire(questionnaire.id)
      ).rejects.toThrow();
    });
  });

  describe('Response Operations', () => {
    it('should save and load a response', async () => {
      const response = TestDataFactory.createValidResponse();

      await storage.saveResponse(response);
      const loaded = await storage.loadResponse(response.sessionId);

      expect(loaded).toEqual(response);
    });

    it('should list all responses', async () => {
      const r1 = TestDataFactory.createValidResponse({ sessionId: 's1' });
      const r2 = TestDataFactory.createValidResponse({ sessionId: 's2' });

      await storage.saveResponse(r1);
      await storage.saveResponse(r2);

      const list = await storage.listResponses();

      expect(list).toHaveLength(2);
      expect(list.map(r => r.sessionId)).toContain('s1');
      expect(list.map(r => r.sessionId)).toContain('s2');
    });

    it('should filter responses by questionnaire ID', async () => {
      const r1 = TestDataFactory.createValidResponse({
        sessionId: 's1',
        questionnaireId: 'q1'
      });
      const r2 = TestDataFactory.createValidResponse({
        sessionId: 's2',
        questionnaireId: 'q2'
      });

      await storage.saveResponse(r1);
      await storage.saveResponse(r2);

      const list = await storage.listResponses('q1');

      expect(list).toHaveLength(1);
      expect(list[0]?.sessionId).toBe('s1');
    });

    it('should delete a response', async () => {
      const response = TestDataFactory.createValidResponse();

      await storage.saveResponse(response);
      await storage.deleteResponse(response.sessionId);

      await expect(
        storage.loadResponse(response.sessionId)
      ).rejects.toThrow();
    });

    it('should update response progress', async () => {
      const response = TestDataFactory.createValidResponse();

      await storage.saveResponse(response);

      const updated = {
        ...response,
        progress: {
          ...response.progress,
          currentQuestionIndex: 1,
          answeredCount: 1
        }
      };

      await storage.saveResponse(updated);
      const loaded = await storage.loadResponse(response.sessionId);

      expect(loaded.progress.currentQuestionIndex).toBe(1);
      expect(loaded.progress.answeredCount).toBe(1);
    });
  });

  describe('Session Operations', () => {
    it('should create a session', async () => {
      const questionnaire = TestDataFactory.createValidQuestionnaire();
      await storage.saveQuestionnaire(questionnaire);

      const sessionId = await storage.createSession(questionnaire.id);

      expect(sessionId).toMatch(/^session-\d+-[a-f0-9]{16}$/);

      const session = await storage.loadSession(sessionId);
      expect(session.questionnaireId).toBe(questionnaire.id);
      expect(session.status).toBe('active');
    });

    it('should create initial response when creating session', async () => {
      const questionnaire = TestDataFactory.createValidQuestionnaire();
      await storage.saveQuestionnaire(questionnaire);

      const sessionId = await storage.createSession(questionnaire.id);

      const response = await storage.loadResponse(sessionId);
      expect(response.questionnaireId).toBe(questionnaire.id);
      expect(response.sessionId).toBe(sessionId);
      expect(response.status).toBe(ResponseStatus.IN_PROGRESS);
    });

    it('should update session status', async () => {
      const questionnaire = TestDataFactory.createValidQuestionnaire();
      await storage.saveQuestionnaire(questionnaire);

      const sessionId = await storage.createSession(questionnaire.id);

      await storage.updateSession(sessionId, { status: 'completed' });

      const session = await storage.loadSession(sessionId);
      expect(session.status).toBe('completed');
    });

    it('should list active sessions', async () => {
      const questionnaire = TestDataFactory.createValidQuestionnaire();
      await storage.saveQuestionnaire(questionnaire);

      const s1 = await storage.createSession(questionnaire.id);
      const s2 = await storage.createSession(questionnaire.id);

      await storage.updateSession(s2, { status: 'completed' });

      const activeSessions = await storage.listActiveSessions();

      expect(activeSessions).toHaveLength(1);
      expect(activeSessions[0]?.sessionId).toBe(s1);
    });

    it('should delete a session', async () => {
      const questionnaire = TestDataFactory.createValidQuestionnaire();
      await storage.saveQuestionnaire(questionnaire);

      const sessionId = await storage.createSession(questionnaire.id);

      await storage.deleteSession(sessionId);

      await expect(
        storage.loadSession(sessionId)
      ).rejects.toThrow();
    });

    it('should throw error when creating session for non-existent questionnaire', async () => {
      await expect(
        storage.createSession('non-existent-id')
      ).rejects.toThrow();
    });

    it('should update session metadata', async () => {
      const questionnaire = TestDataFactory.createValidQuestionnaire();
      await storage.saveQuestionnaire(questionnaire);

      const sessionId = await storage.createSession(questionnaire.id);

      await storage.updateSession(sessionId, {
        metadata: { userAgent: 'test-browser' }
      });

      const session = await storage.loadSession(sessionId);
      expect(session.metadata?.userAgent).toBe('test-browser');
    });

    it('should cleanup old abandoned sessions', async () => {
      const questionnaire = TestDataFactory.createValidQuestionnaire();
      await storage.saveQuestionnaire(questionnaire);

      const sessionId = await storage.createSession(questionnaire.id);

      // Mark session as abandoned
      await storage.updateSession(sessionId, { status: 'abandoned' });

      // Perform cleanup (this will test the cleanup method)
      await storage.cleanup();

      // Session should still exist (not old enough)
      const session = await storage.loadSession(sessionId);
      expect(session).toBeDefined();
    });
  });

  describe('Data Integrity', () => {
    it('should create backup when overwriting questionnaire', async () => {
      const questionnaire = TestDataFactory.createValidQuestionnaire();

      await storage.saveQuestionnaire(questionnaire);

      const updated = {
        ...questionnaire,
        metadata: {
          ...questionnaire.metadata,
          title: 'Updated'
        }
      };

      await storage.saveQuestionnaire(updated);

      // Check that backup file exists
      const qDir = path.join(TEST_DATA_DIR, 'questionnaires');
      const files = await fs.readdir(qDir);
      const backups = files.filter(f => f.includes('.backup.'));

      expect(backups.length).toBeGreaterThan(0);
    });

    it('should create backup when overwriting response', async () => {
      const response = TestDataFactory.createValidResponse();

      await storage.saveResponse(response);

      const updated = {
        ...response,
        status: ResponseStatus.COMPLETED
      };

      await storage.saveResponse(updated);

      // Check that backup file exists
      const rDir = path.join(TEST_DATA_DIR, 'responses');
      const files = await fs.readdir(rDir);
      const backups = files.filter(f => f.includes('.backup.'));

      expect(backups.length).toBeGreaterThan(0);
    });

    it('should handle concurrent saves gracefully', async () => {
      const response1 = TestDataFactory.createValidResponse({ sessionId: 's1' });
      const response2 = TestDataFactory.createValidResponse({ sessionId: 's2' });

      // Simulate concurrent saves of different responses (not the same one)
      await Promise.all([
        storage.saveResponse(response1),
        storage.saveResponse(response2)
      ]);

      // Both saves should succeed
      const loaded1 = await storage.loadResponse('s1');
      const loaded2 = await storage.loadResponse('s2');
      
      expect(loaded1).toBeDefined();
      expect(loaded2).toBeDefined();
      expect(loaded1.sessionId).toBe('s1');
      expect(loaded2.sessionId).toBe('s2');
    });
  });

  describe('Error Handling', () => {
    it('should throw error when loading non-existent questionnaire', async () => {
      await expect(
        storage.loadQuestionnaire('non-existent')
      ).rejects.toThrow(/File not found/);
    });

    it('should throw error when loading non-existent response', async () => {
      await expect(
        storage.loadResponse('non-existent')
      ).rejects.toThrow(/File not found/);
    });

    it('should throw error when loading non-existent session', async () => {
      await expect(
        storage.loadSession('non-existent')
      ).rejects.toThrow(/File not found/);
    });

    it('should handle corrupted JSON files', async () => {
      const questionnaire = TestDataFactory.createValidQuestionnaire();
      await storage.saveQuestionnaire(questionnaire);

      // Corrupt the file
      const filePath = path.join(TEST_DATA_DIR, 'questionnaires', `${questionnaire.id}.json`);
      await fs.writeFile(filePath, 'invalid json{', 'utf8');

      await expect(
        storage.loadQuestionnaire(questionnaire.id)
      ).rejects.toThrow();
    });
  });

  describe('Directory Structure', () => {
    it('should create proper directory structure on initialization', async () => {
      const qDir = path.join(TEST_DATA_DIR, 'questionnaires');
      const rDir = path.join(TEST_DATA_DIR, 'responses');
      const sDir = path.join(TEST_DATA_DIR, 'sessions');

      const [qExists, rExists, sExists] = await Promise.all([
        fs.access(qDir).then(() => true).catch(() => false),
        fs.access(rDir).then(() => true).catch(() => false),
        fs.access(sDir).then(() => true).catch(() => false)
      ]);

      expect(qExists).toBe(true);
      expect(rExists).toBe(true);
      expect(sExists).toBe(true);
    });
  });
});
