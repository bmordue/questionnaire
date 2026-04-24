/**
 * FileUserRepository Tests
 *
 * Tests for the simplified user repository that stores Authelia-provisioned users.
 * No passwords, roles, or reset tokens — just email, name, and audit fields.
 */

import { describe, it, expect, beforeEach, afterEach } from '@jest/globals';
import { promises as fs } from 'fs';
import path from 'path';
import { FileUserRepository } from '../../core/repositories/file-user-repository.js';

const TEST_DIR = path.join(process.cwd(), 'test-data', 'user-repository');

describe('FileUserRepository', () => {
  let repo: FileUserRepository;

  beforeEach(async () => {
    await fs.rm(TEST_DIR, { recursive: true, force: true });
    repo = new FileUserRepository({ dataDirectory: TEST_DIR });
    await repo.initialize();
  });

  afterEach(async () => {
    await fs.rm(TEST_DIR, { recursive: true, force: true });
  });

  describe('create', () => {
    it('creates a user with the given data', async () => {
      const user = await repo.create({
        email: 'alice@example.com',
        name: 'Alice',
      });

      expect(user.id).toMatch(/^user-/);
      expect(user.email).toBe('alice@example.com');
      expect(user.name).toBe('Alice');
      expect(user.active).toBe(true);
    });

    it('normalises email to lowercase', async () => {
      const user = await repo.create({
        email: 'ALICE@EXAMPLE.COM',
        name: 'Alice',
      });

      expect(user.email).toBe('alice@example.com');
    });

    it('throws when email already exists', async () => {
      await repo.create({ email: 'bob@example.com', name: 'Bob' });

      await expect(
        repo.create({ email: 'bob@example.com', name: 'Bob2' }),
      ).rejects.toThrow('already exists');
    });
  });

  describe('findById', () => {
    it('returns user when found', async () => {
      const created = await repo.create({ email: 'c@example.com', name: 'C' });
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
      await repo.create({ email: 'd@example.com', name: 'D' });
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
      const user = await repo.create({ email: 'e@example.com', name: 'E' });
      const updated = await repo.update(user.id, { name: 'Eugene' });
      expect(updated.name).toBe('Eugene');
    });

    it('throws for unknown user', async () => {
      await expect(repo.update('no-such-id', { name: 'x' })).rejects.toThrow();
    });
  });

  describe('delete', () => {
    it('deletes a user and removes from index', async () => {
      const user = await repo.create({ email: 'f@example.com', name: 'F' });
      await repo.delete(user.id);

      expect(await repo.findById(user.id)).toBeNull();
      expect(await repo.emailExists('f@example.com')).toBe(false);
    });
  });

  describe('emailExists', () => {
    it('returns true for existing email', async () => {
      await repo.create({ email: 'g@example.com', name: 'G' });
      expect(await repo.emailExists('g@example.com')).toBe(true);
    });

    it('returns false for unknown email', async () => {
      expect(await repo.emailExists('nobody@example.com')).toBe(false);
    });
  });

  describe('findOrCreate', () => {
    it('creates a user on first call', async () => {
      const user = await repo.findOrCreate('new@example.com', 'New User');
      expect(user.email).toBe('new@example.com');
      expect(user.name).toBe('New User');
    });

    it('returns existing user on subsequent calls', async () => {
      const first = await repo.findOrCreate('existing@example.com', 'Existing');
      const second = await repo.findOrCreate('existing@example.com', 'Existing');
      expect(first.id).toBe(second.id);
    });

    it('updates name if it has changed', async () => {
      await repo.findOrCreate('update@example.com', 'Old Name');
      const updated = await repo.findOrCreate('update@example.com', 'New Name');
      expect(updated.name).toBe('New Name');
    });
  });

  describe('findAll', () => {
    it('returns all users', async () => {
      await repo.create({ email: 'h@example.com', name: 'H' });
      await repo.create({ email: 'i@example.com', name: 'I' });
      const all = await repo.findAll();
      expect(all.length).toBe(2);
    });
  });
});
