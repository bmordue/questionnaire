import { describe, it, expect } from '@jest/globals';
import request from 'supertest';
import { app } from '../../web/server.js';

describe('Web ID Validation', () => {
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
