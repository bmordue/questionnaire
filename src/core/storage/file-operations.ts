/**
 * File Operations
 * 
 * Low-level file operations with atomic writes and error handling
 */

import { promises as fs } from 'fs';
import path from 'path';
import crypto from 'crypto';

/**
 * Error thrown when file operations fail
 */
export class FileOperationError extends Error {
  constructor(
    message: string,
    public readonly operation: string,
    public readonly filePath: string,
    public readonly cause?: Error
  ) {
    super(message);
    this.name = 'FileOperationError';
  }
}

/**
 * File operations with atomic write support
 */
export class FileOperations {
  /**
   * Atomically write data to a file using a temporary file
   * @param filePath - Target file path
   * @param data - Data to write
   */
  static async atomicWrite(filePath: string, data: string): Promise<void> {
    const dir = path.dirname(filePath);
    const tempFile = path.join(dir, `.${path.basename(filePath)}.tmp.${Date.now()}`);

    try {
      // Ensure directory exists
      await fs.mkdir(dir, { recursive: true });

      // Write to temporary file
      await fs.writeFile(tempFile, data, 'utf8');

      // Atomic rename
      await fs.rename(tempFile, filePath);
    } catch (error) {
      // Clean up temp file if it exists
      try {
        await fs.unlink(tempFile);
      } catch {
        // Ignore cleanup errors
      }

      throw new FileOperationError(
        `Failed to write file: ${error instanceof Error ? error.message : String(error)}`,
        'atomicWrite',
        filePath,
        error instanceof Error ? error : undefined
      );
    }
  }

  /**
   * Safely read a file with error handling
   * @param filePath - File path to read
   * @returns File contents as string
   */
  static async safeRead(filePath: string): Promise<string> {
    try {
      return await fs.readFile(filePath, 'utf8');
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
        throw new FileOperationError(
          `File not found: ${filePath}`,
          'safeRead',
          filePath,
          error instanceof Error ? error : undefined
        );
      }

      throw new FileOperationError(
        `Failed to read file: ${error instanceof Error ? error.message : String(error)}`,
        'safeRead',
        filePath,
        error instanceof Error ? error : undefined
      );
    }
  }

  /**
   * Check if a file exists
   * @param filePath - File path to check
   * @returns True if file exists, false otherwise
   */
  static async exists(filePath: string): Promise<boolean> {
    try {
      await fs.access(filePath);
      return true;
    } catch {
      return false;
    }
  }

  /**
   * Delete a file
   * @param filePath - File path to delete
   */
  static async delete(filePath: string): Promise<void> {
    try {
      await fs.unlink(filePath);
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
        // File doesn't exist, consider it deleted
        return;
      }

      throw new FileOperationError(
        `Failed to delete file: ${error instanceof Error ? error.message : String(error)}`,
        'delete',
        filePath,
        error instanceof Error ? error : undefined
      );
    }
  }

  /**
   * List files in a directory
   * @param dirPath - Directory path
   * @param extension - Optional file extension filter (e.g., '.json')
   * @returns Array of file names
   */
  static async listFiles(dirPath: string, extension?: string): Promise<string[]> {
    try {
      // Create directory if it doesn't exist
      await fs.mkdir(dirPath, { recursive: true });

      const files = await fs.readdir(dirPath);

      if (extension) {
        return files.filter(file => file.endsWith(extension));
      }

      return files;
    } catch (error) {
      throw new FileOperationError(
        `Failed to list files: ${error instanceof Error ? error.message : String(error)}`,
        'listFiles',
        dirPath,
        error instanceof Error ? error : undefined
      );
    }
  }

  /**
   * Create a backup copy of a file
   * @param filePath - File to backup
   * @returns Path to backup file
   */
  static async createBackup(filePath: string): Promise<string> {
    try {
      const exists = await this.exists(filePath);
      if (!exists) {
        throw new Error('Source file does not exist');
      }

      const dir = path.dirname(filePath);
      const ext = path.extname(filePath);
      const base = path.basename(filePath, ext);
      const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
      const backupPath = path.join(dir, `${base}.backup.${timestamp}${ext}`);

      const data = await this.safeRead(filePath);
      await this.atomicWrite(backupPath, data);

      return backupPath;
    } catch (error) {
      throw new FileOperationError(
        `Failed to create backup: ${error instanceof Error ? error.message : String(error)}`,
        'createBackup',
        filePath,
        error instanceof Error ? error : undefined
      );
    }
  }

  /**
   * Clean up old backup files, keeping only the most recent ones
   * @param dirPath - Directory containing backups
   * @param pattern - Filename pattern to match (e.g., 'questionnaire-*.backup.*.json')
   * @param maxBackups - Maximum number of backups to keep
   */
  static async cleanupBackups(
    dirPath: string,
    pattern: RegExp,
    maxBackups: number
  ): Promise<void> {
    try {
      const files = await this.listFiles(dirPath);
      const backupFiles = files
        .filter(file => pattern.test(file))
        .map(file => ({
          name: file,
          path: path.join(dirPath, file)
        }));

      if (backupFiles.length <= maxBackups) {
        return;
      }

      // Get file stats to sort by modification time
      const filesWithStats = await Promise.all(
        backupFiles.map(async file => ({
          ...file,
          stats: await fs.stat(file.path)
        }))
      );

      // Sort by modification time (newest first)
      filesWithStats.sort((a, b) => b.stats.mtimeMs - a.stats.mtimeMs);

      // Delete old backups
      const filesToDelete = filesWithStats.slice(maxBackups);
      await Promise.all(filesToDelete.map(file => this.delete(file.path)));
    } catch (error) {
      throw new FileOperationError(
        `Failed to cleanup backups: ${error instanceof Error ? error.message : String(error)}`,
        'cleanupBackups',
        dirPath,
        error instanceof Error ? error : undefined
      );
    }
  }

  /**
   * Generate a unique session ID
   * @returns Unique session identifier
   */
  static generateSessionId(): string {
    return `session-${Date.now()}-${crypto.randomBytes(8).toString('hex')}`;
  }

  /**
   * Ensure a directory exists, creating it if necessary
   * @param dirPath - Directory path
   */
  static async ensureDirectory(dirPath: string): Promise<void> {
    try {
      await fs.mkdir(dirPath, { recursive: true });
    } catch (error) {
      throw new FileOperationError(
        `Failed to create directory: ${error instanceof Error ? error.message : String(error)}`,
        'ensureDirectory',
        dirPath,
        error instanceof Error ? error : undefined
      );
    }
  }
}
