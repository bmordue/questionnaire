import { describe, it, expect, beforeEach, afterEach } from '@jest/globals';
import { FileOperations, FileOperationError } from '../../core/storage/file-operations.js';
import { QuestionnaireStore } from '../../core/storage/questionnaire-store.js';
import { ResponseStore } from '../../core/storage/response-store.js';
import { SessionStore } from '../../core/storage/session-store.js';
import { FileUserRepository } from '../../core/repositories/file-user-repository.js';
import path from 'path';
import os from 'os';
import { promises as fs } from 'fs';

describe('Path Traversal Protection', () => {
  let tempDir: string;

  beforeEach(async () => {
    tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'traversal-test-'));
  });

  afterEach(async () => {
    await fs.rm(tempDir, { recursive: true, force: true });
  });

  describe('FileOperations.validateId', () => {
    it('should allow safe IDs', () => {
      expect(() => FileOperations.validateId('safe-id_123')).not.toThrow();
    });

    it('should throw for path traversal sequences', () => {
      expect(() => FileOperations.validateId('..')).toThrow(FileOperationError);
      expect(() => FileOperations.validateId('../etc/passwd')).toThrow(FileOperationError);
      expect(() => FileOperations.validateId('sub/dir')).toThrow(FileOperationError);
    });

    it('should throw for other unsafe characters', () => {
      expect(() => FileOperations.validateId('id with spaces')).toThrow(FileOperationError);
      expect(() => FileOperations.validateId('id@email.com')).toThrow(FileOperationError);
      expect(() => FileOperations.validateId('id$')).toThrow(FileOperationError);
    });
  });

  it('should protect QuestionnaireStore', async () => {
    const store = new QuestionnaireStore({ dataDirectory: tempDir } as any);
    await expect(store.load('../../package')).rejects.toThrow(FileOperationError);
  });

  it('should protect ResponseStore', async () => {
    const store = new ResponseStore({ dataDirectory: tempDir } as any);
    await expect(store.load('../../package')).rejects.toThrow(FileOperationError);
  });

  it('should protect SessionStore', async () => {
    const store = new SessionStore({ dataDirectory: tempDir } as any);
    await expect(store.load('../../package')).rejects.toThrow(FileOperationError);
  });

  it('should protect FileUserRepository', async () => {
    const repo = new FileUserRepository({ dataDirectory: tempDir });
    await expect(repo.findById('../../package')).rejects.toThrow(FileOperationError);
  });
});
