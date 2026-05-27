/**
 * Server API Integration Tests
 *
 * Tests for the Express web server API endpoints.
 * Covers questionnaire CRUD operations to prevent regression of HTTP 500 errors.
 */

import { describe, it, expect, beforeAll, afterAll, beforeEach, jest } from '@jest/globals';
import { promises as fs } from 'fs';
import path from 'path';
import request from 'supertest';

// DATA_DIR must be set before importing the server so FileStorageService uses our test directory
const TEST_DATA_DIR = path.join(process.cwd(), 'test-data', 'server-api');
const originalDataDir = process.env['DATA_DIR'];
process.env['DATA_DIR'] = TEST_DATA_DIR;

// Importing the server module after setting DATA_DIR ensures it picks up our test directory.
// NODE_ENV=test (set by Jest) prevents the server from binding to a TCP port.
const { app } = await import('../../web/server.js');

// ── Helpers ───────────────────────────────────────────────────────────────────

/** Default proxy headers injected as if Authelia authenticated the request. */
const AUTH_HEADERS = {
  'remote-user': 'test@example.com',
  'remote-name': 'Test User',
};

let idCounter = 0;

function makeQuestionnaire(overrides: Record<string, unknown> = {}): Record<string, unknown> {
  const now = new Date().toISOString();
  return {
    id: `q_test_${++idCounter}`,
    version: '1.0',
    metadata: {
      title: 'Test Questionnaire',
      createdAt: now,
      updatedAt: now,
      tags: [],
    },
    questions: [
      {
        id: 'q1',
        type: 'text',
        text: 'What is your name?',
        required: false,
      },
    ],
    config: {
      allowBack: true,
      showProgress: true,
      shuffleQuestions: false,
      allowSkip: false,
    },
    ...overrides,
  };
}

// ── Setup / Teardown ──────────────────────────────────────────────────────────

beforeAll(async () => {
  await fs.mkdir(TEST_DATA_DIR, { recursive: true });
});

afterAll(async () => {
  // Restore the original DATA_DIR env var to prevent leaking into other test files
  if (originalDataDir === undefined) {
    delete process.env['DATA_DIR'];
  } else {
    process.env['DATA_DIR'] = originalDataDir;
  }

  try {
    await fs.rm(TEST_DATA_DIR, { recursive: true });
  } catch {
    // ignore cleanup errors
  }
});

beforeEach(async () => {
  // Clean up data between tests for isolation
  try {
    await fs.rm(TEST_DATA_DIR, { recursive: true });
    await fs.mkdir(TEST_DATA_DIR, { recursive: true });
  } catch {
    // ignore
  }
});

// ── POST /api/questionnaires ──────────────────────────────────────────────────

describe('POST /api/questionnaires', () => {
  it('saves a valid questionnaire and returns 201', async () => {
    const body = makeQuestionnaire();

    const res = await request(app)
      .post('/api/questionnaires')
      .send(body)
      .set('Content-Type', 'application/json')
      .set(AUTH_HEADERS);

    expect(res.status).toBe(201);
    expect(res.body).toMatchObject({
      id: body.id,
      version: body.version,
      metadata: expect.objectContaining({ title: 'Test Questionnaire' }),
      questions: expect.arrayContaining([
        expect.objectContaining({ id: 'q1', type: 'text' }),
      ]),
    });
  });

  it('returns 201 for questionnaire with all question types', async () => {
    const now = new Date().toISOString();
    const body = {
      id: 'q_all_types',
      version: '1.0',
      metadata: { title: 'All Types', createdAt: now, updatedAt: now, tags: ['test'] },
      questions: [
        { id: 'q_text', type: 'text', text: 'Text question', required: false },
        { id: 'q_email', type: 'email', text: 'Email question', required: true },
        { id: 'q_number', type: 'number', text: 'Number question', required: false },
        { id: 'q_boolean', type: 'boolean', text: 'Boolean question', required: false },
        { id: 'q_date', type: 'date', text: 'Date question', required: false },
        {
          id: 'q_rating',
          type: 'rating',
          text: 'Rating question',
          required: false,
          validation: { min: 1, max: 10 },
        },
        {
          id: 'q_single',
          type: 'single_choice',
          text: 'Single choice',
          required: false,
          options: [
            { value: 'a', label: 'Option A' },
            { value: 'b', label: 'Option B' },
          ],
        },
        {
          id: 'q_multi',
          type: 'multiple_choice',
          text: 'Multiple choice',
          required: false,
          options: [
            { value: 'x', label: 'Option X' },
            { value: 'y', label: 'Option Y' },
          ],
        },
      ],
      config: { allowBack: true, showProgress: true, shuffleQuestions: false, allowSkip: false },
    };

    const res = await request(app)
      .post('/api/questionnaires')
      .send(body)
      .set('Content-Type', 'application/json')
      .set(AUTH_HEADERS);

    expect(res.status).toBe(201);
    expect(res.body.questions).toHaveLength(8);
  });

  it('returns 201 for questionnaire without optional fields (no description, author, tags)', async () => {
    const now = new Date().toISOString();
    const body = {
      id: 'q_minimal',
      version: '1.0',
      metadata: {
        title: 'Minimal Questionnaire',
        createdAt: now,
        updatedAt: now,
        // no description, author, or tags
      },
      questions: [{ id: 'q1', type: 'text', text: 'A question', required: false }],
      // no config
    };

    const res = await request(app)
      .post('/api/questionnaires')
      .send(body)
      .set('Content-Type', 'application/json')
      .set(AUTH_HEADERS);

    expect(res.status).toBe(201);
  });

  it('returns 400 for missing required fields', async () => {
    const res = await request(app)
      .post('/api/questionnaires')
      .send({ id: 'q_bad' })
      .set('Content-Type', 'application/json')
      .set(AUTH_HEADERS);

    expect(res.status).toBe(400);
    expect(res.body).toMatchObject({ error: 'Invalid questionnaire' });
  });

  it('returns 400 for empty questions array', async () => {
    const now = new Date().toISOString();
    const body = {
      id: 'q_empty',
      version: '1.0',
      metadata: { title: 'Empty', createdAt: now, updatedAt: now },
      questions: [], // empty - violates min(1) constraint
    };

    const res = await request(app)
      .post('/api/questionnaires')
      .send(body)
      .set('Content-Type', 'application/json')
      .set(AUTH_HEADERS);

    expect(res.status).toBe(400);
  });

  it('returns 400 for invalid question type', async () => {
    const now = new Date().toISOString();
    const body = {
      id: 'q_invalid_type',
      version: '1.0',
      metadata: { title: 'Invalid', createdAt: now, updatedAt: now },
      questions: [{ id: 'q1', type: 'unknown_type', text: 'Test', required: false }],
    };

    const res = await request(app)
      .post('/api/questionnaires')
      .send(body)
      .set('Content-Type', 'application/json')
      .set(AUTH_HEADERS);

    expect(res.status).toBe(400);
  });

  it('returns 400 when body is not valid JSON (malformed)', async () => {
    const res = await request(app)
      .post('/api/questionnaires')
      .set('Content-Type', 'application/json')
      .set(AUTH_HEADERS)
      .send('{ invalid json }');

    expect(res.status).toBe(400);
  });

  it('returns 401 when no proxy auth headers are present', async () => {
    const body = makeQuestionnaire();
    const res = await request(app)
      .post('/api/questionnaires')
      .send(body)
      .set('Content-Type', 'application/json');
    // No AUTH_HEADERS — guest identity → requireAuth rejects
    expect(res.status).toBe(401);
  });
});

// ── GET /api/questionnaires ───────────────────────────────────────────────────

describe('GET /api/questionnaires', () => {
  it('returns empty array when no questionnaires exist', async () => {
    const res = await request(app)
      .get('/api/questionnaires')
      .set(AUTH_HEADERS);

    expect(res.status).toBe(200);
    expect(res.body).toEqual([]);
  });

  it('returns saved questionnaires after creation', async () => {
    const body = makeQuestionnaire();

    await request(app)
      .post('/api/questionnaires')
      .send(body)
      .set('Content-Type', 'application/json')
      .set(AUTH_HEADERS);

    const res = await request(app)
      .get('/api/questionnaires')
      .set(AUTH_HEADERS);

    expect(res.status).toBe(200);
    expect(res.body).toHaveLength(1);
    expect(res.body[0]).toMatchObject({ id: body.id });
  });

  it('uses metadata ACL fields to return only visible questionnaires with effective permissions', async () => {
    const ownerQuestionnaire = makeQuestionnaire({ id: 'q_owner_visible' });
    const ownerCreateRes = await request(app)
      .post('/api/questionnaires')
      .send(ownerQuestionnaire)
      .set('Content-Type', 'application/json')
      .set(AUTH_HEADERS);
    const currentUserId = (ownerCreateRes.body as { ownerId: string }).ownerId;

    const sharedQuestionnaire = makeQuestionnaire({
      id: 'q_shared_visible',
      permissions: [{ userId: currentUserId, level: 'respond' }],
    });
    await request(app)
      .post('/api/questionnaires')
      .send(sharedQuestionnaire)
      .set('Content-Type', 'application/json')
      .set({ 'remote-user': 'owner2@example.com', 'remote-name': 'Owner Two' });

    const hiddenQuestionnaire = makeQuestionnaire({ id: 'q_hidden' });
    await request(app)
      .post('/api/questionnaires')
      .send(hiddenQuestionnaire)
      .set('Content-Type', 'application/json')
      .set({ 'remote-user': 'owner3@example.com', 'remote-name': 'Owner Three' });

    const res = await request(app)
      .get('/api/questionnaires')
      .set(AUTH_HEADERS);

    expect(res.status).toBe(200);
    expect(res.body).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ id: ownerQuestionnaire.id, effectivePermission: 'manage' }),
        expect.objectContaining({ id: sharedQuestionnaire.id, effectivePermission: 'respond' }),
      ]),
    );
    expect((res.body as Array<{ id: string }>).map(q => q.id)).not.toContain(hiddenQuestionnaire.id as string);
  });

  it('returns 401 when no proxy auth headers are present', async () => {
    const res = await request(app).get('/api/questionnaires');
    expect(res.status).toBe(401);
  });
});

// ── GET /api/questionnaires/:id ───────────────────────────────────────────────

describe('GET /api/questionnaires/:id', () => {
  it('returns a saved questionnaire by ID', async () => {
    const body = makeQuestionnaire();

    await request(app)
      .post('/api/questionnaires')
      .send(body)
      .set('Content-Type', 'application/json')
      .set(AUTH_HEADERS);

    const res = await request(app)
      .get(`/api/questionnaires/${body.id as string}`)
      .set(AUTH_HEADERS);

    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({
      id: body.id,
      metadata: expect.objectContaining({ title: 'Test Questionnaire' }),
    });
  });

  it('returns 404 for non-existent questionnaire', async () => {
    const res = await request(app)
      .get('/api/questionnaires/does-not-exist')
      .set(AUTH_HEADERS);

    expect(res.status).toBe(404);
  });
});

// ── PUT /api/questionnaires/:id ───────────────────────────────────────────────

describe('PUT /api/questionnaires/:id', () => {
  it('updates an existing questionnaire', async () => {
    const body = makeQuestionnaire();

    await request(app)
      .post('/api/questionnaires')
      .send(body)
      .set('Content-Type', 'application/json')
      .set(AUTH_HEADERS);

    const updated = {
      ...body,
      metadata: { ...(body.metadata as Record<string, unknown>), title: 'Updated Title', updatedAt: new Date().toISOString() },
    };

    const res = await request(app)
      .put(`/api/questionnaires/${body.id as string}`)
      .send(updated)
      .set('Content-Type', 'application/json')
      .set(AUTH_HEADERS);

    expect(res.status).toBe(200);
    expect(res.body.metadata.title).toBe('Updated Title');
  });

  it('returns 400 when path ID does not match body ID', async () => {
    const body = makeQuestionnaire();

    // Create the questionnaire so the ACL check passes
    await request(app)
      .post('/api/questionnaires')
      .send(body)
      .set('Content-Type', 'application/json')
      .set(AUTH_HEADERS);

    // PUT to the questionnaire's correct path, but with a different id in the body → 400
    const mismatchedBody = { ...body, id: `${body.id as string}-different` };
    const res = await request(app)
      .put(`/api/questionnaires/${body.id as string}`)
      .send(mismatchedBody)
      .set('Content-Type', 'application/json')
      .set(AUTH_HEADERS);

    expect(res.status).toBe(400);
    expect(res.body).toMatchObject({ error: expect.stringContaining('ID') });
  });

  it('returns 400 for invalid questionnaire body', async () => {
    const existing = makeQuestionnaire();

    // Create the questionnaire so the ACL check passes
    await request(app)
      .post('/api/questionnaires')
      .send(existing)
      .set('Content-Type', 'application/json')
      .set(AUTH_HEADERS);

    const res = await request(app)
      .put(`/api/questionnaires/${existing.id as string}`)
      .send({ id: existing.id }) // missing required fields → 400
      .set('Content-Type', 'application/json')
      .set(AUTH_HEADERS);

    expect(res.status).toBe(400);
  });
});

// ── DELETE /api/questionnaires/:id ────────────────────────────────────────────

describe('DELETE /api/questionnaires/:id', () => {
  it('deletes an existing questionnaire', async () => {
    const body = makeQuestionnaire();

    await request(app)
      .post('/api/questionnaires')
      .send(body)
      .set('Content-Type', 'application/json')
      .set(AUTH_HEADERS);

    const deleteRes = await request(app)
      .delete(`/api/questionnaires/${body.id as string}`)
      .set(AUTH_HEADERS);
    expect(deleteRes.status).toBe(204);

    const getRes = await request(app)
      .get(`/api/questionnaires/${body.id as string}`)
      .set(AUTH_HEADERS);
    expect(getRes.status).toBe(404);
  });
});

// ── GET /api/responses ────────────────────────────────────────────────────────

describe('GET /api/responses', () => {
  it('returns empty array when no responses exist for a questionnaire', async () => {
    const q = makeQuestionnaire();
    await request(app)
      .post('/api/questionnaires')
      .send(q)
      .set('Content-Type', 'application/json')
      .set(AUTH_HEADERS);

    const res = await request(app)
      .get(`/api/responses?questionnaireId=${q.id as string}`)
      .set(AUTH_HEADERS);

    expect(res.status).toBe(200);
    expect(res.body).toEqual([]);
  });
});

// ── GET /api/responses/:id ────────────────────────────────────────────────────

describe('GET /api/responses/:id', () => {
  it('returns 404 for non-existent response', async () => {
    const res = await request(app)
      .get('/api/responses/does-not-exist')
      .set(AUTH_HEADERS);

    expect(res.status).toBe(404);
  });

  it('returns a response after a session is started', async () => {
    // Create questionnaire first
    const q = makeQuestionnaire();
    await request(app)
      .post('/api/questionnaires')
      .send(q)
      .set('Content-Type', 'application/json')
      .set(AUTH_HEADERS);

    // Start a session
    const sessionRes = await request(app)
      .post('/api/sessions')
      .send({ questionnaireId: q.id })
      .set('Content-Type', 'application/json')
      .set(AUTH_HEADERS);
    expect(sessionRes.status).toBe(201);
    const { sessionId } = sessionRes.body as { sessionId: string };

    // Fetch the response using the session ID
    const res = await request(app)
      .get(`/api/responses/${sessionId}`)
      .set(AUTH_HEADERS);
    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({
      questionnaireId: q.id,
    });
  });
});

// ── POST /api/sessions ────────────────────────────────────────────────────────

describe('POST /api/sessions', () => {
  it('returns 400 when questionnaireId is missing', async () => {
    const res = await request(app)
      .post('/api/sessions')
      .send({})
      .set('Content-Type', 'application/json')
      .set(AUTH_HEADERS);

    expect(res.status).toBe(400);
    expect(res.body).toMatchObject({ error: expect.stringContaining('questionnaireId') });
  });

  it('returns 404 when questionnaire does not exist', async () => {
    const res = await request(app)
      .post('/api/sessions')
      .send({ questionnaireId: 'non-existent-id' })
      .set('Content-Type', 'application/json')
      .set(AUTH_HEADERS);

    expect(res.status).toBe(404);
  });

  it('creates a session for an existing questionnaire and returns sessionId', async () => {
    const q = makeQuestionnaire();
    await request(app)
      .post('/api/questionnaires')
      .send(q)
      .set('Content-Type', 'application/json')
      .set(AUTH_HEADERS);

    const res = await request(app)
      .post('/api/sessions')
      .send({ questionnaireId: q.id })
      .set('Content-Type', 'application/json')
      .set(AUTH_HEADERS);

    expect(res.status).toBe(201);
    expect(res.body).toHaveProperty('sessionId');
    expect(typeof res.body.sessionId).toBe('string');
  });

  it('returns 401 when no proxy auth headers are present', async () => {
    const res = await request(app)
      .post('/api/sessions')
      .send({ questionnaireId: 'any-id' })
      .set('Content-Type', 'application/json');
    // No AUTH_HEADERS — guest identity → requireAuth rejects
    expect(res.status).toBe(401);
  });
});

// ── GET /api/sessions/:sessionId ──────────────────────────────────────────────

describe('GET /api/sessions/:sessionId', () => {
  it('returns 404 for a non-existent session', async () => {
    const res = await request(app).get('/api/sessions/does-not-exist');

    expect(res.status).toBe(404);
  });

  it('returns current session state including the first question', async () => {
    const q = makeQuestionnaire();
    await request(app)
      .post('/api/questionnaires')
      .send(q)
      .set('Content-Type', 'application/json')
      .set(AUTH_HEADERS);

    const sessionRes = await request(app)
      .post('/api/sessions')
      .send({ questionnaireId: q.id })
      .set('Content-Type', 'application/json')
      .set(AUTH_HEADERS);
    const { sessionId } = sessionRes.body as { sessionId: string };

    const res = await request(app)
      .get(`/api/sessions/${sessionId}`)
      .set(AUTH_HEADERS);

    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({
      questionnaire: expect.objectContaining({
        id: q.id,
        title: 'Test Questionnaire',
        totalQuestions: 1,
      }),
      currentQuestion: expect.objectContaining({ id: 'q1', type: 'text' }),
      currentQuestionIndex: 0,
    });
  });
});

// ── POST /api/sessions/:sessionId/answer ──────────────────────────────────────

describe('POST /api/sessions/:sessionId/answer', () => {
  it('returns 404 for a non-existent session', async () => {
    const res = await request(app)
      .post('/api/sessions/does-not-exist/answer')
      .send({ questionId: 'q1', value: 'hello' })
      .set('Content-Type', 'application/json');

    expect(res.status).toBe(404);
  });

  it('returns 400 when questionId is missing', async () => {
    const q = makeQuestionnaire();
    await request(app)
      .post('/api/questionnaires')
      .send(q)
      .set('Content-Type', 'application/json')
      .set(AUTH_HEADERS);

    const sessionRes = await request(app)
      .post('/api/sessions')
      .send({ questionnaireId: q.id })
      .set('Content-Type', 'application/json')
      .set(AUTH_HEADERS);
    const { sessionId } = sessionRes.body as { sessionId: string };

    const res = await request(app)
      .post(`/api/sessions/${sessionId}/answer`)
      .send({ value: 'hello' })
      .set('Content-Type', 'application/json')
      .set(AUTH_HEADERS);

    expect(res.status).toBe(400);
    expect(res.body).toMatchObject({ error: expect.stringContaining('questionId') });
  });

  it('advances to the next question and marks complete for a single-question questionnaire', async () => {
    const q = makeQuestionnaire();
    await request(app)
      .post('/api/questionnaires')
      .send(q)
      .set('Content-Type', 'application/json')
      .set(AUTH_HEADERS);

    const sessionRes = await request(app)
      .post('/api/sessions')
      .send({ questionnaireId: q.id })
      .set('Content-Type', 'application/json')
      .set(AUTH_HEADERS);
    const { sessionId } = sessionRes.body as { sessionId: string };

    const res = await request(app)
      .post(`/api/sessions/${sessionId}/answer`)
      .send({ questionId: 'q1', value: 'Test Answer' })
      .set('Content-Type', 'application/json')
      .set(AUTH_HEADERS);

    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({
      isComplete: true,
      nextQuestion: null,
    });
  });

  it('advances to the next question for a multi-question questionnaire', async () => {
    const q = makeQuestionnaire({
      questions: [
        { id: 'q1', type: 'text', text: 'First question', required: false },
        { id: 'q2', type: 'text', text: 'Second question', required: false },
      ],
      config: { allowBack: true, showProgress: true, shuffleQuestions: false, allowSkip: true },
    });

    await request(app)
      .post('/api/questionnaires')
      .send(q)
      .set('Content-Type', 'application/json')
      .set(AUTH_HEADERS);

    const sessionRes = await request(app)
      .post('/api/sessions')
      .send({ questionnaireId: q.id })
      .set('Content-Type', 'application/json')
      .set(AUTH_HEADERS);
    const { sessionId } = sessionRes.body as { sessionId: string };

    const res = await request(app)
      .post(`/api/sessions/${sessionId}/answer`)
      .send({ questionId: 'q1', value: 'First Answer' })
      .set('Content-Type', 'application/json')
      .set(AUTH_HEADERS);

    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({
      isComplete: false,
      nextQuestion: expect.objectContaining({ id: 'q2' }),
      nextQuestionIndex: 1,
    });
  });
});

// ── POST /api/sessions/:sessionId/complete ────────────────────────────────────

describe('POST /api/sessions/:sessionId/complete', () => {
  it('returns 404 for a non-existent session', async () => {
    const res = await request(app)
      .post('/api/sessions/does-not-exist/complete')
      .send({})
      .set('Content-Type', 'application/json');

    expect(res.status).toBe(404);
  });

  it('completes an active session and returns success', async () => {
    const q = makeQuestionnaire();
    await request(app)
      .post('/api/questionnaires')
      .send(q)
      .set('Content-Type', 'application/json')
      .set(AUTH_HEADERS);

    const sessionRes = await request(app)
      .post('/api/sessions')
      .send({ questionnaireId: q.id })
      .set('Content-Type', 'application/json')
      .set(AUTH_HEADERS);
    const { sessionId } = sessionRes.body as { sessionId: string };

    const res = await request(app)
      .post(`/api/sessions/${sessionId}/complete`)
      .send({})
      .set('Content-Type', 'application/json')
      .set(AUTH_HEADERS);

    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({ success: true });

    // Ensure the returned sessionId is usable with GET /api/responses/:id
    const { sessionId: completedSessionId } = res.body as { sessionId: string };
    expect(typeof completedSessionId).toBe('string');
    expect(completedSessionId.length).toBeGreaterThan(0);

    const getRes = await request(app)
      .get(`/api/responses/${completedSessionId}`)
      .set(AUTH_HEADERS);
    expect(getRes.status).toBe(200);
    expect(getRes.body).toMatchObject({ questionnaireId: q.id });
  });

  it('returns response listed in GET /api/responses after completing', async () => {
    const q = makeQuestionnaire();
    await request(app)
      .post('/api/questionnaires')
      .send(q)
      .set('Content-Type', 'application/json')
      .set(AUTH_HEADERS);

    const sessionRes = await request(app)
      .post('/api/sessions')
      .send({ questionnaireId: q.id })
      .set('Content-Type', 'application/json')
      .set(AUTH_HEADERS);
    const { sessionId } = sessionRes.body as { sessionId: string };

    await request(app)
      .post(`/api/sessions/${sessionId}/complete`)
      .send({})
      .set('Content-Type', 'application/json')
      .set(AUTH_HEADERS);

    const listRes = await request(app)
      .get(`/api/responses?questionnaireId=${q.id as string}`)
      .set(AUTH_HEADERS);
    expect(listRes.status).toBe(200);
    expect(listRes.body.length).toBeGreaterThan(0);

    const filterRes = await request(app)
      .get(`/api/responses?questionnaireId=${q.id as string}`)
      .set(AUTH_HEADERS);
    expect(filterRes.status).toBe(200);
    expect(filterRes.body).toHaveLength(1);
    expect(filterRes.body[0]).toMatchObject({ questionnaireId: q.id });
  });
});

// ── Full run → view response flow ─────────────────────────────────────────────

describe('Full run-questionnaire → view-response flow', () => {
  it('completed response is findable by sessionId in the response list and via direct fetch', async () => {
    // 1. Create a two-question questionnaire
    const q = makeQuestionnaire({
      questions: [
        { id: 'q1', type: 'text', text: 'What is your name?', required: false },
        { id: 'q2', type: 'text', text: 'What is your age?', required: false },
      ],
    });
    await request(app)
      .post('/api/questionnaires')
      .send(q)
      .set('Content-Type', 'application/json')
      .set(AUTH_HEADERS);

    // 2. Start session
    const sessionRes = await request(app)
      .post('/api/sessions')
      .send({ questionnaireId: q.id })
      .set('Content-Type', 'application/json')
      .set(AUTH_HEADERS);
    expect(sessionRes.status).toBe(201);
    const { sessionId } = sessionRes.body as { sessionId: string };

    // 3. Answer first question
    const ans1 = await request(app)
      .post(`/api/sessions/${sessionId}/answer`)
      .send({ questionId: 'q1', value: 'Alice' })
      .set('Content-Type', 'application/json')
      .set(AUTH_HEADERS);
    expect(ans1.status).toBe(200);
    expect(ans1.body.isComplete).toBe(false);

    // 4. Answer second (final) question — session becomes complete
    const ans2 = await request(app)
      .post(`/api/sessions/${sessionId}/answer`)
      .send({ questionId: 'q2', value: '30' })
      .set('Content-Type', 'application/json')
      .set(AUTH_HEADERS);
    expect(ans2.status).toBe(200);
    expect(ans2.body.isComplete).toBe(true);

    // 5. Complete the session (as the runner UI does)
    const completeRes = await request(app)
      .post(`/api/sessions/${sessionId}/complete`)
      .send({})
      .set('Content-Type', 'application/json')
      .set(AUTH_HEADERS);
    expect(completeRes.status).toBe(200);
    expect(completeRes.body).toMatchObject({ success: true, sessionId });

    // 6. Fetch all responses — the UI (responses.html) does this to build the list
    //    and then searches for r.sessionId === sessionId
    const listRes = await request(app)
      .get(`/api/responses?questionnaireId=${q.id as string}`)
      .set(AUTH_HEADERS);
    expect(listRes.status).toBe(200);
    const found = (listRes.body as Array<{ sessionId: string; questionnaireId: string; status: string; answers: unknown[] }>)
      .find(r => r.sessionId === sessionId);
    expect(found).toBeDefined();
    expect(found).toMatchObject({
      questionnaireId: q.id,
      status: 'completed',
      sessionId,
    });
    expect(found!.answers).toHaveLength(2);

    // 7. Fetch the response directly by sessionId (as GET /api/responses/:id does)
    const directRes = await request(app)
      .get(`/api/responses/${sessionId}`)
      .set(AUTH_HEADERS);
    expect(directRes.status).toBe(200);
    expect(directRes.body).toMatchObject({
      questionnaireId: q.id,
      status: 'completed',
      sessionId,
    });
    expect(directRes.body.answers).toHaveLength(2);
  });
});

// ── Guest identity (issue: "allow guest user") ────────────────────────────────

describe('Guest identity when no auth headers are provided', () => {
  it('GET /api/auth/me returns the built-in guest user when no headers are sent', async () => {
    const res = await request(app).get('/api/auth/me');
    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({
      user: {
        id: 'guest',
        email: 'guest@localhost',
        name: 'Guest',
        groups: [],
      },
    });
  });

  it('still returns the guest identity when REQUIRE_PROXY_AUTH=true is set', async () => {
    // In the default server middleware stack exercised by this test, requests
    // without identity headers are resolved to the guest sentinel and
    // requireProxyAuth is not registered, so setting REQUIRE_PROXY_AUTH=true
    // does not change the outcome here.
    const original = process.env['REQUIRE_PROXY_AUTH'];
    process.env['REQUIRE_PROXY_AUTH'] = 'true';
    try {
      const res = await request(app).get('/api/auth/me');
      expect(res.status).toBe(200);
      expect(res.body.user.id).toBe('guest');
    } finally {
      if (original === undefined) {
        delete process.env['REQUIRE_PROXY_AUTH'];
      } else {
        process.env['REQUIRE_PROXY_AUTH'] = original;
      }
    }
  });
});

// ── OpenFGA integration ────────────────────────────────────────────────────────

describe('OpenFGA permissions integration', () => {
  const originalApiUrl = process.env['OPENFGA_API_URL'];
  const originalStoreId = process.env['OPENFGA_STORE_ID'];
  const originalModelId = process.env['OPENFGA_AUTHORIZATION_MODEL_ID'];
  const originalToken = process.env['OPENFGA_API_TOKEN'];
  const originalFetch = globalThis.fetch;

  const configureOpenFga = () => {
    process.env['OPENFGA_API_URL'] = 'https://openfga.example.test';
    process.env['OPENFGA_STORE_ID'] = 'store-123';
    delete process.env['OPENFGA_AUTHORIZATION_MODEL_ID'];
    delete process.env['OPENFGA_API_TOKEN'];
  };

  const restoreOpenFgaEnv = () => {
    if (originalApiUrl === undefined) delete process.env['OPENFGA_API_URL'];
    else process.env['OPENFGA_API_URL'] = originalApiUrl;
    if (originalStoreId === undefined) delete process.env['OPENFGA_STORE_ID'];
    else process.env['OPENFGA_STORE_ID'] = originalStoreId;
    if (originalModelId === undefined) delete process.env['OPENFGA_AUTHORIZATION_MODEL_ID'];
    else process.env['OPENFGA_AUTHORIZATION_MODEL_ID'] = originalModelId;
    if (originalToken === undefined) delete process.env['OPENFGA_API_TOKEN'];
    else process.env['OPENFGA_API_TOKEN'] = originalToken;
  };

  const parseRelation = (call: unknown[] | undefined): string | undefined => {
    const init = call?.[1] as RequestInit | undefined;
    const rawBody = init?.body;
    if (typeof rawBody !== 'string') return undefined;
    const parsed = JSON.parse(rawBody) as { tuple_key?: { relation?: string } };
    return parsed.tuple_key?.relation;
  };

  const parseObject = (call: unknown[] | undefined): string | undefined => {
    const init = call?.[1] as RequestInit | undefined;
    const rawBody = init?.body;
    if (typeof rawBody !== 'string') return undefined;
    const parsed = JSON.parse(rawBody) as { tuple_key?: { object?: string } };
    return parsed.tuple_key?.object;
  };

  afterAll(() => {
    restoreOpenFgaEnv();
    globalThis.fetch = originalFetch;
  });

  it('checks view_app permission before serving config.js when OpenFGA is enabled', async () => {
    configureOpenFga();
    const fetchMock = jest.fn(async () => {
      return new Response(JSON.stringify({ allowed: false }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      });
    });
    globalThis.fetch = fetchMock as unknown as typeof fetch;

    const { app: openFgaApp } = await import(`../../web/server.js?openfga-view-app=${Date.now()}`);
    const res = await request(openFgaApp).get('/config.js').set(AUTH_HEADERS);

    expect(res.status).toBe(403);
    expect(fetchMock).toHaveBeenCalledTimes(1);
    const call = fetchMock.mock.calls[0] as unknown[] | undefined;
    expect(String(call?.[0])).toBe('https://openfga.example.test/stores/store-123/check');
    expect(parseRelation(call)).toBe('view_app');
    expect(parseObject(call)).toBe('app:questionnaire');
  });

  it('checks create_questionnaire permission on POST /api/questionnaires', async () => {
    configureOpenFga();
    const fetchMock = jest.fn(async () => {
      return new Response(JSON.stringify({ allowed: false }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      });
    });
    globalThis.fetch = fetchMock as unknown as typeof fetch;

    const { app: openFgaApp } = await import(`../../web/server.js?openfga-create-q=${Date.now()}`);
    const res = await request(openFgaApp)
      .post('/api/questionnaires')
      .send(makeQuestionnaire())
      .set('Content-Type', 'application/json')
      .set(AUTH_HEADERS);

    expect(res.status).toBe(403);
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(parseRelation(fetchMock.mock.calls[0])).toBe('create_questionnaire');
    expect(parseObject(fetchMock.mock.calls[0])).toBe('app:questionnaire');
  });

  it('returns 404 before OpenFGA check for unknown questionnaires', async () => {
    configureOpenFga();
    const fetchMock = jest.fn(async () => {
      return new Response(JSON.stringify({ allowed: true }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      });
    });
    globalThis.fetch = fetchMock as unknown as typeof fetch;

    const { app: openFgaApp } = await import(`../../web/server.js?openfga-missing-q=${Date.now()}`);
    const res = await request(openFgaApp).get('/api/questionnaires/does-not-exist').set(AUTH_HEADERS);

    expect(res.status).toBe(404);
    expect(fetchMock).toHaveBeenCalledTimes(0);
  });

  it('returns 404 before OpenFGA check for unknown questionnaires in responses/session routes', async () => {
    configureOpenFga();
    const fetchMock = jest.fn(async () => {
      return new Response(JSON.stringify({ allowed: true }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      });
    });
    globalThis.fetch = fetchMock as unknown as typeof fetch;

    const { app: openFgaApp } = await import(`../../web/server.js?openfga-missing-response-q=${Date.now()}`);
    const listRes = await request(openFgaApp)
      .get('/api/responses?questionnaireId=does-not-exist')
      .set(AUTH_HEADERS);
    expect(listRes.status).toBe(404);

    const startSessionRes = await request(openFgaApp)
      .post('/api/sessions')
      .send({ questionnaireId: 'does-not-exist' })
      .set('Content-Type', 'application/json')
      .set(AUTH_HEADERS);
    expect(startSessionRes.status).toBe(404);

    expect(fetchMock).toHaveBeenCalledTimes(0);
  });

  it('returns 404 before OpenFGA check for unknown responses', async () => {
    configureOpenFga();
    const fetchMock = jest.fn(async () => {
      return new Response(JSON.stringify({ allowed: true }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      });
    });
    globalThis.fetch = fetchMock as unknown as typeof fetch;

    const { app: openFgaApp } = await import(`../../web/server.js?openfga-missing-response=${Date.now()}`);
    const res = await request(openFgaApp).get('/api/responses/does-not-exist').set(AUTH_HEADERS);

    expect(res.status).toBe(404);
    expect(fetchMock).toHaveBeenCalledTimes(0);
  });

  it('checks view_questionnaire, create_response, and view_response permissions on protected routes', async () => {
    configureOpenFga();
    const fetchMock = jest.fn(async () => {
      return new Response(JSON.stringify({ allowed: true }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      });
    });
    globalThis.fetch = fetchMock as unknown as typeof fetch;

    const { app: openFgaApp } = await import(`../../web/server.js?openfga-flow=${Date.now()}`);
    const questionnaire = makeQuestionnaire();

    const createRes = await request(openFgaApp)
      .post('/api/questionnaires')
      .send(questionnaire)
      .set('Content-Type', 'application/json')
      .set(AUTH_HEADERS);
    expect(createRes.status).toBe(201);

    const viewQuestionnaireRes = await request(openFgaApp)
      .get(`/api/questionnaires/${questionnaire.id as string}`)
      .set(AUTH_HEADERS);
    expect(viewQuestionnaireRes.status).toBe(200);

    const createResponseRes = await request(openFgaApp)
      .post('/api/sessions')
      .send({ questionnaireId: questionnaire.id })
      .set('Content-Type', 'application/json')
      .set(AUTH_HEADERS);
    expect(createResponseRes.status).toBe(201);
    const { sessionId } = createResponseRes.body as { sessionId: string };

    const viewResponseRes = await request(openFgaApp)
      .get(`/api/responses/${sessionId}`)
      .set(AUTH_HEADERS);
    expect(viewResponseRes.status).toBe(200);

    const relations = fetchMock.mock.calls.map(parseRelation);
    expect(relations).toContain('view_questionnaire');
    expect(relations).toContain('create_response');
    expect(relations).toContain('view_response');
    const objects = fetchMock.mock.calls.map(parseObject);
    expect(objects).toContain(`questionnaire:${String(questionnaire.id)}`);
    expect(objects.some(object => typeof object === 'string' && object.startsWith('response:'))).toBe(true);
  });
});


// ── GET /config.js ────────────────────────────────────────────────────────────

describe('GET /config.js', () => {
  it('returns a JavaScript snippet setting window.APP_BASE', async () => {
    const res = await request(app).get('/config.js');

    expect(res.status).toBe(200);
    expect(res.headers['content-type']).toMatch(/application\/javascript/);
    expect(res.text).toContain('window.APP_BASE');
  });

  it('sets window.APP_BASE to an empty string when BASE_PATH is not set', async () => {
    const res = await request(app).get('/config.js');

    expect(res.status).toBe(200);
    expect(res.text).toBe('window.APP_BASE = "";');
  });
});

// ── CORS Wildcard ────────────────────────────────────────────────────────────

describe('CORS Wildcard handling', () => {
  it('allows any origin when CORS_ORIGINS=* is set', async () => {
    const originalNodeEnv = process.env['NODE_ENV'];
    const originalCorsOrigins = process.env['CORS_ORIGINS'];

    process.env['NODE_ENV'] = 'production'; // so it doesn't use the simple dev cors()
    process.env['CORS_ORIGINS'] = '*';

    try {
      const { app: wildcardApp } = await import(`../../web/server.js?cors-wildcard-check=${Date.now()}`);
      const res = await request(wildcardApp)
        .get('/api/auth/me')
        .set('Origin', 'https://random-site.com');

      expect(res.status).toBe(200);
      // The cors package returns the actual origin when matched against a wildcard
      expect(res.header['access-control-allow-origin']).toBe('https://random-site.com');
    } finally {
      process.env['NODE_ENV'] = originalNodeEnv;
      if (originalCorsOrigins === undefined) {
        delete process.env['CORS_ORIGINS'];
      } else {
        process.env['CORS_ORIGINS'] = originalCorsOrigins;
      }
    }
  });

  it('allows any origin when * is in a comma-separated list', async () => {
    const originalNodeEnv = process.env['NODE_ENV'];
    const originalCorsOrigins = process.env['CORS_ORIGINS'];

    process.env['NODE_ENV'] = 'production';
    process.env['CORS_ORIGINS'] = 'https://trusted.com, *';

    try {
      const { app: wildcardApp } = await import(`../../web/server.js?cors-list-wildcard-check=${Date.now()}`);
      const res = await request(wildcardApp)
        .get('/api/auth/me')
        .set('Origin', 'https://another-site.com');

      expect(res.status).toBe(200);
      expect(res.header['access-control-allow-origin']).toBe('https://another-site.com');
    } finally {
      process.env['NODE_ENV'] = originalNodeEnv;
      if (originalCorsOrigins === undefined) {
        delete process.env['CORS_ORIGINS'];
      } else {
        process.env['CORS_ORIGINS'] = originalCorsOrigins;
      }
    }
  });
});


// ── GET /logout ────────────────────────────────────────────────────────────────

describe('GET /logout', () => {
  it('redirects to AUTH_LOGOUT_URL when configured with a safe absolute URL', async () => {
    const original = process.env['AUTH_LOGOUT_URL'];
    process.env['AUTH_LOGOUT_URL'] = 'https://auth.example.com/logout';
    try {
      const res = await request(app).get('/logout');
      expect(res.status).toBe(302);
      expect(res.headers['location']).toBe('https://auth.example.com/logout');
    } finally {
      if (original === undefined) {
        delete process.env['AUTH_LOGOUT_URL'];
      } else {
        process.env['AUTH_LOGOUT_URL'] = original;
      }
    }
  });

  it('falls back to app root when AUTH_LOGOUT_URL is not configured', async () => {
    const original = process.env['AUTH_LOGOUT_URL'];
    delete process.env['AUTH_LOGOUT_URL'];
    try {
      const res = await request(app).get('/logout');
      expect(res.status).toBe(302);
      expect(res.headers['location']).toBe('/');
    } finally {
      if (original === undefined) {
        delete process.env['AUTH_LOGOUT_URL'];
      } else {
        process.env['AUTH_LOGOUT_URL'] = original;
      }
    }
  });

  it('falls back to app root for unsafe AUTH_LOGOUT_URL values', async () => {
    const original = process.env['AUTH_LOGOUT_URL'];
    process.env['AUTH_LOGOUT_URL'] = 'javascript:alert(1)';
    try {
      const res = await request(app).get('/logout');
      expect(res.status).toBe(302);
      expect(res.headers['location']).toBe('/');
    } finally {
      if (original === undefined) {
        delete process.env['AUTH_LOGOUT_URL'];
      } else {
        process.env['AUTH_LOGOUT_URL'] = original;
      }
    }
  });

  it('falls back for encoded path traversal in AUTH_LOGOUT_URL', async () => {
    const original = process.env['AUTH_LOGOUT_URL'];
    // /%2e%2e/ is /../
    process.env['AUTH_LOGOUT_URL'] = '/%2e%2e/secret';
    try {
      const res = await request(app).get('/logout');
      expect(res.status).toBe(302);
      expect(res.headers['location']).toBe('/');
    } finally {
      if (original === undefined) {
        delete process.env['AUTH_LOGOUT_URL'];
      } else {
        process.env['AUTH_LOGOUT_URL'] = original;
      }
    }
  });

  it('falls back for encoded protocol-relative paths in AUTH_LOGOUT_URL', async () => {
    const original = process.env['AUTH_LOGOUT_URL'];
    // /%2f/evil.com is //evil.com
    process.env['AUTH_LOGOUT_URL'] = '/%2f/evil.com';
    try {
      const res = await request(app).get('/logout');
      expect(res.status).toBe(302);
      expect(res.headers['location']).toBe('/');
    } finally {
      if (original === undefined) {
        delete process.env['AUTH_LOGOUT_URL'];
      } else {
        process.env['AUTH_LOGOUT_URL'] = original;
      }
    }
  });

  it('falls back to BASE_PATH root when BASE_PATH is configured', async () => {
    const originalBasePath = process.env['BASE_PATH'];
    const originalLogoutUrl = process.env['AUTH_LOGOUT_URL'];
    process.env['BASE_PATH'] = '/test-base';
    delete process.env['AUTH_LOGOUT_URL'];

    try {
      const { app: basePathApp } = await import(`../../web/server.js?logout-base-path=${Date.now()}`);
      const res = await request(basePathApp).get('/test-base/logout');
      expect(res.status).toBe(302);
      expect(res.headers['location']).toBe('/test-base');
    } finally {
      if (originalBasePath === undefined) {
        delete process.env['BASE_PATH'];
      } else {
        process.env['BASE_PATH'] = originalBasePath;
      }
      if (originalLogoutUrl === undefined) {
        delete process.env['AUTH_LOGOUT_URL'];
      } else {
        process.env['AUTH_LOGOUT_URL'] = originalLogoutUrl;
      }
    }
  });
});
