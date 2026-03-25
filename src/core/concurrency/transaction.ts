/**
 * Transaction Support
 *
 * Implements a simple unit-of-work pattern backed by the existing backup system.
 * On rollback, backup files created during the transaction are restored.
 */

import { promises as fs } from 'fs';
import path from 'path';
import { FileOperations } from '../storage/file-operations.js';

export class TransactionError extends Error {
  constructor(
    message: string,
    public readonly cause?: unknown,
  ) {
    super(message);
    this.name = 'TransactionError';
  }
}

interface TransactionEntry {
  filePath: string;
  backupPath: string | null;
}

/**
 * A simple file-based transaction.
 *
 * Before each write, create a backup of the current file (if it exists).
 * On commit, the transaction is done – backups are discarded.
 * On rollback, original files are restored from their backups.
 *
 * Usage:
 *   const tx = new FileTransaction();
 *   await tx.writeFile(path1, data1);
 *   await tx.writeFile(path2, data2);
 *   await tx.commit();   // or tx.rollback() on error
 */
export class FileTransaction {
  private readonly entries: TransactionEntry[] = [];
  private committed = false;
  private rolledBack = false;

  /**
   * Atomically write a file within this transaction.
   * The previous content (if any) is saved as a backup before overwriting.
   */
  async writeFile(filePath: string, data: string): Promise<void> {
    this.assertActive();

    let backupPath: string | null = null;

    // Back up the current file if it exists
    const exists = await FileOperations.exists(filePath);
    if (exists) {
      backupPath = await FileOperations.createBackup(filePath);
    }

    this.entries.push({ filePath, backupPath });

    await FileOperations.atomicWrite(filePath, data);
  }

  /**
   * Delete a file within this transaction, saving a backup for rollback.
   */
  async deleteFile(filePath: string): Promise<void> {
    this.assertActive();

    let backupPath: string | null = null;

    const exists = await FileOperations.exists(filePath);
    if (exists) {
      backupPath = await FileOperations.createBackup(filePath);
    }

    this.entries.push({ filePath, backupPath });

    if (exists) {
      await FileOperations.delete(filePath);
    }
  }

  /**
   * Commit the transaction – discard all backups.
   */
  async commit(): Promise<void> {
    this.assertActive();
    this.committed = true;

    // Remove backup files created during this transaction
    for (const entry of this.entries) {
      if (entry.backupPath) {
        try {
          await FileOperations.delete(entry.backupPath);
        } catch {
          // Non-fatal: backups may already have been cleaned up
        }
      }
    }
  }

  /**
   * Roll back the transaction – restore all files from backups.
   */
  async rollback(): Promise<void> {
    this.assertActive();
    this.rolledBack = true;

    const errors: string[] = [];

    // Restore in reverse order
    for (const entry of [...this.entries].reverse()) {
      try {
        if (entry.backupPath) {
          // Restore from backup
          const backupData = await fs.readFile(entry.backupPath, 'utf8');
          await FileOperations.atomicWrite(entry.filePath, backupData);
          await FileOperations.delete(entry.backupPath);
        } else {
          // File didn't exist before the transaction – delete what was written
          await FileOperations.delete(entry.filePath);
        }
      } catch (err) {
        errors.push(
          `Failed to restore ${entry.filePath}: ${err instanceof Error ? err.message : String(err)}`,
        );
      }
    }

    if (errors.length > 0) {
      throw new TransactionError(`Rollback completed with errors:\n${errors.join('\n')}`);
    }
  }

  private assertActive(): void {
    if (this.committed) throw new TransactionError('Transaction already committed');
    if (this.rolledBack) throw new TransactionError('Transaction already rolled back');
  }
}

/**
 * Execute a transactional block. Automatically rolls back on error.
 */
export async function withTransaction<T>(
  fn: (tx: FileTransaction) => Promise<T>,
): Promise<T> {
  const tx = new FileTransaction();
  try {
    const result = await fn(tx);
    await tx.commit();
    return result;
  } catch (err) {
    try {
      await tx.rollback();
    } catch (rollbackErr) {
      // Log rollback failure but throw the original error
      console.error('Transaction rollback failed:', rollbackErr);
    }
    throw err;
  }
}
