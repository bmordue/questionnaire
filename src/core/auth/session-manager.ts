/**
 * Web Session Manager
 *
 * Manages HTTP authentication sessions (separate from questionnaire sessions).
 * Sessions are stored as JSON files with expiration support.
 */

import path from 'path';
import crypto from 'crypto';
import { promises as fs } from 'fs';
import { FileOperations } from '../storage/file-operations.js';
import { globalWriteQueue } from '../concurrency/write-queue.js';

/** Default session lifetime: 24 hours */
const DEFAULT_SESSION_TTL_MS = 24 * 60 * 60 * 1000;
const SESSION_CLEANUP_INTERVAL_MS = 60 * 60 * 1000; // 1 hour

export interface AuthSession {
  /** Session token (used as cookie value) */
  token: string;
  /** Authenticated user ID */
  userId: string;
  /** User agent string */
  userAgent?: string;
  /** Client IP address */
  ipAddress?: string;
  /** Creation timestamp */
  createdAt: string;
  /** Last activity timestamp */
  lastAccessedAt: string;
  /** Expiry timestamp */
  expiresAt: string;
}

export class SessionManager {
  private readonly sessionsDir: string;
  private cleanupTimer: ReturnType<typeof setInterval> | null = null;

  constructor(dataDirectory: string) {
    this.sessionsDir = path.join(dataDirectory, 'auth-sessions');
  }

  async initialize(): Promise<void> {
    await FileOperations.ensureDirectory(this.sessionsDir);
    // Schedule periodic cleanup of expired sessions
    this.cleanupTimer = setInterval(() => {
      void this.cleanupExpiredSessions();
    }, SESSION_CLEANUP_INTERVAL_MS);
    // Don't block Node.js exit
    if (this.cleanupTimer.unref) this.cleanupTimer.unref();
  }

  /** Shut down the session manager, cancelling the cleanup timer. */
  shutdown(): void {
    if (this.cleanupTimer) {
      clearInterval(this.cleanupTimer);
      this.cleanupTimer = null;
    }
  }

  private filePath(token: string): string {
    // Use a hash of the token as the filename to avoid FS-unsafe characters
    const hash = crypto.createHash('sha256').update(token).digest('hex');
    return path.join(this.sessionsDir, `${hash}.json`);
  }

  /**
   * Create a new auth session for the given user.
   */
  async create(
    userId: string,
    opts: { userAgent?: string; ipAddress?: string; ttlMs?: number } = {},
  ): Promise<AuthSession> {
    const token = crypto.randomBytes(32).toString('hex');
    const now = new Date();
    const ttlMs = opts.ttlMs ?? DEFAULT_SESSION_TTL_MS;

    const session: AuthSession = {
      token,
      userId,
      createdAt: now.toISOString(),
      lastAccessedAt: now.toISOString(),
      expiresAt: new Date(now.getTime() + ttlMs).toISOString(),
    };

    if (opts.userAgent !== undefined) session.userAgent = opts.userAgent;
    if (opts.ipAddress !== undefined) session.ipAddress = opts.ipAddress;

    await FileOperations.atomicWrite(this.filePath(token), JSON.stringify(session, null, 2));
    return session;
  }

  /**
   * Look up an existing session and bump its lastAccessedAt.
   * Returns null if the session does not exist or has expired.
   */
  async get(token: string): Promise<AuthSession | null> {
    const fp = this.filePath(token);
    // Use the filename hash (which is the sha256 of the token) as the queue key
    // to avoid storing raw token values in queue keys and to match filePath() hashing.
    const queueKey = `auth-session:${crypto.createHash('sha256').update(token).digest('hex')}`;

    return globalWriteQueue.enqueue(queueKey, async () => {
      if (!(await FileOperations.exists(fp))) return null;

      try {
        const data = await FileOperations.safeRead(fp);
        const session = JSON.parse(data) as AuthSession;

        if (new Date(session.expiresAt) <= new Date()) {
          // Session has expired – delete it
          await FileOperations.delete(fp).catch(() => undefined);
          return null;
        }

        // Update lastAccessedAt
        const updated: AuthSession = {
          ...session,
          lastAccessedAt: new Date().toISOString(),
        };

        await FileOperations.atomicWrite(fp, JSON.stringify(updated, null, 2));

        return updated;
      } catch {
        return null;
      }
    });
  }

  /**
   * Delete a session (logout).
   */
  async destroy(token: string): Promise<void> {
    const fp = this.filePath(token);
    const queueKey = `auth-session:${crypto.createHash('sha256').update(token).digest('hex')}`;
    await globalWriteQueue.enqueue(queueKey, async () => {
      try {
        await FileOperations.delete(fp);
      } catch {
        // Ignore – session may already be gone
      }
    });
  }

  /**
   * Delete all sessions for a given user.
   */
  async destroyForUser(userId: string): Promise<number> {
    const files = await FileOperations.listFiles(this.sessionsDir, '.json');
    let count = 0;

    for (const file of files) {
      try {
        const fp = path.join(this.sessionsDir, file);
        const data = await FileOperations.safeRead(fp);
        const session = JSON.parse(data) as AuthSession;

        if (session.userId === userId) {
          await FileOperations.delete(fp);
          count++;
        }
      } catch {
        // Skip unreadable files
      }
    }

    return count;
  }

  /**
   * Remove expired sessions from disk.
   */
  async cleanupExpiredSessions(): Promise<number> {
    const files = await FileOperations.listFiles(this.sessionsDir, '.json');
    const now = new Date();
    let count = 0;

    for (const file of files) {
      try {
        const fp = path.join(this.sessionsDir, file);
        const data = await FileOperations.safeRead(fp);
        const session = JSON.parse(data) as AuthSession;

        if (new Date(session.expiresAt) <= now) {
          await FileOperations.delete(fp);
          count++;
        }
      } catch {
        // Skip unreadable files
      }
    }

    return count;
  }

  /**
   * List all active (non-expired) sessions for a user.
   */
  async listForUser(userId: string): Promise<AuthSession[]> {
    const files = await FileOperations.listFiles(this.sessionsDir, '.json');
    const now = new Date();
    const sessions: AuthSession[] = [];

    for (const file of files) {
      try {
        const fp = path.join(this.sessionsDir, file);
        const data = await fs.readFile(fp, 'utf8');
        const session = JSON.parse(data) as AuthSession;

        if (session.userId === userId && new Date(session.expiresAt) > now) {
          sessions.push(session);
        }
      } catch {
        // Skip
      }
    }

    return sessions;
  }
}
