/**
 * FileUserRepository Tests
 */

import { describe, it, expect, beforeEach, afterEach } from '@jest/globals';
import { promises as fs } from 'fs';
import path from 'path';
import { FileUserRepository } from '../../core/repositories/file-user-repository.js';
import type { StorageConfig } from '../../core/storage/types.js';

const TEST_DIR = path.join(process.cwd(), 'test-data', 'user-repository');

const config: StorageConfig = {
  dataDirectory: TEST_DIR,
  backupEnabled: false,
  maxBackups: 3,
  compressionEnabled: false,
  encryptionEnabled: false,
  deleteBackupsOnCompletion: false,
};

describe('FileUserRepository', () => {
  let repo: FileUserRepository;

  beforeEach(async () => {
    await fs.rm(TEST_DIR, { recursive: true, force: true });
    repo = new FileUserRepository(config);
    await repo.initialize();
  });

  afterEach(async () => {
    await fs.rm(TEST_DIR, { recursive: true, force: true });
  });

  describe('create', () => {
    it('creates a user with the given data', async () => {
      const user = await repo.create({
        email: 'alice@example.com',
        passwordHash: '$2a$hash',
        name: 'Alice',
      });

      expect(user.id).toMatch(/^user-/);
      expect(user.email).toBe('alice@example.com');
      expect(user.name).toBe('Alice');
      expect(user.role).toBe('respondent');
      expect(user.active).toBe(true);
    });

    it('normalises email to lowercase', async () => {
      const user = await repo.create({
        email: 'ALICE@EXAMPLE.COM',
        passwordHash: '$2a$hash',
        name: 'Alice',
      });

      expect(user.email).toBe('alice@example.com');
    });

    it('throws when email already exists', async () => {
      await repo.create({ email: 'bob@example.com', passwordHash: 'h', name: 'Bob' });

      await expect(
        repo.create({ email: 'bob@example.com', passwordHash: 'h', name: 'Bob2' }),
      ).rejects.toThrow('already exists');
    });
  });

  describe('findById', () => {
    it('returns user when found', async () => {
      const created = await repo.create({ email: 'c@example.com', passwordHash: 'h', name: 'C' });
      const found = await repo.findById(created.id);
      expect(found).not.toBeNull();
      expect(found!.email).toBe('c@example.com');
    });

    it('returns null when not found', async () => {
      const result = await repo.findById('does-not-exist');
      expect(result).toBeNull();
    });
  });

  describe('findByEmail', () => {
    it('returns user by email', async () => {
      await repo.create({ email: 'd@example.com', passwordHash: 'h', name: 'D' });
      const found = await repo.findByEmail('d@example.com');
      expect(found).not.toBeNull();
    });

    it('returns null for unknown email', async () => {
      const result = await repo.findByEmail('unknown@example.com');
      expect(result).toBeNull();
    });
  });

  describe('update', () => {
    it('updates user fields', async () => {
      const user = await repo.create({ email: 'e@example.com', passwordHash: 'h', name: 'E' });
      const updated = await repo.update(user.id, { name: 'Eugene' });
      expect(updated.name).toBe('Eugene');
    });

    it('throws for unknown user', async () => {
      await expect(repo.update('no-such-id', { name: 'x' })).rejects.toThrow();
    });
  });

  describe('delete', () => {
    it('deletes a user and removes from index', async () => {
      const user = await repo.create({ email: 'f@example.com', passwordHash: 'h', name: 'F' });
      await repo.delete(user.id);

      expect(await repo.findById(user.id)).toBeNull();
      expect(await repo.emailExists('f@example.com')).toBe(false);
    });
  });

  describe('emailExists', () => {
    it('returns true for existing email', async () => {
      await repo.create({ email: 'g@example.com', passwordHash: 'h', name: 'G' });
      expect(await repo.emailExists('g@example.com')).toBe(true);
    });

    it('returns false for unknown email', async () => {
      expect(await repo.emailExists('nobody@example.com')).toBe(false);
    });
  });

  describe('password reset', () => {
    it('sets and clears a reset token', async () => {
      const user = await repo.create({ email: 'h@example.com', passwordHash: 'h', name: 'H' });

      const withToken = await repo.setPasswordResetToken(user.id, 'my-token', 60);
      expect(withToken.passwordResetToken).toBe('my-token');
      expect(withToken.passwordResetExpiry).toBeTruthy();

      const cleared = await repo.clearPasswordResetToken(user.id);
      expect(cleared.passwordResetToken).toBeUndefined();
      expect(cleared.passwordResetExpiry).toBeUndefined();
    });
  });
});
