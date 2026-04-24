/**
 * File User Repository
 *
 * Stores user profiles as JSON files on the file system.
 * Each user occupies a separate file named by their ID.
 * An email → ID index file is maintained for fast lookup by email.
 *
 * No passwords are stored here — authentication is handled by Authelia.
 * Users are provisioned just-in-time via findOrCreate().
 */

import path from 'path';
import crypto from 'crypto';
import { UserSchema } from '../schemas/user.js';
import type { User } from '../schemas/user.js';
import { FileOperations } from '../storage/file-operations.js';
import { globalWriteQueue } from '../concurrency/write-queue.js';
import { EntityNotFoundError } from './interfaces.js';

const INDEX_FILE = 'email-index.json';
const QUEUE_KEY = 'users:index';

interface EmailIndex {
  [email: string]: string; // email → userId
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
    const indexPath = this.indexFilePath();
    if (!(await FileOperations.exists(indexPath))) {
      await FileOperations.atomicWrite(indexPath, JSON.stringify({}, null, 2));
    }
  }

  private filePath(userId: string): string {
    FileOperations.validateId(userId);
    return path.join(this.usersDir, `${userId}.json`);
  }

  private indexFilePath(): string {
    return path.join(this.usersDir, INDEX_FILE);
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

  // ── CRUD ─────────────────────────────────────────────────────────────────────

  async create(data: { email: string; name: string }): Promise<User> {
    return globalWriteQueue.enqueue(QUEUE_KEY, async () => {
      const index = await this.readIndex();

      if (index[data.email.toLowerCase()]) {
        throw new Error(`User with email already exists: ${data.email}`);
      }

      const now = new Date().toISOString();
      const user: User = UserSchema.parse({
        id: `user-${crypto.randomBytes(8).toString('hex')}`,
        email: data.email.toLowerCase(),
        name: data.name,
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

  /**
   * Find an existing user by email, or create one if not found.
   * Used for JIT provisioning on authenticated requests.
   */
  async findOrCreate(email: string, name: string): Promise<User> {
    return globalWriteQueue.enqueue(QUEUE_KEY, async () => {
      const normalizedEmail = email.toLowerCase();
      const index = await this.readIndex();
      const existingUserId = index[normalizedEmail];

      if (!existingUserId) {
        const now = new Date().toISOString();
        const user: User = UserSchema.parse({
          id: `user-${crypto.randomBytes(8).toString('hex')}`,
          email: normalizedEmail,
          name,
          createdAt: now,
          updatedAt: now,
          active: true,
        });

        await FileOperations.atomicWrite(this.filePath(user.id), JSON.stringify(user, null, 2));

        index[user.email] = user.id;
        await this.writeIndex(index);

        return user;
      }

      const existing = await this.findById(existingUserId);
      if (!existing) {
        throw new EntityNotFoundError(`User not found for email: ${normalizedEmail}`, 'User', existingUserId);
      }

      if (existing.name === name) {
        return existing;
      }

      const updatedUser: User = UserSchema.parse({
        ...existing,
        name,
        updatedAt: new Date().toISOString(),
      });

      await FileOperations.atomicWrite(this.filePath(updatedUser.id), JSON.stringify(updatedUser, null, 2));

      return updatedUser;
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
}
