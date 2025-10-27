/**
 * File Operations Tests
 */

import { describe, it, expect, beforeEach, afterEach } from '@jest/globals';
import { promises as fs } from 'fs';
import path from 'path';
import { FileOperations, FileOperationError } from '../../core/storage/file-operations.js';

const TEST_DIR = path.join(process.cwd(), 'test-data', 'file-operations');

describe('FileOperations', () => {
  beforeEach(async () => {
    // Clean up test directory
    try {
      await fs.rm(TEST_DIR, { recursive: true });
    } catch {
      // Ignore if directory doesn't exist
    }
    await fs.mkdir(TEST_DIR, { recursive: true });
  });

  afterEach(async () => {
    // Clean up after tests
    try {
      await fs.rm(TEST_DIR, { recursive: true });
    } catch {
      // Ignore cleanup errors
    }
  });

  describe('atomicWrite', () => {
    it('should write data to a file atomically', async () => {
      const filePath = path.join(TEST_DIR, 'test.txt');
      const data = 'Hello, World!';

      await FileOperations.atomicWrite(filePath, data);

      const content = await fs.readFile(filePath, 'utf8');
      expect(content).toBe(data);
    });

    it('should create parent directories if they do not exist', async () => {
      const filePath = path.join(TEST_DIR, 'subdir', 'test.txt');
      const data = 'Test data';

      await FileOperations.atomicWrite(filePath, data);

      const content = await fs.readFile(filePath, 'utf8');
      expect(content).toBe(data);
    });

    it('should overwrite existing files', async () => {
      const filePath = path.join(TEST_DIR, 'test.txt');

      await FileOperations.atomicWrite(filePath, 'First');
      await FileOperations.atomicWrite(filePath, 'Second');

      const content = await fs.readFile(filePath, 'utf8');
      expect(content).toBe('Second');
    });

    it('should throw FileOperationError on failure', async () => {
      // Try to write to a read-only directory (simulate error)
      const invalidPath = path.join('/dev/null', 'test.txt');

      await expect(
        FileOperations.atomicWrite(invalidPath, 'data')
      ).rejects.toThrow(FileOperationError);
    });
  });

  describe('safeRead', () => {
    it('should read a file successfully', async () => {
      const filePath = path.join(TEST_DIR, 'test.txt');
      const data = 'Test content';

      await fs.writeFile(filePath, data, 'utf8');

      const content = await FileOperations.safeRead(filePath);
      expect(content).toBe(data);
    });

    it('should throw FileOperationError if file does not exist', async () => {
      const filePath = path.join(TEST_DIR, 'nonexistent.txt');

      await expect(FileOperations.safeRead(filePath)).rejects.toThrow(FileOperationError);
    });

    it('should include ENOENT in error message for missing files', async () => {
      const filePath = path.join(TEST_DIR, 'missing.txt');

      await expect(FileOperations.safeRead(filePath)).rejects.toThrow(/File not found/);
    });
  });

  describe('exists', () => {
    it('should return true for existing files', async () => {
      const filePath = path.join(TEST_DIR, 'test.txt');
      await fs.writeFile(filePath, 'data', 'utf8');

      const exists = await FileOperations.exists(filePath);
      expect(exists).toBe(true);
    });

    it('should return false for non-existing files', async () => {
      const filePath = path.join(TEST_DIR, 'nonexistent.txt');

      const exists = await FileOperations.exists(filePath);
      expect(exists).toBe(false);
    });
  });

  describe('delete', () => {
    it('should delete an existing file', async () => {
      const filePath = path.join(TEST_DIR, 'test.txt');
      await fs.writeFile(filePath, 'data', 'utf8');

      await FileOperations.delete(filePath);

      const exists = await FileOperations.exists(filePath);
      expect(exists).toBe(false);
    });

    it('should not throw error when deleting non-existing file', async () => {
      const filePath = path.join(TEST_DIR, 'nonexistent.txt');

      await expect(FileOperations.delete(filePath)).resolves.not.toThrow();
    });
  });

  describe('listFiles', () => {
    it('should list all files in a directory', async () => {
      await fs.writeFile(path.join(TEST_DIR, 'file1.txt'), 'data', 'utf8');
      await fs.writeFile(path.join(TEST_DIR, 'file2.txt'), 'data', 'utf8');
      await fs.writeFile(path.join(TEST_DIR, 'file3.json'), 'data', 'utf8');

      const files = await FileOperations.listFiles(TEST_DIR);

      expect(files).toHaveLength(3);
      expect(files).toContain('file1.txt');
      expect(files).toContain('file2.txt');
      expect(files).toContain('file3.json');
    });

    it('should filter files by extension', async () => {
      await fs.writeFile(path.join(TEST_DIR, 'file1.txt'), 'data', 'utf8');
      await fs.writeFile(path.join(TEST_DIR, 'file2.json'), 'data', 'utf8');
      await fs.writeFile(path.join(TEST_DIR, 'file3.json'), 'data', 'utf8');

      const files = await FileOperations.listFiles(TEST_DIR, '.json');

      expect(files).toHaveLength(2);
      expect(files).toContain('file2.json');
      expect(files).toContain('file3.json');
    });

    it('should create directory if it does not exist', async () => {
      const newDir = path.join(TEST_DIR, 'newdir');

      const files = await FileOperations.listFiles(newDir);

      expect(files).toHaveLength(0);
      const exists = await FileOperations.exists(newDir);
      expect(exists).toBe(true);
    });
  });

  describe('createBackup', () => {
    it('should create a backup of a file', async () => {
      const filePath = path.join(TEST_DIR, 'test.txt');
      await fs.writeFile(filePath, 'original data', 'utf8');

      const backupPath = await FileOperations.createBackup(filePath);

      const backupContent = await fs.readFile(backupPath, 'utf8');
      expect(backupContent).toBe('original data');
      expect(backupPath).toContain('.backup.');
    });

    it('should throw error if source file does not exist', async () => {
      const filePath = path.join(TEST_DIR, 'nonexistent.txt');

      await expect(FileOperations.createBackup(filePath)).rejects.toThrow(FileOperationError);
    });
  });

  describe('cleanupBackups', () => {
    it('should remove old backup files when limit is exceeded', async () => {
      const baseFile = 'test';

      // Create 5 backup files
      for (let i = 0; i < 5; i++) {
        const backupName = `${baseFile}.backup.${i}.json`;
        await fs.writeFile(path.join(TEST_DIR, backupName), `data${i}`, 'utf8');
        // Small delay to ensure different timestamps
        await new Promise(resolve => setTimeout(resolve, 10));
      }

      const pattern = new RegExp(`^${baseFile}\\.backup\\..*\\.json$`);
      await FileOperations.cleanupBackups(TEST_DIR, pattern, 3);

      const files = await FileOperations.listFiles(TEST_DIR, '.json');
      const backupFiles = files.filter(f => pattern.test(f));

      expect(backupFiles).toHaveLength(3);
    });

    it('should not remove backups if under limit', async () => {
      const baseFile = 'test';

      // Create 2 backup files
      for (let i = 0; i < 2; i++) {
        const backupName = `${baseFile}.backup.${i}.json`;
        await fs.writeFile(path.join(TEST_DIR, backupName), `data${i}`, 'utf8');
      }

      const pattern = new RegExp(`^${baseFile}\\.backup\\..*\\.json$`);
      await FileOperations.cleanupBackups(TEST_DIR, pattern, 5);

      const files = await FileOperations.listFiles(TEST_DIR, '.json');
      const backupFiles = files.filter(f => pattern.test(f));

      expect(backupFiles).toHaveLength(2);
    });
  });

  describe('generateSessionId', () => {
    it('should generate a unique session ID', () => {
      const id1 = FileOperations.generateSessionId();
      const id2 = FileOperations.generateSessionId();

      expect(id1).toMatch(/^session-\d+-[a-f0-9]{16}$/);
      expect(id2).toMatch(/^session-\d+-[a-f0-9]{16}$/);
      expect(id1).not.toBe(id2);
    });
  });

  describe('ensureDirectory', () => {
    it('should create a directory if it does not exist', async () => {
      const dirPath = path.join(TEST_DIR, 'newdir');

      await FileOperations.ensureDirectory(dirPath);

      const stats = await fs.stat(dirPath);
      expect(stats.isDirectory()).toBe(true);
    });

    it('should not throw error if directory already exists', async () => {
      const dirPath = path.join(TEST_DIR, 'existingdir');
      await fs.mkdir(dirPath);

      await expect(FileOperations.ensureDirectory(dirPath)).resolves.not.toThrow();
    });
  });
});
