/**
 * Backup System Tests
 */

import { describe, it, expect, beforeEach, afterEach, jest } from '@jest/globals';
import { promises as fs } from 'fs';
import path from 'path';
import { createStorageService } from '../../core/storage.js';
import { TestDataFactory } from '../helpers/test-data-factory.js';
import { BackupService } from '../../core/backup/backup-service.js';
import { verifyBackup } from '../../core/backup/backup-verification.js';
import { RestoreService } from '../../core/backup/restore-service.js';
import { BackupScheduler } from '../../core/backup/backup-scheduler.js';
import type { StorageService } from '../../core/storage/types.js';
import type { BackupConfig } from '../../core/backup/types.js';

const TEST_BASE_DIR = path.join(process.cwd(), 'test-data', 'backup-tests');
let testCounter = 0;

function getTestDirs() {
  testCounter++;
  const suffix = `${Date.now()}-${testCounter}`;
  return {
    dataDir: path.join(TEST_BASE_DIR, `data-${suffix}`),
    backupDir: path.join(TEST_BASE_DIR, `backups-${suffix}`),
  };
}

describe('Backup System', () => {
  let storage: StorageService;
  let backupService: BackupService;
  let config: BackupConfig;
  let dirs: { dataDir: string; backupDir: string };

  beforeEach(async () => {
    dirs = getTestDirs();

    storage = await createStorageService({
      dataDirectory: dirs.dataDir,
      backupEnabled: false,
      maxBackups: 3,
      compressionEnabled: false,
      encryptionEnabled: false,
    });

    config = {
      maxBackups: 3,
      backupDirectory: dirs.backupDir,
      verifyAfterCreate: false,
    };

    backupService = new BackupService(storage, config);
  });

  afterEach(async () => {
    try {
      await fs.rm(TEST_BASE_DIR, { recursive: true });
    } catch {
      // Ignore cleanup errors
    }
  });

  describe('BackupService', () => {
    it('should create a backup with empty storage', async () => {
      const result = await backupService.createBackup();

      expect(result.success).toBe(true);
      expect(result.backupId).toMatch(/^backup-\d+-[0-9a-f]+$/);
      expect(result.counts.questionnaires).toBe(0);
      expect(result.counts.responses).toBe(0);
      expect(result.counts.sessions).toBe(0);
      expect(result.errors).toHaveLength(0);
    });

    it('should backup questionnaires', async () => {
      const q = TestDataFactory.createValidQuestionnaire({ id: 'q1' });
      await storage.saveQuestionnaire(q);

      const result = await backupService.createBackup();

      expect(result.success).toBe(true);
      expect(result.counts.questionnaires).toBe(1);

      // Verify the file exists
      const files = await fs.readdir(path.join(result.backupPath, 'questionnaires'));
      expect(files).toContain('q1.json');
    });

    it('should backup responses', async () => {
      const q = TestDataFactory.createValidQuestionnaire({ id: 'resp-q1' });
      await storage.saveQuestionnaire(q);
      const response = TestDataFactory.createValidResponse({
        questionnaireId: 'resp-q1',
        sessionId: 'sess-1',
      });
      await storage.saveResponse(response);

      const result = await backupService.createBackup();

      expect(result.success).toBe(true);
      expect(result.counts.responses).toBe(1);
    });

    it('should backup active sessions', async () => {
      const q = TestDataFactory.createValidQuestionnaire({ id: 'sess-q1' });
      await storage.saveQuestionnaire(q);
      await storage.createSession('sess-q1');

      const result = await backupService.createBackup();

      expect(result.success).toBe(true);
      expect(result.counts.sessions).toBe(1);
    });

    it('should write a valid manifest', async () => {
      const q = TestDataFactory.createValidQuestionnaire({ id: 'manifest-q1' });
      await storage.saveQuestionnaire(q);

      const result = await backupService.createBackup();
      const manifestData = await fs.readFile(
        path.join(result.backupPath, 'manifest.json'),
        'utf-8'
      );
      const manifest = JSON.parse(manifestData);

      expect(manifest.version).toBe('1.0.0');
      expect(manifest.backupId).toBe(result.backupId);
      expect(manifest.counts.questionnaires).toBe(1);
    });

    it('should list backups sorted newest first', async () => {
      await backupService.createBackup();
      // Small delay to ensure different timestamps
      await new Promise(r => setTimeout(r, 20));
      await backupService.createBackup();

      const list = await backupService.listBackups();

      expect(list).toHaveLength(2);
      expect(new Date(list[0]!.createdAt).getTime()).toBeGreaterThanOrEqual(
        new Date(list[1]!.createdAt).getTime()
      );
    });

    it('should delete a backup', async () => {
      const result = await backupService.createBackup();
      await backupService.deleteBackup(result.backupId);

      const list = await backupService.listBackups();
      expect(list).toHaveLength(0);
    });

    it('should cleanup old backups beyond maxBackups', async () => {
      config.maxBackups = 2;
      backupService = new BackupService(storage, config);

      await backupService.createBackup();
      await new Promise(r => setTimeout(r, 20));
      await backupService.createBackup();
      await new Promise(r => setTimeout(r, 20));
      await backupService.createBackup();

      const list = await backupService.listBackups();
      expect(list).toHaveLength(2);
    });

    it('should return empty list when backup directory does not exist', async () => {
      const list = await backupService.listBackups();
      expect(list).toEqual([]);
    });
  });

  describe('Backup Verification', () => {
    it('should verify a valid backup', async () => {
      const q = TestDataFactory.createValidQuestionnaire({ id: 'verify-q1' });
      await storage.saveQuestionnaire(q);

      const result = await backupService.createBackup();
      const verification = await verifyBackup(result.backupPath);

      expect(verification.valid).toBe(true);
      expect(verification.backupId).toBe(result.backupId);
      expect(verification.counts.questionnaires).toBe(1);
      expect(verification.errors).toHaveLength(0);
    });

    it('should detect missing manifest', async () => {
      const backupPath = path.join(dirs.backupDir, 'fake-backup');
      await fs.mkdir(backupPath, { recursive: true });

      const verification = await verifyBackup(backupPath);

      expect(verification.valid).toBe(false);
      expect(verification.errors.length).toBeGreaterThan(0);
    });

    it('should detect count mismatch', async () => {
      const q = TestDataFactory.createValidQuestionnaire({ id: 'mismatch-q1' });
      await storage.saveQuestionnaire(q);

      const result = await backupService.createBackup();

      // Tamper with the manifest to create a count mismatch
      const manifestPath = path.join(result.backupPath, 'manifest.json');
      const manifest = JSON.parse(await fs.readFile(manifestPath, 'utf-8'));
      manifest.counts.questionnaires = 99;
      await fs.writeFile(manifestPath, JSON.stringify(manifest), 'utf-8');

      const verification = await verifyBackup(result.backupPath);

      expect(verification.valid).toBe(false);
      expect(verification.errors.some(e => e.includes('count mismatch'))).toBe(true);
    });

    it('should detect invalid JSON files', async () => {
      const result = await backupService.createBackup();

      // Write invalid JSON into the backup
      await fs.writeFile(
        path.join(result.backupPath, 'questionnaires', 'bad.json'),
        'not json',
        'utf-8'
      );

      const verification = await verifyBackup(result.backupPath);

      expect(verification.valid).toBe(false);
      expect(verification.errors.some(e => e.includes('Invalid JSON'))).toBe(true);
    });
  });

  describe('RestoreService', () => {
    it('should restore questionnaires from backup', async () => {
      const q = TestDataFactory.createValidQuestionnaire({ id: 'restore-q1' });
      await storage.saveQuestionnaire(q);

      const backupResult = await backupService.createBackup();

      // Delete original data
      await storage.deleteQuestionnaire('restore-q1');

      // Restore
      const restoreService = new RestoreService(dirs.backupDir);
      const restoreResult = await restoreService.restoreFromBackup(
        backupResult.backupId,
        storage
      );

      expect(restoreResult.success).toBe(true);
      expect(restoreResult.counts.questionnaires).toBe(1);

      // Verify data was restored
      const loaded = await storage.loadQuestionnaire('restore-q1');
      expect(loaded.id).toBe('restore-q1');
    });

    it('should restore responses from backup', async () => {
      const q = TestDataFactory.createValidQuestionnaire({ id: 'restore-resp-q1' });
      await storage.saveQuestionnaire(q);
      const response = TestDataFactory.createValidResponse({
        questionnaireId: 'restore-resp-q1',
        sessionId: 'restore-sess-1',
      });
      await storage.saveResponse(response);

      const backupResult = await backupService.createBackup();

      await storage.deleteResponse('restore-sess-1');

      const restoreService = new RestoreService(dirs.backupDir);
      const restoreResult = await restoreService.restoreFromBackup(
        backupResult.backupId,
        storage
      );

      expect(restoreResult.success).toBe(true);
      expect(restoreResult.counts.responses).toBe(1);
    });

    it('should fail gracefully for missing backup', async () => {
      const restoreService = new RestoreService(dirs.backupDir);
      const result = await restoreService.restoreFromBackup('nonexistent', storage);

      expect(result.success).toBe(false);
      expect(result.errors.length).toBeGreaterThan(0);
    });
  });

  describe('BackupScheduler', () => {
    it('should start and stop', () => {
      const scheduler = new BackupScheduler(backupService, 60000);

      expect(scheduler.isRunning()).toBe(false);
      scheduler.start();
      expect(scheduler.isRunning()).toBe(true);
      scheduler.stop();
      expect(scheduler.isRunning()).toBe(false);
    });

    it('should not start twice', () => {
      const scheduler = new BackupScheduler(backupService, 60000);
      scheduler.start();
      scheduler.start(); // Should be a no-op
      expect(scheduler.isRunning()).toBe(true);
      scheduler.stop();
    });

    it('should trigger a backup immediately', async () => {
      const scheduler = new BackupScheduler(backupService, 60000);
      const result = await scheduler.triggerNow();

      expect(result.success).toBe(true);
      expect(result.backupId).toMatch(/^backup-\d+-[0-9a-f]+$/);
    });

    it('should run scheduled backups', async () => {
      const scheduler = new BackupScheduler(backupService, 50);
      scheduler.start();

      // Wait for at least one interval to fire
      await new Promise(r => setTimeout(r, 200));
      scheduler.stop();

      const list = await backupService.listBackups();
      expect(list.length).toBeGreaterThanOrEqual(1);
    });
  });
});
