/**
 * End-to-End Tests – Critical User Flows
 *
 * These tests exercise complete, multi-step user journeys through the HTTP API,
 * ensuring that the major workflows function correctly from start to finish.
 *
 * Covered flows:
 *  1. Complete questionnaire journey: create → start session → answer all questions → complete → retrieve response
 *  2. User authentication lifecycle: register → login → access protected route → change password → logout
 *  3. Questionnaire CRUD lifecycle: create → list → get → update → delete
 *  4. Response analytics flow: authenticated user completes responses then views stats/summary/export
 *  5. Multi-question session with skipping: start → skip some questions → complete
 *  6. Unauthenticated access to protected routes is rejected
 *  7. Invalid data and error-path handling
 */

import { describe, it, expect, beforeAll, afterAll, beforeEach } from '@jest/globals';
import { promises as fs } from 'fs';
import path from 'path';
import type { Express } from 'express';
import request from 'supertest';

// DATA_DIR must be set before importing the server so FileStorageService uses our test directory.
const TEST_DATA_DIR = path.join(process.cwd(), 'test-data', 'e2e-user-flows');
const originalDataDir = process.env['DATA_DIR'];
process.env['DATA_DIR'] = TEST_DATA_DIR;

// `app` is populated inside `beforeAll` (after DATA_DIR is set) so that the dynamic
// import always picks up this file's TEST_DATA_DIR even if the Jest worker has already
// evaluated another test file that also imports server.js.
let app: Express;

// ── Helpers ───────────────────────────────────────────────────────────────────

let idCounter = 0;
function uid(): string {
  return `e2e_${Date.now()}_${++idCounter}`;
}

function makeQuestionnaire(overrides: Record<string, unknown> = {}): Record<string, unknown> {
  const now = new Date().toISOString();
  return {
    id: uid(),
    version: '1.0',
    metadata: {
      title: 'E2E Test Questionnaire',
      createdAt: now,
      updatedAt: now,
      tags: ['e2e'],
    },
    questions: [
      { id: 'q1', type: 'text', text: 'What is your name?', required: false },
      { id: 'q2', type: 'email', text: 'What is your email?', required: false },
      { id: 'q3', type: 'number', text: 'How old are you?', required: false },
    ],
    config: {
      allowBack: true,
      showProgress: true,
      shuffleQuestions: false,
      allowSkip: true,
    },
    ...overrides,
  };
}

// ── Setup / Teardown ──────────────────────────────────────────────────────────

beforeAll(async () => {
  await fs.mkdir(TEST_DATA_DIR, { recursive: true });
  // Import the server after DATA_DIR is set so FileStorageService uses our test directory.
  // NODE_ENV=test (set by Jest) prevents the server from binding to a TCP port.
  const server = await import('../../web/server.js');
  app = server.app;
});

afterAll(async () => {
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
  // Wipe data between tests to keep them isolated
  try {
    await fs.rm(TEST_DATA_DIR, { recursive: true });
    await fs.mkdir(TEST_DATA_DIR, { recursive: true });
  } catch {
    // ignore
  }
});

// ── Flow 1: Complete Questionnaire Journey ────────────────────────────────────

describe('Flow 1: Complete questionnaire journey', () => {
  it('creates a questionnaire, works through all questions, completes the session, and retrieves the response', async () => {
    const q = makeQuestionnaire();
    const authHeaders = { 'remote-user': 'flow1@example.com', 'remote-name': 'Flow One User' };

    // 1. Create questionnaire
    const createRes = await request(app)
      .post('/api/questionnaires')
      .send(q)
      .set('Content-Type', 'application/json')
      .set(authHeaders);
    expect(createRes.status).toBe(201);
    expect(createRes.body.id).toBe(q.id);

    // 2. Start a session
    const sessionRes = await request(app)
      .post('/api/sessions')
      .send({ questionnaireId: q.id })
      .set('Content-Type', 'application/json')
      .set(authHeaders);
    expect(sessionRes.status).toBe(201);
    const { sessionId } = sessionRes.body as { sessionId: string };
    expect(typeof sessionId).toBe('string');
    expect(sessionId.length).toBeGreaterThan(0);

    // 3. Inspect initial session state
    const stateRes = await request(app)
      .get(`/api/sessions/${sessionId}`)
      .set(authHeaders);
    expect(stateRes.status).toBe(200);
    expect(stateRes.body.currentQuestion.id).toBe('q1');
    expect(stateRes.body.progress.percentComplete).toBe(0);

    // 4. Answer question 1
    const ans1 = await request(app)
      .post(`/api/sessions/${sessionId}/answer`)
      .send({ questionId: 'q1', value: 'Alice' })
      .set('Content-Type', 'application/json')
      .set(authHeaders);
    expect(ans1.status).toBe(200);
    expect(ans1.body.isComplete).toBe(false);
    expect(ans1.body.nextQuestion.id).toBe('q2');

    // 5. Answer question 2
    const ans2 = await request(app)
      .post(`/api/sessions/${sessionId}/answer`)
      .send({ questionId: 'q2', value: 'alice@example.com' })
      .set('Content-Type', 'application/json')
      .set(authHeaders);
    expect(ans2.status).toBe(200);
    expect(ans2.body.isComplete).toBe(false);
    expect(ans2.body.nextQuestion.id).toBe('q3');

    // 6. Answer question 3 (last question)
    const ans3 = await request(app)
      .post(`/api/sessions/${sessionId}/answer`)
      .send({ questionId: 'q3', value: 30 })
      .set('Content-Type', 'application/json')
      .set(authHeaders);
    expect(ans3.status).toBe(200);
    expect(ans3.body.isComplete).toBe(true);
    expect(ans3.body.nextQuestion).toBeNull();
    expect(ans3.body.progress.percentComplete).toBe(100);

    // 7. Complete the session
    const completeRes = await request(app)
      .post(`/api/sessions/${sessionId}/complete`)
      .send({})
      .set('Content-Type', 'application/json')
      .set(authHeaders);
    expect(completeRes.status).toBe(200);
    expect(completeRes.body.success).toBe(true);

    // 8. Retrieve the persisted response
    const responseId = (completeRes.body as { sessionId: string }).sessionId;
    const getRes = await request(app)
      .get(`/api/responses/${responseId}`)
      .set(authHeaders);
    expect(getRes.status).toBe(200);
    expect(getRes.body.questionnaireId).toBe(q.id);
    expect(getRes.body.status).toBe('completed');
    expect(getRes.body.answers).toHaveLength(3);

    // 9. Verify response appears in the list filtered by questionnaireId
    const listRes = await request(app)
      .get(`/api/responses?questionnaireId=${q.id as string}`)
      .set(authHeaders);
    expect(listRes.status).toBe(200);
    expect(listRes.body).toHaveLength(1);
    expect(listRes.body[0].questionnaireId).toBe(q.id);
  });
});

// ── Flow 2: User Authentication Lifecycle ────────────────────────────────────

describe('Flow 2: User authentication lifecycle', () => {
  it('JIT-provisions a user from Authelia headers and exposes identity via /api/auth/me', async () => {
    const email = `user_${uid()}@example.com`;

    // 1. First authenticated request — user is JIT-provisioned from proxy headers
    const firstRes = await request(app)
      .get('/api/auth/me')
      .set('remote-user', email)
      .set('remote-name', 'E2E User');
    expect(firstRes.status).toBe(200);
    expect(firstRes.body.user.email).toBe(email);
    expect(firstRes.body.user.name).toBe('E2E User');
    const userId = firstRes.body.user.id as string;
    expect(typeof userId).toBe('string');

    // 2. Subsequent request with same headers returns the same user
    const secondRes = await request(app)
      .get('/api/auth/me')
      .set('remote-user', email)
      .set('remote-name', 'E2E User');
    expect(secondRes.status).toBe(200);
    expect(secondRes.body.user.id).toBe(userId);

    // 3. Without headers, the guest identity is returned
    const guestRes = await request(app).get('/api/auth/me');
    expect(guestRes.status).toBe(200);
    expect(guestRes.body.user.id).toBe('guest');

    // 4. Authenticated user can create and manage their own questionnaires
    const q = makeQuestionnaire();
    const createRes = await request(app)
      .post('/api/questionnaires')
      .send(q)
      .set('Content-Type', 'application/json')
      .set('remote-user', email);
    expect(createRes.status).toBe(201);
    expect(createRes.body.ownerId).toBe(userId);

    // 5. The same authenticated user can retrieve the questionnaire
    const getRes = await request(app)
      .get(`/api/questionnaires/${q.id as string}`)
      .set('remote-user', email);
    expect(getRes.status).toBe(200);

    // 6. A different user cannot access the questionnaire (no explicit permission granted)
    const otherEmail = `other_${uid()}@example.com`;
    const otherRes = await request(app)
      .get(`/api/questionnaires/${q.id as string}`)
      .set('remote-user', otherEmail);
    expect(otherRes.status).toBe(403);
  });
});

// ── Flow 3: Questionnaire CRUD Lifecycle ─────────────────────────────────────

describe('Flow 3: Questionnaire CRUD lifecycle', () => {
  it('creates, lists, retrieves, updates, and deletes a questionnaire', async () => {
    const now = new Date().toISOString();
    const metadata = { title: 'Original Title', createdAt: now, updatedAt: now, tags: [] };
    const q = makeQuestionnaire({ metadata });
    const authHeaders = { 'remote-user': 'crud@example.com', 'remote-name': 'CRUD User' };

    // 1. Create
    const createRes = await request(app)
      .post('/api/questionnaires')
      .send(q)
      .set('Content-Type', 'application/json')
      .set(authHeaders);
    expect(createRes.status).toBe(201);
    const id = createRes.body.id as string;

    // 2. List – should contain the new questionnaire
    const listRes = await request(app)
      .get('/api/questionnaires')
      .set(authHeaders);
    expect(listRes.status).toBe(200);
    const ids = (listRes.body as Array<{ id: string }>).map(item => item.id);
    expect(ids).toContain(id);

    // 3. Get by ID
    const getRes = await request(app)
      .get(`/api/questionnaires/${id}`)
      .set(authHeaders);
    expect(getRes.status).toBe(200);
    expect(getRes.body.id).toBe(id);
    expect(getRes.body.metadata.title).toBe('Original Title');

    // 4. Update
    const updated = {
      ...q,
      metadata: { ...q.metadata as Record<string, unknown>, title: 'Updated Title', updatedAt: new Date().toISOString() },
    };
    const updateRes = await request(app)
      .put(`/api/questionnaires/${id}`)
      .send(updated)
      .set('Content-Type', 'application/json')
      .set(authHeaders);
    expect(updateRes.status).toBe(200);
    expect(updateRes.body.metadata.title).toBe('Updated Title');

    // 5. Confirm the update is persisted
    const getUpdatedRes = await request(app)
      .get(`/api/questionnaires/${id}`)
      .set(authHeaders);
    expect(getUpdatedRes.status).toBe(200);
    expect(getUpdatedRes.body.metadata.title).toBe('Updated Title');

    // 6. Delete
    const deleteRes = await request(app)
      .delete(`/api/questionnaires/${id}`)
      .set(authHeaders);
    expect([200, 204]).toContain(deleteRes.status);

    // 7. Confirm deletion
    const getMissingRes = await request(app)
      .get(`/api/questionnaires/${id}`)
      .set(authHeaders);
    expect(getMissingRes.status).toBe(404);
  });
});

// ── Flow 4: Response Analytics for Authenticated Users ───────────────────────

describe('Flow 4: Response analytics flow (authenticated)', () => {
  it('creates questionnaire as owner, completes two sessions, then retrieves stats, summary, and export', async () => {
    // 1. User identity via Authelia proxy headers
    const email = `analyst_${uid()}@example.com`;
    const authHeaders = { 'remote-user': email, 'remote-name': 'Analyst' };

    // 2. Create a simple questionnaire as the authenticated owner
    const q = makeQuestionnaire();
    const createRes = await request(app)
      .post('/api/questionnaires')
      .send(q)
      .set('Content-Type', 'application/json')
      .set(authHeaders);
    expect(createRes.status).toBe(201);

    // 3. Complete the questionnaire twice (sessions are associated with the same owner)
    for (let i = 0; i < 2; i++) {
      const sessionRes = await request(app)
        .post('/api/sessions')
        .send({ questionnaireId: q.id })
        .set('Content-Type', 'application/json')
        .set(authHeaders);
      const { sessionId } = sessionRes.body as { sessionId: string };

      await request(app)
        .post(`/api/sessions/${sessionId}/answer`)
        .send({ questionId: 'q1', value: `User ${i}` })
        .set('Content-Type', 'application/json')
        .set(authHeaders);

      await request(app)
        .post(`/api/sessions/${sessionId}/answer`)
        .send({ questionId: 'q2', value: `user${i}@example.com` })
        .set('Content-Type', 'application/json')
        .set(authHeaders);

      await request(app)
        .post(`/api/sessions/${sessionId}/answer`)
        .send({ questionId: 'q3', value: 20 + i })
        .set('Content-Type', 'application/json')
        .set(authHeaders);

      await request(app)
        .post(`/api/sessions/${sessionId}/complete`)
        .send({})
        .set('Content-Type', 'application/json')
        .set(authHeaders);
    }

    // 4. Get stats (owner has 'manage' → includes 'view_responses')
    const statsRes = await request(app)
      .get(`/api/questionnaires/${q.id as string}/stats`)
      .set(authHeaders);
    expect(statsRes.status).toBe(200);
    expect(statsRes.body).toHaveProperty('totalResponses');
    expect(statsRes.body.totalResponses).toBe(2);

    // 5. Get summary
    const summaryRes = await request(app)
      .get(`/api/questionnaires/${q.id as string}/summary`)
      .set(authHeaders);
    expect(summaryRes.status).toBe(200);
    expect(summaryRes.body).toHaveProperty('questionnaireId');

    // 6. Export as JSON
    const exportJsonRes = await request(app)
      .get(`/api/questionnaires/${q.id as string}/export?format=json`)
      .set(authHeaders);
    expect(exportJsonRes.status).toBe(200);
    expect(exportJsonRes.headers['content-type']).toMatch(/application\/json/);

    // 7. Export as CSV
    const exportCsvRes = await request(app)
      .get(`/api/questionnaires/${q.id as string}/export?format=csv`)
      .set(authHeaders);
    expect(exportCsvRes.status).toBe(200);
    expect(exportCsvRes.headers['content-type']).toMatch(/text\/csv/);
  });
});

// ── Flow 5: Session with Question Skipping ───────────────────────────────────

describe('Flow 5: Multi-question session with skipping', () => {
  it('allows skipping optional questions and still completes the session', async () => {
    const q = makeQuestionnaire();
    const authHeaders = { 'remote-user': 'skipper@example.com', 'remote-name': 'Skipper User' };

    // Create questionnaire
    await request(app)
      .post('/api/questionnaires')
      .send(q)
      .set('Content-Type', 'application/json')
      .set(authHeaders);

    // Start session
    const sessionRes = await request(app)
      .post('/api/sessions')
      .send({ questionnaireId: q.id })
      .set('Content-Type', 'application/json')
      .set(authHeaders);
    expect(sessionRes.status).toBe(201);
    const { sessionId } = sessionRes.body as { sessionId: string };

    // Answer q1
    await request(app)
      .post(`/api/sessions/${sessionId}/answer`)
      .send({ questionId: 'q1', value: 'Bob' })
      .set('Content-Type', 'application/json')
      .set(authHeaders);

    // Skip q2 (mark as skipped)
    const skipRes = await request(app)
      .post(`/api/sessions/${sessionId}/answer`)
      .send({ questionId: 'q2', value: null, skipped: true })
      .set('Content-Type', 'application/json')
      .set(authHeaders);
    expect(skipRes.status).toBe(200);
    expect(skipRes.body.isComplete).toBe(false);

    // Answer q3 (last question)
    const lastAns = await request(app)
      .post(`/api/sessions/${sessionId}/answer`)
      .send({ questionId: 'q3', value: 25 })
      .set('Content-Type', 'application/json')
      .set(authHeaders);
    expect(lastAns.status).toBe(200);
    expect(lastAns.body.isComplete).toBe(true);

    // Complete the session
    const completeRes = await request(app)
      .post(`/api/sessions/${sessionId}/complete`)
      .send({})
      .set('Content-Type', 'application/json')
      .set(authHeaders);
    expect(completeRes.status).toBe(200);

    // Verify response reflects the skip
    const responseId = (completeRes.body as { sessionId: string }).sessionId;
    const getRes = await request(app)
      .get(`/api/responses/${responseId}`)
      .set(authHeaders);
    expect(getRes.status).toBe(200);
    expect(getRes.body.status).toBe('completed');

    const skippedAnswers = (getRes.body.answers as Array<{ skipped: boolean }>).filter(a => a.skipped);
    expect(skippedAnswers).toHaveLength(1);
  });
});

// ── Flow 6: Guest Access Behaviour ───────────────────────────────────────────

describe('Flow 6: Unauthenticated access to protected routes is rejected', () => {
  it('guests are identified at /api/auth/me and cannot access another user\'s questionnaire analytics', async () => {
    // Create a questionnaire as an authenticated user (Alice)
    const q = makeQuestionnaire();
    await request(app)
      .post('/api/questionnaires')
      .send(q)
      .set('Content-Type', 'application/json')
      .set('remote-user', 'alice@example.com')
      .set('remote-name', 'Alice');

    const id = q.id as string;

    // Guest (no auth headers) cannot access analytics for another user's questionnaire
    const [statsRes, summaryRes, exportRes] = await Promise.all([
      request(app).get(`/api/questionnaires/${id}/stats`),
      request(app).get(`/api/questionnaires/${id}/summary`),
      request(app).get(`/api/questionnaires/${id}/export`),
    ]);

    expect(statsRes.status).toBe(403);
    expect(summaryRes.status).toBe(403);
    expect(exportRes.status).toBe(403);

    // /api/auth/me returns the guest identity (not 401)
    const meRes = await request(app).get('/api/auth/me');
    expect(meRes.status).toBe(200);
    expect(meRes.body.user.id).toBe('guest');
  });
});

// ── Flow 7: Invalid Data and Error Paths ─────────────────────────────────────

describe('Flow 7: Invalid data and error-path handling', () => {
  const authHeaders = { 'remote-user': 'errorpath@example.com', 'remote-name': 'Error Path User' };

  it('rejects creating a questionnaire with missing required fields', async () => {
    const res = await request(app)
      .post('/api/questionnaires')
      .send({ id: 'bad', version: '1.0' }) // missing metadata and questions
      .set('Content-Type', 'application/json')
      .set(authHeaders);
    expect(res.status).toBe(400);
  });

  it('returns 401 when creating a questionnaire without proxy auth headers', async () => {
    const res = await request(app)
      .post('/api/questionnaires')
      .send({ id: 'bad', version: '1.0' })
      .set('Content-Type', 'application/json');
    // No auth headers — guest identity → requireAuth rejects
    expect(res.status).toBe(401);
  });

  it('returns 404 when starting a session for a non-existent questionnaire', async () => {
    const res = await request(app)
      .post('/api/sessions')
      .send({ questionnaireId: 'does-not-exist' })
      .set('Content-Type', 'application/json')
      .set(authHeaders);
    expect(res.status).toBe(404);
  });

  it('returns 401 when starting a session without proxy auth headers', async () => {
    const res = await request(app)
      .post('/api/sessions')
      .send({ questionnaireId: 'any-id' })
      .set('Content-Type', 'application/json');
    // No auth headers — guest identity → requireAuth rejects
    expect(res.status).toBe(401);
  });

  it('returns 404 when submitting an answer to a non-existent session', async () => {
    const res = await request(app)
      .post('/api/sessions/no-such-session/answer')
      .send({ questionId: 'q1', value: 'hello' })
      .set('Content-Type', 'application/json');
    expect(res.status).toBe(404);
  });

  it('returns 400 when answer request is missing questionId', async () => {
    const q = makeQuestionnaire();
    await request(app)
      .post('/api/questionnaires')
      .send(q)
      .set('Content-Type', 'application/json')
      .set(authHeaders);

    const sessionRes = await request(app)
      .post('/api/sessions')
      .send({ questionnaireId: q.id })
      .set('Content-Type', 'application/json')
      .set(authHeaders);
    const { sessionId } = sessionRes.body as { sessionId: string };

    const res = await request(app)
      .post(`/api/sessions/${sessionId}/answer`)
      .send({ value: 'hello' }) // missing questionId
      .set('Content-Type', 'application/json')
      .set(authHeaders);
    expect(res.status).toBe(400);
  });

  it('guest identity is used when no auth headers are present', async () => {
    const res = await request(app).get('/api/auth/me');
    expect(res.status).toBe(200);
    expect(res.body.user.id).toBe('guest');
  });

  it('returns 403 when guest tries to access a questionnaire they do not own', async () => {
    // Create a questionnaire as a named user (Alice)
    const q = makeQuestionnaire();
    await request(app)
      .post('/api/questionnaires')
      .send(q)
      .set('Content-Type', 'application/json')
      .set('remote-user', 'alice@example.com');

    // Guest (no Remote-User header) cannot access Alice's questionnaire
    const res = await request(app).get(`/api/questionnaires/${q.id as string}`);
    expect(res.status).toBe(403);
  });

  it('returns 404 when getting a non-existent questionnaire', async () => {
    const res = await request(app).get('/api/questionnaires/nonexistent-id');
    expect(res.status).toBe(404);
  });
});
