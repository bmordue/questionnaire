/**
 * File Lock
 *
 * Advisory file locking using lock files with timeout and stale lock detection.
 */

import { promises as fs } from 'fs';
import path from 'path';

/** Default lock timeout in milliseconds */
const DEFAULT_TIMEOUT_MS = 5000;

/** Default stale lock age in milliseconds (locks older than this are considered stale) */
const STALE_LOCK_AGE_MS = 30000;

/** Retry interval in milliseconds */
const RETRY_INTERVAL_MS = 50;

export class LockTimeoutError extends Error {
  constructor(
    public readonly resourceId: string,
    public readonly timeoutMs: number,
  ) {
    super(`Lock acquisition timed out after ${timeoutMs}ms for resource: ${resourceId}`);
    this.name = 'LockTimeoutError';
  }
}

interface LockMetadata {
  pid: number;
  acquiredAt: string;
  resourceId: string;
}

/**
 * Acquire an advisory file lock for the given path.
 * Returns a release function that must be called when the lock is no longer needed.
 */
export async function acquireLock(
  filePath: string,
  timeoutMs = DEFAULT_TIMEOUT_MS,
): Promise<() => Promise<void>> {
  const lockPath = `${filePath}.lock`;
  const deadline = Date.now() + timeoutMs;

  while (Date.now() < deadline) {
    try {
      // Try to create the lock file exclusively
      const metadata: LockMetadata = {
        pid: process.pid,
        acquiredAt: new Date().toISOString(),
        resourceId: filePath,
      };
      await fs.writeFile(lockPath, JSON.stringify(metadata), { flag: 'wx' });

      // Lock acquired – return a release function
      return async () => {
        try {
          await fs.unlink(lockPath);
        } catch {
          // Ignore errors when releasing; the lock may have already expired
        }
      };
    } catch (err) {
      if ((err as NodeJS.ErrnoException).code !== 'EEXIST') {
        throw err;
      }

      // Check if the existing lock is stale
      const isStale = await isLockStale(lockPath);
      if (isStale) {
        try {
          await fs.unlink(lockPath);
        } catch {
          // Another process may have already cleaned it up – continue retrying
        }
        continue;
      }

      // Wait before retrying
      await sleep(RETRY_INTERVAL_MS);
    }
  }

  throw new LockTimeoutError(filePath, timeoutMs);
}

/**
 * Execute a function while holding a file lock on the given path.
 */
export async function withLock<T>(
  filePath: string,
  fn: () => Promise<T>,
  timeoutMs = DEFAULT_TIMEOUT_MS,
): Promise<T> {
  const release = await acquireLock(filePath, timeoutMs);
  try {
    return await fn();
  } finally {
    await release();
  }
}

async function isLockStale(lockPath: string): Promise<boolean> {
  try {
    const stat = await fs.stat(lockPath);
    const ageMs = Date.now() - stat.mtimeMs;
    if (ageMs > STALE_LOCK_AGE_MS) {
      return true;
    }

    // Also check the metadata if readable
    try {
      const content = await fs.readFile(lockPath, 'utf8');
      const metadata = JSON.parse(content) as LockMetadata;
      const lockAge = Date.now() - new Date(metadata.acquiredAt).getTime();
      return lockAge > STALE_LOCK_AGE_MS;
    } catch {
      // If we can't parse the lock file, use the file mtime
      return false;
    }
  } catch {
    // If we can't stat the lock file, assume it's gone
    return true;
  }
}

function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * Clean up any stale lock files in a directory.
 */
export async function cleanupStaleLocks(dirPath: string): Promise<number> {
  let count = 0;
  try {
    const files = await fs.readdir(dirPath);
    for (const file of files) {
      if (!file.endsWith('.lock')) continue;
      const lockPath = path.join(dirPath, file);
      const stale = await isLockStale(lockPath);
      if (stale) {
        try {
          await fs.unlink(lockPath);
          count++;
        } catch {
          // Ignore
        }
      }
    }
  } catch {
    // Ignore directory read errors
  }
  return count;
}
