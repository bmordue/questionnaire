import { describe, it, expect, beforeAll, afterAll } from '@jest/globals';
import { promises as fs } from 'fs';
import path from 'path';
import request from 'supertest';

const TEST_DATA_DIR = path.join(process.cwd(), 'test-data', 'id-validation');
const originalDataDir = process.env['DATA_DIR'];
process.env['DATA_DIR'] = TEST_DATA_DIR;

const { app } = await import('../../web/server.js');

describe('Web ID Validation', () => {
  beforeAll(async () => {
    await fs.mkdir(TEST_DATA_DIR, { recursive: true });
  });

  afterAll(async () => {
    if (originalDataDir === undefined) {
      delete process.env['DATA_DIR'];
    } else {
      process.env['DATA_DIR'] = originalDataDir;
    }

    await fs.rm(TEST_DATA_DIR, { recursive: true, force: true });
  });

  const unsafeIdsInQueryBody = ['..', 'sub/dir', 'id with spaces', 'id$'];
  const unsafeIdsInPath = ['unsafe!!', 'id with spaces', 'id$'];

  describe('Questionnaire Routes', () => {
    it('should reject unsafe ID in GET /api/questionnaires/:id', async () => {
      for (const id of unsafeIdsInPath) {
        const res = await request(app)
          .get(`/api/questionnaires/${id}`)
          .set('Remote-User', 'admin@example.com')
          .set('Remote-Groups', 'admins');

        expect(res.status).toBe(400);
        expect(res.body.error).toContain('Invalid ID format');
      }
    });

    it('should reject unsafe ID in PUT /api/questionnaires/:id', async () => {
      for (const id of unsafeIdsInPath) {
        const res = await request(app)
          .put(`/api/questionnaires/${id}`)
          .set('Remote-User', 'admin@example.com')
          .set('Remote-Groups', 'admins')
          .send({});
        expect(res.status).toBe(400);
      }
    });

    it('should reject unsafe userId in PUT /api/questionnaires/:id/permissions/:userId', async () => {
      const res = await request(app)
        .put('/api/questionnaires/safe-q/permissions/unsafe!!')
        .set('Remote-User', 'admin@example.com')
        .set('Remote-Groups', 'admins')
        .send({ level: 'respond' });
      expect(res.status).toBe(400);
    });
  });

  describe('Response Routes', () => {
    it('should reject unsafe questionnaireId in GET /api/responses', async () => {
      for (const id of unsafeIdsInQueryBody) {
        const res = await request(app)
          .get(`/api/responses?questionnaireId=${encodeURIComponent(id)}`)
          .set('Remote-User', 'admin@example.com')
          .set('Remote-Groups', 'admins');
        expect(res.status).toBe(400);
      }
    });

    it('should reject unsafe ID in GET /api/responses/:id', async () => {
      for (const id of unsafeIdsInPath) {
        const res = await request(app)
          .get(`/api/responses/${id}`)
          .set('Remote-User', 'admin@example.com')
          .set('Remote-Groups', 'admins');
        expect(res.status).toBe(400);
      }
    });

    it('should reject array query values in GET /api/responses', async () => {
      const res = await request(app)
        .get('/api/responses')
        .query({ questionnaireId: ['safe-q', '../traversal'] })
        .set('Remote-User', 'admin@example.com')
        .set('Remote-Groups', 'admins');
      expect(res.status).toBe(400);
    });
  });

  describe('Session Routes', () => {
    it('should reject unsafe questionnaireId in POST /api/sessions', async () => {
      for (const id of unsafeIdsInQueryBody) {
        const res = await request(app)
          .post('/api/sessions')
          .set('Remote-User', 'admin@example.com')
          .set('Remote-Groups', 'admins')
          .send({ questionnaireId: id });
        expect(res.status).toBe(400);
      }
    });

    it('should reject non-string questionnaireId in POST /api/sessions', async () => {
      const res = await request(app)
        .post('/api/sessions')
        .set('Remote-User', 'admin@example.com')
        .set('Remote-Groups', 'admins')
        .send({ questionnaireId: { id: 'safe-q' } });
      expect(res.status).toBe(400);
      expect(res.body.error).toBe('Invalid ID format: must be a string');
    });

    it('should reject unsafe sessionId in GET /api/sessions/:sessionId', async () => {
      for (const id of unsafeIdsInPath) {
        const res = await request(app)
          .get(`/api/sessions/${id}`)
          .set('Remote-User', 'admin@example.com')
          .set('Remote-Groups', 'admins');
        expect(res.status).toBe(400);
      }
    });
  });
});
