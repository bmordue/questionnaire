import { describe, it, expect, beforeEach } from '@jest/globals';
import { BackendStorageService } from '../../core/storage/backend-storage-service.js';
import { LocalStorageBackend } from '../../core/storage/backend.js';
import { FileOperationError } from '../../core/storage/file-operations.js';
import path from 'path';
import os from 'os';
import { promises as fs } from 'fs';

describe('BackendStorageService Path Traversal Protection', () => {
  let tempDir: string;
  let service: BackendStorageService;

  beforeEach(async () => {
    tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'backend-traversal-test-'));
    const backend = new LocalStorageBackend(tempDir);
    service = new BackendStorageService({ backend });
  });

  const unsafeIds = ['..', '../etc/passwd', 'sub/dir', 'id with spaces'];

  describe('Questionnaire operations', () => {
    it('should reject unsafe IDs in loadQuestionnaire', async () => {
      for (const id of unsafeIds) {
        await expect(service.loadQuestionnaire(id)).rejects.toThrow(FileOperationError);
      }
    });

    it('should reject unsafe IDs in saveQuestionnaire', async () => {
      for (const id of unsafeIds) {
        const q: any = {
          id,
          version: '1.0',
          metadata: { title: 'Test', createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() },
          questions: [{ id: 'q1', type: 'text', text: 'Q1' }]
        };
        await expect(service.saveQuestionnaire(q)).rejects.toThrow(FileOperationError);
      }
    });

    it('should reject unsafe IDs in deleteQuestionnaire', async () => {
      for (const id of unsafeIds) {
        await expect(service.deleteQuestionnaire(id)).rejects.toThrow(FileOperationError);
      }
    });
  });

  describe('Response operations', () => {
    it('should reject unsafe IDs in loadResponse', async () => {
      for (const id of unsafeIds) {
        await expect(service.loadResponse(id)).rejects.toThrow(FileOperationError);
      }
    });

    it('should reject unsafe IDs in saveResponse', async () => {
      for (const id of unsafeIds) {
        const r: any = {
          id: 'res-1',
          sessionId: id,
          questionnaireId: 'q1',
          questionnaireVersion: '1.0',
          startedAt: new Date().toISOString(),
          status: 'in_progress',
          answers: [],
          progress: { currentQuestionIndex: 0, totalQuestions: 1, answeredCount: 0 }
        };
        await expect(service.saveResponse(r)).rejects.toThrow(FileOperationError);
      }
    });

    it('should reject unsafe IDs in deleteResponse', async () => {
      for (const id of unsafeIds) {
        await expect(service.deleteResponse(id)).rejects.toThrow(FileOperationError);
      }
    });
  });

  describe('Session operations', () => {
    it('should reject unsafe questionnaireId in createSession', async () => {
      for (const id of unsafeIds) {
        await expect(service.createSession(id)).rejects.toThrow(FileOperationError);
      }
    });

    it('should reject unsafe sessionId in loadSession', async () => {
      for (const id of unsafeIds) {
        await expect(service.loadSession(id)).rejects.toThrow(FileOperationError);
      }
    });

    it('should reject unsafe sessionId in updateSession', async () => {
      for (const id of unsafeIds) {
        await expect(service.updateSession(id, {})).rejects.toThrow(FileOperationError);
      }
    });

    it('should reject unsafe sessionId in deleteSession', async () => {
      for (const id of unsafeIds) {
        await expect(service.deleteSession(id)).rejects.toThrow(FileOperationError);
      }
    });
  });

  describe('Maintenance operations', () => {
    it('should reject unsafe IDs in cleanupBackups', async () => {
      for (const id of unsafeIds) {
        await expect(service.cleanupBackups(id, 'safe-q')).rejects.toThrow(FileOperationError);
        await expect(service.cleanupBackups('safe-s', id)).rejects.toThrow(FileOperationError);
      }
    });
  });
});
