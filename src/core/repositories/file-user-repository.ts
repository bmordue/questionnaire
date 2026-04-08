/**
 * File User Repository
 *
 * Stores user accounts as JSON files on the file system.
 * Each user occupies a separate file named by their ID.
 * An email → ID index file is maintained for fast lookup by email.
 */

import path from 'path';
import crypto from 'crypto';
import { UserSchema } from '../schemas/user.js';
import type { User } from '../schemas/user.js';
import { FileOperations } from '../storage/file-operations.js';
import { globalWriteQueue } from '../concurrency/write-queue.js';
import { EntityNotFoundError } from './interfaces.js';

const INDEX_FILE = 'email-index.json';
const TOKEN_INDEX_FILE = 'reset-token-index.json';
const QUEUE_KEY = 'users:index';

interface EmailIndex {
  [email: string]: string; // email → userId
}

interface ResetTokenIndex {
  [tokenHash: string]: { userId: string; expiresAt: string }; // tokenHash → { userId, expiresAt }
}

export interface UserRepositoryConfig {
  /** Base directory for data storage */
  dataDirectory: string;
}

export class FileUserRepository {
  private readonly usersDir: string;

  constructor(config: UserRepositoryConfig) {
    this.usersDir = path.join(config.dataDirectory, 'users');
  }

  async initialize(): Promise<void> {
    await FileOperations.ensureDirectory(this.usersDir);
    // Ensure the index file exists
    const indexPath = this.indexFilePath();
    if (!(await FileOperations.exists(indexPath))) {
      await FileOperations.atomicWrite(indexPath, JSON.stringify({}, null, 2));
    }
    // Ensure the reset token index file exists
    const tokenIndexPath = this.tokenIndexFilePath();
    if (!(await FileOperations.exists(tokenIndexPath))) {
      await FileOperations.atomicWrite(tokenIndexPath, JSON.stringify({}, null, 2));
    }
  }

  private filePath(userId: string): string {
    FileOperations.validateId(userId);
    return path.join(this.usersDir, `${userId}.json`);
  }

  private indexFilePath(): string {
    return path.join(this.usersDir, INDEX_FILE);
  }

  private tokenIndexFilePath(): string {
    return path.join(this.usersDir, TOKEN_INDEX_FILE);
  }

  private tokenHash(token: string): string {
    return crypto.createHash('sha256').update(token).digest('hex');
  }

  private async readIndex(): Promise<EmailIndex> {
    try {
      const data = await FileOperations.safeRead(this.indexFilePath());
      return JSON.parse(data) as EmailIndex;
    } catch {
      return {};
    }
  }

  private async writeIndex(index: EmailIndex): Promise<void> {
    await FileOperations.atomicWrite(this.indexFilePath(), JSON.stringify(index, null, 2));
  }

  private async readTokenIndex(): Promise<ResetTokenIndex> {
    try {
      const data = await FileOperations.safeRead(this.tokenIndexFilePath());
      return JSON.parse(data) as ResetTokenIndex;
    } catch {
      return {};
    }
  }

  private async writeTokenIndex(index: ResetTokenIndex): Promise<void> {
    await FileOperations.atomicWrite(this.tokenIndexFilePath(), JSON.stringify(index, null, 2));
  }

  // ── CRUD ─────────────────────────────────────────────────────────────────────

  async create(data: {
    email: string;
    passwordHash: string;
    name: string;
    role?: User['role'];
  }): Promise<User> {
    return globalWriteQueue.enqueue(QUEUE_KEY, async () => {
      const index = await this.readIndex();

      if (index[data.email.toLowerCase()]) {
        throw new Error(`User with email already exists: ${data.email}`);
      }

      const now = new Date().toISOString();
      const user: User = UserSchema.parse({
        id: `user-${crypto.randomBytes(8).toString('hex')}`,
        email: data.email.toLowerCase(),
        passwordHash: data.passwordHash,
        name: data.name,
        role: data.role ?? 'respondent',
        createdAt: now,
        updatedAt: now,
        active: true,
      });

      await FileOperations.atomicWrite(this.filePath(user.id), JSON.stringify(user, null, 2));

      index[user.email] = user.id;
      await this.writeIndex(index);

      return user;
    });
  }

  async findById(id: string): Promise<User | null> {
    const fp = this.filePath(id);
    if (!(await FileOperations.exists(fp))) return null;

    try {
      const data = await FileOperations.safeRead(fp);
      return UserSchema.parse(JSON.parse(data));
    } catch {
      return null;
    }
  }

  async findByEmail(email: string): Promise<User | null> {
    const index = await this.readIndex();
    const userId = index[email.toLowerCase()];
    if (!userId) return null;
    return this.findById(userId);
  }

  async findAll(): Promise<User[]> {
    const files = await FileOperations.listFiles(this.usersDir, '.json');
    const users: User[] = [];

    for (const file of files) {
      if (file === INDEX_FILE) continue;

      try {
        const data = await FileOperations.safeRead(path.join(this.usersDir, file));
        users.push(UserSchema.parse(JSON.parse(data)));
      } catch {
        // Skip unreadable files
      }
    }

    return users;
  }

  async update(id: string, data: Partial<User>): Promise<User> {
    return globalWriteQueue.enqueue(`user:${id}`, async () => {
      const existing = await this.findById(id);
      if (!existing) throw new EntityNotFoundError(`User not found: ${id}`, 'User', id);

      const emailChanged = data.email && data.email.toLowerCase() !== existing.email;

      const updated: User = UserSchema.parse({
        ...existing,
        ...data,
        id, // immutable
        email: data.email ? data.email.toLowerCase() : existing.email,
        updatedAt: new Date().toISOString(),
      });

      await FileOperations.atomicWrite(this.filePath(id), JSON.stringify(updated, null, 2));

      // Update email index if email changed
      if (emailChanged) {
        await globalWriteQueue.enqueue(QUEUE_KEY, async () => {
          const index = await this.readIndex();
          delete index[existing.email];
          index[updated.email] = id;
          await this.writeIndex(index);
        });
      }

      return updated;
    });
  }

  async delete(id: string): Promise<void> {
    return globalWriteQueue.enqueue(QUEUE_KEY, async () => {
      const existing = await this.findById(id);
      if (!existing) throw new EntityNotFoundError(`User not found: ${id}`, 'User', id);

      await FileOperations.delete(this.filePath(id));

      const index = await this.readIndex();
      delete index[existing.email];
      await this.writeIndex(index);
    });
  }

  async exists(id: string): Promise<boolean> {
    return FileOperations.exists(this.filePath(id));
  }

  async emailExists(email: string): Promise<boolean> {
    const index = await this.readIndex();
    return email.toLowerCase() in index;
  }

  /**
   * Look up a user by their password reset token (O(1) via token index).
   * Returns null if the token is not found, already expired, or invalid.
   */
  async findByResetToken(token: string): Promise<User | null> {
    const hash = this.tokenHash(token);
    const index = await this.readTokenIndex();
    const entry = index[hash];
    if (!entry) return null;
    if (new Date(entry.expiresAt) <= new Date()) return null;
    return this.findById(entry.userId);
  }

  /**
   * Set a password reset token for the user.
   * Token expires in the given number of minutes (default 60).
   */
  async setPasswordResetToken(
    userId: string,
    token: string,
    expiryMinutes = 60,
  ): Promise<User> {
    const expiry = new Date(Date.now() + expiryMinutes * 60 * 1000).toISOString();

    // Update the token index: remove the old token (if any) by reading it directly
    // from the user record (O(1) hash lookup) then insert the new one.
    await globalWriteQueue.enqueue(QUEUE_KEY, async () => {
      const existing = await this.findById(userId);
      const index = await this.readTokenIndex();

      // O(1) removal of old token using the hash stored on the user record
      if (existing?.passwordResetToken) {
        delete index[this.tokenHash(existing.passwordResetToken)];
      }

      index[this.tokenHash(token)] = { userId, expiresAt: expiry };
      await this.writeTokenIndex(index);
    });

    return this.update(userId, {
      passwordResetToken: token,
      passwordResetExpiry: expiry,
    });
  }

  /**
   * Clear a password reset token.
   */
  async clearPasswordResetToken(userId: string): Promise<User> {
    return globalWriteQueue.enqueue(`user:${userId}`, async () => {
      const existing = await this.findById(userId);
      if (!existing) throw new EntityNotFoundError(`User not found: ${userId}`, 'User', userId);

      // Remove from token index using the stored token (O(1) hash lookup)
      if (existing.passwordResetToken) {
        await globalWriteQueue.enqueue(QUEUE_KEY, async () => {
          const index = await this.readTokenIndex();
          delete index[this.tokenHash(existing.passwordResetToken!)];
          await this.writeTokenIndex(index);
        });
      }

      const updated: User = UserSchema.parse({
        ...existing,
        passwordResetToken: undefined,
        passwordResetExpiry: undefined,
        updatedAt: new Date().toISOString(),
      });

      await FileOperations.atomicWrite(this.filePath(userId), JSON.stringify(updated, null, 2));
      return updated;
    });
  }
}
