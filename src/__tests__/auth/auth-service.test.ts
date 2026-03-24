/**
 * AuthService Tests
 */

import { describe, it, expect, beforeEach, afterEach } from '@jest/globals';
import { promises as fs } from 'fs';
import path from 'path';
import { AuthService, AuthError } from '../../core/auth/auth-service.js';
import { FileUserRepository } from '../../core/repositories/file-user-repository.js';
import { SessionManager } from '../../core/auth/session-manager.js';
import type { StorageConfig } from '../../core/storage/types.js';

const TEST_DIR = path.join(process.cwd(), 'test-data', 'auth-service');

const config: StorageConfig = {
  dataDirectory: TEST_DIR,
  backupEnabled: false,
  maxBackups: 3,
  compressionEnabled: false,
  encryptionEnabled: false,
  deleteBackupsOnCompletion: false,
};

describe('AuthService', () => {
  let userRepo: FileUserRepository;
  let sessionManager: SessionManager;
  let auth: AuthService;

  beforeEach(async () => {
    await fs.rm(TEST_DIR, { recursive: true, force: true });
    userRepo = new FileUserRepository(config);
    sessionManager = new SessionManager(TEST_DIR);
    await userRepo.initialize();
    await sessionManager.initialize();
    auth = new AuthService(userRepo, sessionManager);
  });

  afterEach(async () => {
    sessionManager.shutdown();
    await fs.rm(TEST_DIR, { recursive: true, force: true });
  });

  describe('register', () => {
    it('creates a user and returns a session token', async () => {
      const result = await auth.register({
        email: 'alice@example.com',
        password: 'password123',
        name: 'Alice',
      });

      expect(result.user.email).toBe('alice@example.com');
      expect(result.token).toBeTruthy();
      expect(result.user).not.toHaveProperty('passwordHash');
    });

    it('rejects duplicate email', async () => {
      await auth.register({ email: 'bob@example.com', password: 'password123', name: 'Bob' });

      await expect(
        auth.register({ email: 'bob@example.com', password: 'otherpass', name: 'Bob2' }),
      ).rejects.toThrow(AuthError);
    });
  });

  describe('login', () => {
    it('returns a token for valid credentials', async () => {
      await auth.register({ email: 'carol@example.com', password: 'secret123', name: 'Carol' });

      const result = await auth.login({ email: 'carol@example.com', password: 'secret123' });
      expect(result.token).toBeTruthy();
      expect(result.user.email).toBe('carol@example.com');
    });

    it('rejects wrong password', async () => {
      await auth.register({ email: 'dave@example.com', password: 'correct', name: 'Dave' });

      await expect(
        auth.login({ email: 'dave@example.com', password: 'wrong' }),
      ).rejects.toThrow(AuthError);
    });

    it('rejects unknown email', async () => {
      await expect(
        auth.login({ email: 'nobody@example.com', password: 'pass' }),
      ).rejects.toThrow(AuthError);
    });
  });

  describe('validateSession', () => {
    it('returns the user for a valid token', async () => {
      const { token } = await auth.register({
        email: 'eve@example.com',
        password: 'pass1234',
        name: 'Eve',
      });

      const user = await auth.validateSession(token);
      expect(user).not.toBeNull();
      expect(user!.email).toBe('eve@example.com');
    });

    it('returns null for an unknown token', async () => {
      const user = await auth.validateSession('invalid-token');
      expect(user).toBeNull();
    });
  });

  describe('logout', () => {
    it('invalidates the session', async () => {
      const { token } = await auth.register({
        email: 'frank@example.com',
        password: 'pass1234',
        name: 'Frank',
      });

      await auth.logout(token);

      const user = await auth.validateSession(token);
      expect(user).toBeNull();
    });
  });

  describe('changePassword', () => {
    it('changes the password and invalidates all sessions', async () => {
      const { token } = await auth.register({
        email: 'grace@example.com',
        password: 'oldpass1',
        name: 'Grace',
      });

      await auth.changePassword(
        (await auth.validateSession(token))!.id,
        'oldpass1',
        'newpass123',
      );

      // Old session should be gone
      expect(await auth.validateSession(token)).toBeNull();

      // Old password should no longer work
      await expect(
        auth.login({ email: 'grace@example.com', password: 'oldpass1' }),
      ).rejects.toThrow(AuthError);

      // New password should work
      const newResult = await auth.login({ email: 'grace@example.com', password: 'newpass123' });
      expect(newResult.token).toBeTruthy();
    });
  });
});
