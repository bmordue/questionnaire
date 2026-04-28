/**
 * Backup Scheduler
 *
 * Runs the backup service on a configurable interval.
 */

import type { BackupResult } from './types.js';
import type { BackupService } from './backup-service.js';

export class BackupScheduler {
  private readonly backupService: BackupService;
  private readonly intervalMs: number;
  private timer: ReturnType<typeof setInterval> | null = null;

  constructor(backupService: BackupService, intervalMs: number) {
    this.backupService = backupService;
    this.intervalMs = intervalMs;
  }

  /** Start scheduled backups. */
  start(): void {
    if (this.timer) return;
    this.timer = setInterval(() => {
      void this.runBackup();
    }, this.intervalMs);
  }

  /** Stop scheduled backups. */
  stop(): void {
    if (this.timer) {
      clearInterval(this.timer);
      this.timer = null;
    }
  }

  /** Check if the scheduler is running. */
  isRunning(): boolean {
    return this.timer !== null;
  }

  /** Trigger a backup immediately. */
  async triggerNow(): Promise<BackupResult> {
    return this.runBackup();
  }

  private async runBackup(): Promise<BackupResult> {
    try {
      const result = await this.backupService.createBackup();
      if (result.success) {
        console.log(`Backup ${result.backupId} completed successfully`);
      } else {
        console.error(`Backup ${result.backupId} failed: ${result.errors.join(', ')}`);
      }
      return result;
    } catch (err) {
      console.error(`Backup error: ${String(err)}`);
      throw err;
    }
  }
}
