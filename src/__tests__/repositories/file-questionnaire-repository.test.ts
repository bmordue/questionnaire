/**
 * FileQuestionnaireRepository Tests
 */

import { describe, it, expect, beforeEach, afterEach } from '@jest/globals';
import { promises as fs } from 'fs';
import path from 'path';
import { FileQuestionnaireRepository } from '../../core/repositories/file-questionnaire-repository.js';
import { EntityNotFoundError } from '../../core/repositories/interfaces.js';
import type { StorageConfig } from '../../core/storage/types.js';
import { QuestionType } from '../../core/schemas/question.js';

const TEST_DIR = path.join(process.cwd(), 'test-data', 'questionnaire-repository');

const config: StorageConfig = {
  dataDirectory: TEST_DIR,
  backupEnabled: false,
  maxBackups: 3,
  compressionEnabled: false,
  encryptionEnabled: false,
  deleteBackupsOnCompletion: false,
};

const now = new Date().toISOString();

const sampleInput = {
  id: 'q-test-1',
  version: '1.0',
  title: 'Test Questionnaire',
  questions: [
    {
      id: 'q1',
      type: QuestionType.TEXT as const,
      text: 'Your name?',
      required: false,
    },
  ],
};

describe('FileQuestionnaireRepository', () => {
  let repo: FileQuestionnaireRepository;

  beforeEach(async () => {
    await fs.rm(TEST_DIR, { recursive: true, force: true });
    repo = new FileQuestionnaireRepository(config);
    await repo.initialize();
  });

  afterEach(async () => {
    await fs.rm(TEST_DIR, { recursive: true, force: true });
  });

  describe('create', () => {
    it('creates and returns a questionnaire', async () => {
      const q = await repo.create(sampleInput);
      expect(q.id).toBe('q-test-1');
      expect(q.metadata.title).toBe('Test Questionnaire');
    });
  });

  describe('findById', () => {
    it('returns null when not found', async () => {
      expect(await repo.findById('nonexistent')).toBeNull();
    });

    it('returns the questionnaire when found', async () => {
      await repo.create(sampleInput);
      const found = await repo.findById('q-test-1');
      expect(found).not.toBeNull();
      expect(found!.id).toBe('q-test-1');
    });
  });

  describe('list', () => {
    it('returns all questionnaires', async () => {
      await repo.create({ ...sampleInput, id: 'q-1' });
      await repo.create({ ...sampleInput, id: 'q-2' });
      const all = await repo.list();
      expect(all.length).toBe(2);
    });

    it('filters by publishedOnly', async () => {
      await repo.create({ ...sampleInput, id: 'pub' });
      await repo.create({ ...sampleInput, id: 'draft' });
      await repo.publish('pub', 'user-1');

      const published = await repo.list({ publishedOnly: true });
      expect(published.length).toBe(1);
      expect(published[0]!.id).toBe('pub');
    });
  });

  describe('update', () => {
    it('updates the questionnaire', async () => {
      await repo.create(sampleInput);
      const updated = await repo.update('q-test-1', {
        metadata: { title: 'Updated Title' } as any,
      });
      // update merges metadata
      expect(updated.id).toBe('q-test-1');
    });

    it('throws EntityNotFoundError for unknown id', async () => {
      await expect(repo.update('no-such', {})).rejects.toThrow(EntityNotFoundError);
    });
  });

  describe('delete', () => {
    it('deletes a questionnaire', async () => {
      await repo.create(sampleInput);
      await repo.delete('q-test-1');
      expect(await repo.exists('q-test-1')).toBe(false);
    });

    it('throws for unknown id', async () => {
      await expect(repo.delete('none')).rejects.toThrow(EntityNotFoundError);
    });
  });

  describe('publish / unpublish', () => {
    it('marks a questionnaire as published', async () => {
      await repo.create(sampleInput);
      const published = await repo.publish('q-test-1', 'user-1');
      expect(published.publishedAt).toBeTruthy();
      expect(published.publishedBy).toBe('user-1');
      expect(await repo.isPublished('q-test-1')).toBe(true);
    });

    it('unpublishes a questionnaire', async () => {
      await repo.create(sampleInput);
      await repo.publish('q-test-1', 'user-1');
      const unpublished = await repo.unpublish('q-test-1');
      expect(unpublished.publishedAt).toBeUndefined();
      expect(await repo.isPublished('q-test-1')).toBe(false);
    });
  });
});
