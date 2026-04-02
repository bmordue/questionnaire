/**
 * BackendStorageService Tests
 *
 * Tests that BackendStorageService (backed by LocalStorageBackend) matches
 * the StorageService contract, including validation, list behaviour, session
 * creation, and error mapping.
 */

import { describe, it, expect, beforeEach, afterEach, jest } from '@jest/globals';
import { promises as fs } from 'fs';
import os from 'os';
import path from 'path';

import { LocalStorageBackend } from '../../core/storage/backend.js';
import { BackendStorageService } from '../../core/storage/backend-storage-service.js';
import { TestDataFactory } from '../helpers/test-data-factory.js';
import type { StorageService } from '../../core/storage/types.js';

async function makeTmpDir(): Promise<string> {
  return fs.mkdtemp(path.join(os.tmpdir(), 'bss-test-'));
}

describe('BackendStorageService', () => {
  let tmpDir: string;
  let storage: StorageService;

  beforeEach(async () => {
    tmpDir = await makeTmpDir();
    const backend = new LocalStorageBackend(tmpDir);
    storage = new BackendStorageService({ backend });
  });

  afterEach(async () => {
    await fs.rm(tmpDir, { recursive: true, force: true });
  });

  // ── Questionnaire operations ───────────────────────────────────────────────

  describe('Questionnaire operations', () => {
    it('saves and loads a questionnaire', async () => {
      const q = TestDataFactory.createValidQuestionnaire();
      await storage.saveQuestionnaire(q);
      const loaded = await storage.loadQuestionnaire(q.id);
      expect(loaded).toEqual(q);
    });

    it('overwrites an existing questionnaire', async () => {
      const q = TestDataFactory.createValidQuestionnaire();
      await storage.saveQuestionnaire(q);
      const updated = { ...q, metadata: { ...q.metadata, title: 'Updated' } };
      await storage.saveQuestionnaire(updated);
      const loaded = await storage.loadQuestionnaire(q.id);
      expect(loaded.metadata.title).toBe('Updated');
    });

    it('validates questionnaire on save', async () => {
      const invalid = { id: 'bad' };
      await expect(storage.saveQuestionnaire(invalid as never)).rejects.toThrow();
    });

    it('validates questionnaire on load', async () => {
      const q = TestDataFactory.createValidQuestionnaire();
      await storage.saveQuestionnaire(q);
      // Corrupt the stored data
      await fs.writeFile(path.join(tmpDir, 'questionnaires', `${q.id}.json`), '{"id":"bad"}', 'utf8');
      await expect(storage.loadQuestionnaire(q.id)).rejects.toThrow();
    });

    it('lists all questionnaires', async () => {
      const q1 = TestDataFactory.createValidQuestionnaire({ id: 'q1' });
      const q2 = TestDataFactory.createValidQuestionnaire({ id: 'q2' });
      await storage.saveQuestionnaire(q1);
      await storage.saveQuestionnaire(q2);
      const list = await storage.listQuestionnaires();
      expect(list).toHaveLength(2);
      expect(list.map(q => q.id)).toContain('q1');
      expect(list.map(q => q.id)).toContain('q2');
    });

    it('skips and warns for unreadable questionnaire entries', async () => {
      const warnSpy = jest.spyOn(console, 'warn').mockImplementation(() => {});
      try {
        const q = TestDataFactory.createValidQuestionnaire();
        await storage.saveQuestionnaire(q);
        // Corrupt the stored file
        await fs.writeFile(path.join(tmpDir, 'questionnaires', `${q.id}.json`), 'not-json', 'utf8');
        const list = await storage.listQuestionnaires();
        expect(list).toHaveLength(0);
        expect(warnSpy).toHaveBeenCalledWith(
          expect.stringContaining(`questionnaires/${q.id}.json`),
          expect.any(SyntaxError)
        );
      } finally {
        warnSpy.mockRestore();
      }
    });

    it('deletes a questionnaire', async () => {
      const q = TestDataFactory.createValidQuestionnaire();
      await storage.saveQuestionnaire(q);
      await storage.deleteQuestionnaire(q.id);
      await expect(storage.loadQuestionnaire(q.id)).rejects.toThrow();
    });

    it('throws when loading a missing questionnaire', async () => {
      await expect(storage.loadQuestionnaire('does-not-exist')).rejects.toThrow();
    });
  });

  // ── Response operations ────────────────────────────────────────────────────

  describe('Response operations', () => {
    it('saves and loads a response', async () => {
      const r = TestDataFactory.createValidResponse();
      await storage.saveResponse(r);
      const loaded = await storage.loadResponse(r.sessionId);
      expect(loaded).toEqual(r);
    });

    it('validates response on save', async () => {
      const invalid = { sessionId: 'x' };
      await expect(storage.saveResponse(invalid as never)).rejects.toThrow();
    });

    it('validates response on load', async () => {
      const r = TestDataFactory.createValidResponse();
      await storage.saveResponse(r);
      await fs.writeFile(path.join(tmpDir, 'responses', `${r.sessionId}.json`), '{"sessionId":"x"}', 'utf8');
      await expect(storage.loadResponse(r.sessionId)).rejects.toThrow();
    });

    it('lists all responses', async () => {
      const r1 = TestDataFactory.createValidResponse({ sessionId: 'sess-1', id: 'r1' });
      const r2 = TestDataFactory.createValidResponse({ sessionId: 'sess-2', id: 'r2', questionnaireId: 'other-q' });
      await storage.saveResponse(r1);
      await storage.saveResponse(r2);
      const all = await storage.listResponses();
      expect(all).toHaveLength(2);
    });

    it('filters responses by questionnaireId', async () => {
      const r1 = TestDataFactory.createValidResponse({ sessionId: 'sess-1', id: 'r1', questionnaireId: 'qA' });
      const r2 = TestDataFactory.createValidResponse({ sessionId: 'sess-2', id: 'r2', questionnaireId: 'qB' });
      await storage.saveResponse(r1);
      await storage.saveResponse(r2);
      const filtered = await storage.listResponses('qA');
      expect(filtered).toHaveLength(1);
      const first = filtered[0];
      expect(first?.sessionId).toBe('sess-1');
    });

    it('skips and warns for unreadable response entries', async () => {
      const warnSpy = jest.spyOn(console, 'warn').mockImplementation(() => {});
      try {
        const r = TestDataFactory.createValidResponse();
        await storage.saveResponse(r);
        await fs.writeFile(path.join(tmpDir, 'responses', `${r.sessionId}.json`), 'bad-json', 'utf8');
        const list = await storage.listResponses();
        expect(list).toHaveLength(0);
        expect(warnSpy).toHaveBeenCalledWith(
          'BackendStorageService: failed to read or parse response',
          expect.objectContaining({ key: `responses/${r.sessionId}.json`, error: expect.any(SyntaxError) })
        );
      } finally {
        warnSpy.mockRestore();
      }
    });

    it('deletes a response', async () => {
      const r = TestDataFactory.createValidResponse();
      await storage.saveResponse(r);
      await storage.deleteResponse(r.sessionId);
      await expect(storage.loadResponse(r.sessionId)).rejects.toThrow();
    });
  });

  // ── Session operations ─────────────────────────────────────────────────────

  describe('Session operations', () => {
    it('creates a session and returns a session id', async () => {
      const q = TestDataFactory.createValidQuestionnaire();
      await storage.saveQuestionnaire(q);
      const sessionId = await storage.createSession(q.id);
      expect(typeof sessionId).toBe('string');
      expect(sessionId.length).toBeGreaterThan(0);
    });

    it('throws when creating a session for a missing questionnaire', async () => {
      await expect(storage.createSession('no-such-questionnaire')).rejects.toThrow();
    });

    it('loads a created session', async () => {
      const q = TestDataFactory.createValidQuestionnaire();
      await storage.saveQuestionnaire(q);
      const sessionId = await storage.createSession(q.id);
      const session = await storage.loadSession(sessionId);
      expect(session.sessionId).toBe(sessionId);
      expect(session.questionnaireId).toBe(q.id);
      expect(session.status).toBe('active');
    });

    it('updates a session', async () => {
      const q = TestDataFactory.createValidQuestionnaire();
      await storage.saveQuestionnaire(q);
      const sessionId = await storage.createSession(q.id);
      await storage.updateSession(sessionId, { status: 'completed' });
      const updated = await storage.loadSession(sessionId);
      expect(updated.status).toBe('completed');
    });

    it('lists active sessions', async () => {
      const q = TestDataFactory.createValidQuestionnaire();
      await storage.saveQuestionnaire(q);
      const s1 = await storage.createSession(q.id);
      const s2 = await storage.createSession(q.id);
      await storage.updateSession(s2, { status: 'completed' });
      const active = await storage.listActiveSessions();
      expect(active.map(s => s.sessionId)).toContain(s1);
      expect(active.map(s => s.sessionId)).not.toContain(s2);
    });

    it('skips and warns for unreadable session entries', async () => {
      const warnSpy = jest.spyOn(console, 'warn').mockImplementation(() => {});
      try {
        const q = TestDataFactory.createValidQuestionnaire();
        await storage.saveQuestionnaire(q);
        const sessionId = await storage.createSession(q.id);
        await fs.writeFile(path.join(tmpDir, 'sessions', `${sessionId}.json`), 'bad', 'utf8');
        const active = await storage.listActiveSessions();
        expect(active.map(s => s.sessionId)).not.toContain(sessionId);
        expect(warnSpy).toHaveBeenCalledWith(
          expect.stringContaining(sessionId),
          expect.any(SyntaxError)
        );
      } finally {
        warnSpy.mockRestore();
      }
    });

    it('deletes a session', async () => {
      const q = TestDataFactory.createValidQuestionnaire();
      await storage.saveQuestionnaire(q);
      const sessionId = await storage.createSession(q.id);
      await storage.deleteSession(sessionId);
      await expect(storage.loadSession(sessionId)).rejects.toThrow();
    });
  });

  // ── Maintenance operations ─────────────────────────────────────────────────

  describe('Maintenance operations', () => {
    it('cleanup() resolves without error', async () => {
      await expect(storage.cleanup()).resolves.not.toThrow();
    });

    it('cleanupBackups() returns zero deletions', async () => {
      const result = await storage.cleanupBackups('sess-1', 'q-1');
      expect(result.deletedCount).toBe(0);
      expect(result.errors).toHaveLength(0);
    });

    it('getDataDirectory() returns the backend-managed marker', () => {
      expect(storage.getDataDirectory()).toBe('(backend-managed)');
    });

    it('getConfig() returns a config object', () => {
      const cfg = storage.getConfig();
      expect(typeof cfg.dataDirectory).toBe('string');
    });
  });
});
