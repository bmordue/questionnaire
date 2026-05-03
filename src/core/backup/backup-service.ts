/**
 * Backup Service
 *
 * Creates full snapshots of all data from a StorageService,
 * manages backup lifecycle, and cleans up old backups.
 */

import { promises as fs } from 'fs';
import path from 'path';
import crypto from 'crypto';
import type { StorageService } from '../storage/types.js';
import type { BackupConfig, BackupResult, BackupManifest } from './types.js';
import { verifyBackup } from './backup-verification.js';

export class BackupService {
  private readonly storageService: StorageService;
  private readonly config: BackupConfig;

  constructor(storageService: StorageService, config: BackupConfig) {
    this.storageService = storageService;
    this.config = config;
  }

  /**
   * Create a full backup of all data.
   */
  async createBackup(): Promise<BackupResult> {
    const timestamp = Date.now();
    const suffix = crypto.randomBytes(4).toString('hex');
    const backupId = `backup-${timestamp}-${suffix}`;
    const backupPath = path.join(this.config.backupDirectory, backupId);
    const errors: string[] = [];

    const counts = { questionnaires: 0, responses: 0, sessions: 0 };

    try {
      // Create backup directory structure
      await fs.mkdir(path.join(backupPath, 'questionnaires'), { recursive: true });
      await fs.mkdir(path.join(backupPath, 'responses'), { recursive: true });
      await fs.mkdir(path.join(backupPath, 'sessions'), { recursive: true });

      // Back up questionnaires
      try {
        const questionnaires = await this.storageService.listQuestionnaires();
        for (const listing of questionnaires) {
          try {
            const questionnaire = await this.storageService.loadQuestionnaire(listing.id);
            const filePath = path.join(backupPath, 'questionnaires', `${listing.id}.json`);
            await fs.writeFile(filePath, JSON.stringify(questionnaire, null, 2), 'utf-8');
            counts.questionnaires++;
          } catch (err) {
            errors.push(`Failed to backup questionnaire ${listing.id}: ${String(err)}`);
          }
        }
      } catch (err) {
        errors.push(`Failed to list questionnaires: ${String(err)}`);
      }

      // Back up responses
      try {
        const responses = await this.storageService.listResponses();
        for (const response of responses) {
          try {
            const filePath = path.join(backupPath, 'responses', `${response.sessionId}.json`);
            await fs.writeFile(filePath, JSON.stringify(response, null, 2), 'utf-8');
            counts.responses++;
          } catch (err) {
            errors.push(`Failed to backup response ${response.sessionId}: ${String(err)}`);
          }
        }
      } catch (err) {
        errors.push(`Failed to list responses: ${String(err)}`);
      }

      // Back up sessions
      try {
        const sessions = await this.storageService.listActiveSessions();
        for (const session of sessions) {
          try {
            const filePath = path.join(backupPath, 'sessions', `${session.sessionId}.json`);
            await fs.writeFile(filePath, JSON.stringify(session, null, 2), 'utf-8');
            counts.sessions++;
          } catch (err) {
            errors.push(`Failed to backup session ${session.sessionId}: ${String(err)}`);
          }
        }
      } catch (err) {
        errors.push(`Failed to list sessions: ${String(err)}`);
      }

      // Write manifest
      const manifest: BackupManifest = {
        version: '1.0.0',
        backupId,
        createdAt: new Date(timestamp).toISOString(),
        sourceDirectory: this.storageService.getDataDirectory(),
        counts,
      };
      await fs.writeFile(
        path.join(backupPath, 'manifest.json'),
        JSON.stringify(manifest, null, 2),
        'utf-8'
      );

      // Clean up old backups
      await this.cleanupOldBackups();

      // Verify if configured
      if (this.config.verifyAfterCreate) {
        const verification = await verifyBackup(backupPath);
        if (!verification.valid) {
          errors.push(...verification.errors.map(e => `Verification: ${e}`));
        }
      }

      return {
        success: errors.length === 0,
        backupId,
        backupPath,
        createdAt: manifest.createdAt,
        counts,
        errors,
      };
    } catch (err) {
      return {
        success: false,
        backupId,
        backupPath,
        createdAt: new Date(timestamp).toISOString(),
        counts,
        errors: [...errors, `Backup failed: ${String(err)}`],
      };
    }
  }

  /**
   * List all available backups, sorted newest first.
   */
  async listBackups(): Promise<BackupManifest[]> {
    const manifests: BackupManifest[] = [];

    try {
      await fs.access(this.config.backupDirectory);
    } catch {
      return manifests;
    }

    const entries = await fs.readdir(this.config.backupDirectory, { withFileTypes: true });
    const backupDirs = entries
      .filter(e => e.isDirectory() && e.name.startsWith('backup-'))
      .map(e => e.name);

    for (const dir of backupDirs) {
      try {
        const manifestPath = path.join(this.config.backupDirectory, dir, 'manifest.json');
        const data = await fs.readFile(manifestPath, 'utf-8');
        manifests.push(JSON.parse(data) as BackupManifest);
      } catch {
        // Skip directories without valid manifests
      }
    }

    manifests.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
    return manifests;
  }

  /**
   * Delete a specific backup by ID.
   */
  async deleteBackup(backupId: string): Promise<void> {
    const backupPath = path.join(this.config.backupDirectory, backupId);
    await fs.rm(backupPath, { recursive: true });
  }

  /**
   * Remove oldest backups when count exceeds maxBackups.
   */
  private async cleanupOldBackups(): Promise<void> {
    const manifests = await this.listBackups();
    if (manifests.length <= this.config.maxBackups) return;

    const toDelete = manifests.slice(this.config.maxBackups);
    for (const manifest of toDelete) {
      try {
        await this.deleteBackup(manifest.backupId);
      } catch (err) {
        console.error(`Failed to delete old backup ${manifest.backupId}: ${String(err)}`);
      }
    }
  }
}
