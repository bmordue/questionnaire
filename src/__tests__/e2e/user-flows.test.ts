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
import request from 'supertest';

// DATA_DIR must be set before importing the server so FileStorageService uses our test directory.
const TEST_DATA_DIR = path.join(process.cwd(), 'test-data', 'e2e-user-flows');
const originalDataDir = process.env['DATA_DIR'];
process.env['DATA_DIR'] = TEST_DATA_DIR;

// Importing the server module after setting DATA_DIR ensures it picks up our test directory.
// NODE_ENV=test (set by Jest) prevents the server from binding to a TCP port.
const { app } = await import('../../web/server.js');

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
      { id: 'q2', type: 'email', text: 'What is your email?', required: true },
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

/** Extract the Set-Cookie header from a supertest response and return it as a header value. */
function extractCookie(res: request.Response): string {
  const raw = res.headers['set-cookie'] as string[] | string | undefined;
  if (!raw) return '';
  const cookies = Array.isArray(raw) ? raw : [raw];
  return cookies.map(c => c.split(';')[0]).join('; ');
}

// ── Setup / Teardown ──────────────────────────────────────────────────────────

beforeAll(async () => {
  await fs.mkdir(TEST_DATA_DIR, { recursive: true });
  // Allow auth services to finish initializing
  await new Promise(resolve => setTimeout(resolve, 200));
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

    // 1. Create questionnaire
    const createRes = await request(app)
      .post('/api/questionnaires')
      .send(q)
      .set('Content-Type', 'application/json');
    expect(createRes.status).toBe(201);
    expect(createRes.body.id).toBe(q.id);

    // 2. Start a session
    const sessionRes = await request(app)
      .post('/api/sessions')
      .send({ questionnaireId: q.id })
      .set('Content-Type', 'application/json');
    expect(sessionRes.status).toBe(201);
    const { sessionId } = sessionRes.body as { sessionId: string };
    expect(typeof sessionId).toBe('string');
    expect(sessionId.length).toBeGreaterThan(0);

    // 3. Inspect initial session state
    const stateRes = await request(app).get(`/api/sessions/${sessionId}`);
    expect(stateRes.status).toBe(200);
    expect(stateRes.body.currentQuestion.id).toBe('q1');
    expect(stateRes.body.progress.percentComplete).toBe(0);

    // 4. Answer question 1
    const ans1 = await request(app)
      .post(`/api/sessions/${sessionId}/answer`)
      .send({ questionId: 'q1', value: 'Alice' })
      .set('Content-Type', 'application/json');
    expect(ans1.status).toBe(200);
    expect(ans1.body.isComplete).toBe(false);
    expect(ans1.body.nextQuestion.id).toBe('q2');

    // 5. Answer question 2
    const ans2 = await request(app)
      .post(`/api/sessions/${sessionId}/answer`)
      .send({ questionId: 'q2', value: 'alice@example.com' })
      .set('Content-Type', 'application/json');
    expect(ans2.status).toBe(200);
    expect(ans2.body.isComplete).toBe(false);
    expect(ans2.body.nextQuestion.id).toBe('q3');

    // 6. Answer question 3 (last question)
    const ans3 = await request(app)
      .post(`/api/sessions/${sessionId}/answer`)
      .send({ questionId: 'q3', value: 30 })
      .set('Content-Type', 'application/json');
    expect(ans3.status).toBe(200);
    expect(ans3.body.isComplete).toBe(true);
    expect(ans3.body.nextQuestion).toBeNull();
    expect(ans3.body.progress.percentComplete).toBe(100);

    // 7. Complete the session
    const completeRes = await request(app)
      .post(`/api/sessions/${sessionId}/complete`)
      .send({})
      .set('Content-Type', 'application/json');
    expect(completeRes.status).toBe(200);
    expect(completeRes.body.success).toBe(true);

    // 8. Retrieve the persisted response
    const responseId = (completeRes.body as { sessionId: string }).sessionId;
    const getRes = await request(app).get(`/api/responses/${responseId}`);
    expect(getRes.status).toBe(200);
    expect(getRes.body.questionnaireId).toBe(q.id);
    expect(getRes.body.status).toBe('completed');
    expect(getRes.body.answers).toHaveLength(3);

    // 9. Verify response appears in the list filtered by questionnaireId
    const listRes = await request(app).get(`/api/responses?questionnaireId=${q.id as string}`);
    expect(listRes.status).toBe(200);
    expect(listRes.body).toHaveLength(1);
    expect(listRes.body[0].questionnaireId).toBe(q.id);
  });
});

// ── Flow 2: User Authentication Lifecycle ────────────────────────────────────

describe('Flow 2: User authentication lifecycle', () => {
  it('registers, logs in, accesses a protected route, changes password, then logs out', async () => {
    const email = `user_${uid()}@example.com`;
    const password = 'Secret123!';
    const newPassword = 'NewSecret456!';

    // 1. Register
    const regRes = await request(app)
      .post('/api/auth/register')
      .send({ email, password, name: 'E2E User' })
      .set('Content-Type', 'application/json');
    expect(regRes.status).toBe(201);
    expect(regRes.body.user.email).toBe(email);
    const regCookie = extractCookie(regRes);
    expect(regCookie).toBeTruthy();

    // 2. Verify /api/auth/me returns the user
    const meRes = await request(app)
      .get('/api/auth/me')
      .set('Cookie', regCookie);
    expect(meRes.status).toBe(200);
    expect(meRes.body.user.email).toBe(email);

    // 3. Logout
    const logoutRes = await request(app)
      .post('/api/auth/logout')
      .set('Cookie', regCookie);
    expect(logoutRes.status).toBe(200);
    expect(logoutRes.body.success).toBe(true);

    // 4. Login with original password
    const loginRes = await request(app)
      .post('/api/auth/login')
      .send({ email, password })
      .set('Content-Type', 'application/json');
    expect(loginRes.status).toBe(200);
    expect(loginRes.body.user.email).toBe(email);
    const loginCookie = extractCookie(loginRes);

    // 5. Change password
    const changePwdRes = await request(app)
      .post('/api/auth/change-password')
      .send({ currentPassword: password, newPassword })
      .set('Cookie', loginCookie)
      .set('Content-Type', 'application/json');
    expect(changePwdRes.status).toBe(200);
    expect(changePwdRes.body.success).toBe(true);

    // 6. Old password no longer works
    const oldLoginRes = await request(app)
      .post('/api/auth/login')
      .send({ email, password })
      .set('Content-Type', 'application/json');
    expect(oldLoginRes.status).toBe(401);

    // 7. New password works
    const newLoginRes = await request(app)
      .post('/api/auth/login')
      .send({ email, password: newPassword })
      .set('Content-Type', 'application/json');
    expect(newLoginRes.status).toBe(200);
  });
});

// ── Flow 3: Questionnaire CRUD Lifecycle ─────────────────────────────────────

describe('Flow 3: Questionnaire CRUD lifecycle', () => {
  it('creates, lists, retrieves, updates, and deletes a questionnaire', async () => {
    const now = new Date().toISOString();
    const metadata = { title: 'Original Title', createdAt: now, updatedAt: now, tags: [] };
    const q = makeQuestionnaire({ metadata });

    // 1. Create
    const createRes = await request(app)
      .post('/api/questionnaires')
      .send(q)
      .set('Content-Type', 'application/json');
    expect(createRes.status).toBe(201);
    const id = createRes.body.id as string;

    // 2. List – should contain the new questionnaire
    const listRes = await request(app).get('/api/questionnaires');
    expect(listRes.status).toBe(200);
    const ids = (listRes.body as Array<{ id: string }>).map(item => item.id);
    expect(ids).toContain(id);

    // 3. Get by ID
    const getRes = await request(app).get(`/api/questionnaires/${id}`);
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
      .set('Content-Type', 'application/json');
    expect(updateRes.status).toBe(200);
    expect(updateRes.body.metadata.title).toBe('Updated Title');

    // 5. Confirm the update is persisted
    const getUpdatedRes = await request(app).get(`/api/questionnaires/${id}`);
    expect(getUpdatedRes.status).toBe(200);
    expect(getUpdatedRes.body.metadata.title).toBe('Updated Title');

    // 6. Delete
    const deleteRes = await request(app).delete(`/api/questionnaires/${id}`);
    expect([200, 204]).toContain(deleteRes.status);

    // 7. Confirm deletion
    const getMissingRes = await request(app).get(`/api/questionnaires/${id}`);
    expect(getMissingRes.status).toBe(404);
  });
});

// ── Flow 4: Response Analytics for Authenticated Users ───────────────────────

describe('Flow 4: Response analytics flow (authenticated)', () => {
  it('registers a user, creates questionnaire, completes two sessions, then retrieves stats, summary, and export', async () => {
    // 1. Register and obtain auth cookie
    const email = `analyst_${uid()}@example.com`;
    const regRes = await request(app)
      .post('/api/auth/register')
      .send({ email, password: 'Analyst123!', name: 'Analyst' })
      .set('Content-Type', 'application/json');
    expect(regRes.status).toBe(201);
    const authCookie = extractCookie(regRes);

    // 2. Create a simple questionnaire (no auth required)
    const q = makeQuestionnaire();
    await request(app)
      .post('/api/questionnaires')
      .send(q)
      .set('Content-Type', 'application/json');

    // 3. Complete the questionnaire twice
    for (let i = 0; i < 2; i++) {
      const sessionRes = await request(app)
        .post('/api/sessions')
        .send({ questionnaireId: q.id })
        .set('Content-Type', 'application/json');
      const { sessionId } = sessionRes.body as { sessionId: string };

      await request(app)
        .post(`/api/sessions/${sessionId}/answer`)
        .send({ questionId: 'q1', value: `User ${i}` })
        .set('Content-Type', 'application/json');

      await request(app)
        .post(`/api/sessions/${sessionId}/answer`)
        .send({ questionId: 'q2', value: `user${i}@example.com` })
        .set('Content-Type', 'application/json');

      await request(app)
        .post(`/api/sessions/${sessionId}/answer`)
        .send({ questionId: 'q3', value: 20 + i })
        .set('Content-Type', 'application/json');

      await request(app)
        .post(`/api/sessions/${sessionId}/complete`)
        .send({})
        .set('Content-Type', 'application/json');
    }

    // 4. Get stats (requires auth)
    const statsRes = await request(app)
      .get(`/api/questionnaires/${q.id as string}/stats`)
      .set('Cookie', authCookie);
    expect(statsRes.status).toBe(200);
    expect(statsRes.body).toHaveProperty('totalResponses');
    expect(statsRes.body.totalResponses).toBe(2);

    // 5. Get summary (requires auth)
    const summaryRes = await request(app)
      .get(`/api/questionnaires/${q.id as string}/summary`)
      .set('Cookie', authCookie);
    expect(summaryRes.status).toBe(200);
    expect(summaryRes.body).toHaveProperty('questionnaireId');

    // 6. Export as JSON (requires auth)
    const exportJsonRes = await request(app)
      .get(`/api/questionnaires/${q.id as string}/export?format=json`)
      .set('Cookie', authCookie);
    expect(exportJsonRes.status).toBe(200);
    expect(exportJsonRes.headers['content-type']).toMatch(/application\/json/);

    // 7. Export as CSV (requires auth)
    const exportCsvRes = await request(app)
      .get(`/api/questionnaires/${q.id as string}/export?format=csv`)
      .set('Cookie', authCookie);
    expect(exportCsvRes.status).toBe(200);
    expect(exportCsvRes.headers['content-type']).toMatch(/text\/csv/);
  });
});

// ── Flow 5: Session with Question Skipping ───────────────────────────────────

describe('Flow 5: Multi-question session with skipping', () => {
  it('allows skipping optional questions and still completes the session', async () => {
    const q = makeQuestionnaire();

    // Create questionnaire
    await request(app)
      .post('/api/questionnaires')
      .send(q)
      .set('Content-Type', 'application/json');

    // Start session
    const sessionRes = await request(app)
      .post('/api/sessions')
      .send({ questionnaireId: q.id })
      .set('Content-Type', 'application/json');
    expect(sessionRes.status).toBe(201);
    const { sessionId } = sessionRes.body as { sessionId: string };

    // Answer q1
    await request(app)
      .post(`/api/sessions/${sessionId}/answer`)
      .send({ questionId: 'q1', value: 'Bob' })
      .set('Content-Type', 'application/json');

    // Skip q2 (mark as skipped)
    const skipRes = await request(app)
      .post(`/api/sessions/${sessionId}/answer`)
      .send({ questionId: 'q2', value: null, skipped: true })
      .set('Content-Type', 'application/json');
    expect(skipRes.status).toBe(200);
    expect(skipRes.body.isComplete).toBe(false);

    // Answer q3 (last question)
    const lastAns = await request(app)
      .post(`/api/sessions/${sessionId}/answer`)
      .send({ questionId: 'q3', value: 25 })
      .set('Content-Type', 'application/json');
    expect(lastAns.status).toBe(200);
    expect(lastAns.body.isComplete).toBe(true);

    // Complete the session
    const completeRes = await request(app)
      .post(`/api/sessions/${sessionId}/complete`)
      .send({})
      .set('Content-Type', 'application/json');
    expect(completeRes.status).toBe(200);

    // Verify response reflects the skip
    const responseId = (completeRes.body as { sessionId: string }).sessionId;
    const getRes = await request(app).get(`/api/responses/${responseId}`);
    expect(getRes.status).toBe(200);
    expect(getRes.body.status).toBe('completed');

    const skippedAnswers = (getRes.body.answers as Array<{ skipped: boolean }>).filter(a => a.skipped);
    expect(skippedAnswers).toHaveLength(1);
  });
});

// ── Flow 6: Unauthenticated Access to Protected Routes ───────────────────────

describe('Flow 6: Unauthenticated access to protected routes is rejected', () => {
  it('returns 401 for stats, summary, and export endpoints without a session cookie', async () => {
    const q = makeQuestionnaire();
    await request(app)
      .post('/api/questionnaires')
      .send(q)
      .set('Content-Type', 'application/json');

    const id = q.id as string;

    const [statsRes, summaryRes, exportRes, meRes] = await Promise.all([
      request(app).get(`/api/questionnaires/${id}/stats`),
      request(app).get(`/api/questionnaires/${id}/summary`),
      request(app).get(`/api/questionnaires/${id}/export`),
      request(app).get('/api/auth/me'),
    ]);

    expect(statsRes.status).toBe(401);
    expect(summaryRes.status).toBe(401);
    expect(exportRes.status).toBe(401);
    expect(meRes.status).toBe(401);
  });
});

// ── Flow 7: Invalid Data and Error Paths ─────────────────────────────────────

describe('Flow 7: Invalid data and error-path handling', () => {
  it('rejects creating a questionnaire with missing required fields', async () => {
    const res = await request(app)
      .post('/api/questionnaires')
      .send({ id: 'bad', version: '1.0' }) // missing metadata and questions
      .set('Content-Type', 'application/json');
    expect(res.status).toBe(400);
  });

  it('returns 404 when starting a session for a non-existent questionnaire', async () => {
    const res = await request(app)
      .post('/api/sessions')
      .send({ questionnaireId: 'does-not-exist' })
      .set('Content-Type', 'application/json');
    expect(res.status).toBe(404);
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
      .set('Content-Type', 'application/json');

    const sessionRes = await request(app)
      .post('/api/sessions')
      .send({ questionnaireId: q.id })
      .set('Content-Type', 'application/json');
    const { sessionId } = sessionRes.body as { sessionId: string };

    const res = await request(app)
      .post(`/api/sessions/${sessionId}/answer`)
      .send({ value: 'hello' }) // missing questionId
      .set('Content-Type', 'application/json');
    expect(res.status).toBe(400);
  });

  it('rejects registration with missing fields', async () => {
    const res = await request(app)
      .post('/api/auth/register')
      .send({ email: 'not-an-email' }) // missing password and name
      .set('Content-Type', 'application/json');
    expect(res.status).toBe(400);
  });

  it('rejects login with wrong credentials', async () => {
    const res = await request(app)
      .post('/api/auth/login')
      .send({ email: 'ghost@example.com', password: 'wrong' })
      .set('Content-Type', 'application/json');
    expect(res.status).toBe(401);
  });

  it('returns 404 when getting a non-existent questionnaire', async () => {
    const res = await request(app).get('/api/questionnaires/nonexistent-id');
    expect(res.status).toBe(404);
  });
});
