/**
 * Server API Integration Tests
 *
 * Tests for the Express web server API endpoints.
 * Covers questionnaire CRUD operations to prevent regression of HTTP 500 errors.
 */

import { describe, it, expect, beforeAll, afterAll, beforeEach } from '@jest/globals';
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
      .set('Content-Type', 'application/json');

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
      .set('Content-Type', 'application/json');

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
      .set('Content-Type', 'application/json');

    expect(res.status).toBe(201);
  });

  it('returns 400 for missing required fields', async () => {
    const res = await request(app)
      .post('/api/questionnaires')
      .send({ id: 'q_bad' })
      .set('Content-Type', 'application/json');

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
      .set('Content-Type', 'application/json');

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
      .set('Content-Type', 'application/json');

    expect(res.status).toBe(400);
  });

  it('returns 400 when body is not valid JSON (malformed)', async () => {
    const res = await request(app)
      .post('/api/questionnaires')
      .set('Content-Type', 'application/json')
      .send('{ invalid json }');

    expect(res.status).toBe(400);
  });
});

// ── GET /api/questionnaires ───────────────────────────────────────────────────

describe('GET /api/questionnaires', () => {
  it('returns empty array when no questionnaires exist', async () => {
    const res = await request(app).get('/api/questionnaires');

    expect(res.status).toBe(200);
    expect(res.body).toEqual([]);
  });

  it('returns saved questionnaires after creation', async () => {
    const body = makeQuestionnaire();

    await request(app)
      .post('/api/questionnaires')
      .send(body)
      .set('Content-Type', 'application/json');

    const res = await request(app).get('/api/questionnaires');

    expect(res.status).toBe(200);
    expect(res.body).toHaveLength(1);
    expect(res.body[0]).toMatchObject({ id: body.id });
  });
});

// ── GET /api/questionnaires/:id ───────────────────────────────────────────────

describe('GET /api/questionnaires/:id', () => {
  it('returns a saved questionnaire by ID', async () => {
    const body = makeQuestionnaire();

    await request(app)
      .post('/api/questionnaires')
      .send(body)
      .set('Content-Type', 'application/json');

    const res = await request(app).get(`/api/questionnaires/${body.id as string}`);

    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({
      id: body.id,
      metadata: expect.objectContaining({ title: 'Test Questionnaire' }),
    });
  });

  it('returns 404 for non-existent questionnaire', async () => {
    const res = await request(app).get('/api/questionnaires/does-not-exist');

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
      .set('Content-Type', 'application/json');

    const updated = {
      ...body,
      metadata: { ...(body.metadata as Record<string, unknown>), title: 'Updated Title', updatedAt: new Date().toISOString() },
    };

    const res = await request(app)
      .put(`/api/questionnaires/${body.id as string}`)
      .send(updated)
      .set('Content-Type', 'application/json');

    expect(res.status).toBe(200);
    expect(res.body.metadata.title).toBe('Updated Title');
  });

  it('returns 400 when path ID does not match body ID', async () => {
    const body = makeQuestionnaire();

    const res = await request(app)
      .put('/api/questionnaires/wrong-id')
      .send(body)
      .set('Content-Type', 'application/json');

    expect(res.status).toBe(400);
    expect(res.body).toMatchObject({ error: expect.stringContaining('ID') });
  });

  it('returns 400 for invalid questionnaire body', async () => {
    const res = await request(app)
      .put('/api/questionnaires/q_test')
      .send({ id: 'q_test' })
      .set('Content-Type', 'application/json');

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
      .set('Content-Type', 'application/json');

    const deleteRes = await request(app).delete(`/api/questionnaires/${body.id as string}`);
    expect(deleteRes.status).toBe(204);

    const getRes = await request(app).get(`/api/questionnaires/${body.id as string}`);
    expect(getRes.status).toBe(404);
  });
});

// ── GET /api/responses ────────────────────────────────────────────────────────

describe('GET /api/responses', () => {
  it('returns empty array when no responses exist', async () => {
    const res = await request(app).get('/api/responses');

    expect(res.status).toBe(200);
    expect(res.body).toEqual([]);
  });
});
