/**
 * Backup Verification
 *
 * Verifies that a backup is complete and all files are valid JSON.
 */

import { promises as fs } from 'fs';
import path from 'path';
import type { BackupManifest, BackupVerificationResult } from './types.js';

/**
 * Verify a backup at the given path.
 */
export async function verifyBackup(backupPath: string): Promise<BackupVerificationResult> {
  const errors: string[] = [];
  const counts = { questionnaires: 0, responses: 0, sessions: 0 };
  let backupId = '';

  // Check manifest exists and is valid
  let manifest: BackupManifest;
  try {
    const data = await fs.readFile(path.join(backupPath, 'manifest.json'), 'utf-8');
    manifest = JSON.parse(data) as BackupManifest;
    backupId = manifest.backupId;

    if (!manifest.version || !manifest.backupId || !manifest.createdAt) {
      errors.push('Manifest is missing required fields');
    }
  } catch (err) {
    return {
      valid: false,
      backupId,
      counts,
      errors: [`Failed to read manifest: ${String(err)}`],
    };
  }

  // Verify each subdirectory's files
  const categories = ['questionnaires', 'responses', 'sessions'] as const;
  for (const category of categories) {
    const dirPath = path.join(backupPath, category);
    try {
      const files = await fs.readdir(dirPath);
      for (const file of files) {
        if (!file.endsWith('.json')) continue;
        try {
          const content = await fs.readFile(path.join(dirPath, file), 'utf-8');
          JSON.parse(content);
          counts[category]++;
        } catch (err) {
          errors.push(`Invalid JSON in ${category}/${file}: ${String(err)}`);
        }
      }
    } catch {
      // Directory may not exist if there were no items of this type
    }
  }

  // Compare counts with manifest
  if (counts.questionnaires !== manifest.counts.questionnaires) {
    errors.push(
      `Questionnaire count mismatch: manifest=${manifest.counts.questionnaires}, actual=${counts.questionnaires}`
    );
  }
  if (counts.responses !== manifest.counts.responses) {
    errors.push(
      `Response count mismatch: manifest=${manifest.counts.responses}, actual=${counts.responses}`
    );
  }
  if (counts.sessions !== manifest.counts.sessions) {
    errors.push(
      `Session count mismatch: manifest=${manifest.counts.sessions}, actual=${counts.sessions}`
    );
  }

  return {
    valid: errors.length === 0,
    backupId,
    counts,
    errors,
  };
}
