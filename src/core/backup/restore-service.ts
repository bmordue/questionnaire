/**
 * Restore Service
 *
 * Restores data from a backup into a StorageService.
 */

import { promises as fs } from 'fs';
import path from 'path';
import type { StorageService } from '../storage/types.js';
import type { BackupManifest, RestoreResult } from './types.js';
import type { Questionnaire, QuestionnaireResponse } from '../schema.js';

export class RestoreService {
  private readonly backupDirectory: string;

  constructor(backupDirectory: string) {
    this.backupDirectory = backupDirectory;
  }

  /**
   * Restore all data from a backup into the given storage service.
   */
  async restoreFromBackup(backupId: string, storageService: StorageService): Promise<RestoreResult> {
    const backupPath = path.join(this.backupDirectory, backupId);
    const errors: string[] = [];
    const counts = { questionnaires: 0, responses: 0, sessions: 0 };

    // Read manifest
    let manifest: BackupManifest;
    try {
      const data = await fs.readFile(path.join(backupPath, 'manifest.json'), 'utf-8');
      manifest = JSON.parse(data) as BackupManifest;
    } catch (err) {
      return {
        success: false,
        backupId,
        counts,
        errors: [`Failed to read manifest: ${String(err)}`],
      };
    }

    // Restore questionnaires
    try {
      const qDir = path.join(backupPath, 'questionnaires');
      const files = await fs.readdir(qDir);
      for (const file of files) {
        if (!file.endsWith('.json')) continue;
        try {
          const content = await fs.readFile(path.join(qDir, file), 'utf-8');
          const questionnaire = JSON.parse(content) as Questionnaire;
          await storageService.saveQuestionnaire(questionnaire);
          counts.questionnaires++;
        } catch (err) {
          errors.push(`Failed to restore questionnaire ${file}: ${String(err)}`);
        }
      }
    } catch {
      // No questionnaires directory
    }

    // Restore responses
    try {
      const rDir = path.join(backupPath, 'responses');
      const files = await fs.readdir(rDir);
      for (const file of files) {
        if (!file.endsWith('.json')) continue;
        try {
          const content = await fs.readFile(path.join(rDir, file), 'utf-8');
          const response = JSON.parse(content) as QuestionnaireResponse;
          await storageService.saveResponse(response);
          counts.responses++;
        } catch (err) {
          errors.push(`Failed to restore response ${file}: ${String(err)}`);
        }
      }
    } catch {
      // No responses directory
    }

    // Restore sessions by writing files directly to the sessions directory.
    // The StorageService.createSession() generates a new sessionId which would
    // not match the backed-up sessionId, so we write session files directly.
    try {
      const sDir = path.join(backupPath, 'sessions');
      const files = await fs.readdir(sDir);
      const sessionsDir = path.join(storageService.getDataDirectory(), 'sessions');
      await fs.mkdir(sessionsDir, { recursive: true });
      for (const file of files) {
        if (!file.endsWith('.json')) continue;
        try {
          const content = await fs.readFile(path.join(sDir, file), 'utf-8');
          JSON.parse(content); // Validate JSON
          await fs.writeFile(path.join(sessionsDir, file), content, 'utf-8');
          counts.sessions++;
        } catch (err) {
          errors.push(`Failed to restore session ${file}: ${String(err)}`);
        }
      }
    } catch {
      // No sessions directory
    }

    return {
      success: errors.length === 0,
      backupId: manifest.backupId,
      counts,
      errors,
    };
  }
}
