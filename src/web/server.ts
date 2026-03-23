/**
 * Web server for managing questionnaires and responses
 *
 * Provides REST API endpoints and serves the static frontend.
 */

import express from 'express';
import cors from 'cors';
import os from 'os';
import path from 'path';
import { fileURLToPath } from 'url';

import { FileStorageService } from '../core/storage.js';
import { safeValidateQuestionnaire } from '../core/schemas/questionnaire.js';
import { ResponseStatus } from '../core/schemas/response.js';
import type { Answer } from '../core/schemas/response.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const PORT = (() => {
  const p = parseInt(process.env['PORT'] ?? '', 10);
  return Number.isNaN(p) ? 3000 : p;
})();
const isVercel = process.env['VERCEL'] === '1' || process.env['VERCEL'] === 'true';

// On Vercel, process.cwd() points to /var/task which is read-only.
// Fall back to os.tmpdir() (writable, but ephemeral) when DATA_DIR is not explicitly set.
const DATA_DIR =
  process.env['DATA_DIR'] ??
  (isVercel ? path.join(os.tmpdir(), 'questionnaire-data') : path.join(process.cwd(), 'data'));

if (isVercel && process.env['DATA_DIR'] == null) {
  // When running on Vercel without an explicit DATA_DIR, the filesystem is ephemeral.
  // This deployment should be treated as demo-only; persisted data can be lost at any time.
  // To use persistent storage, configure DATA_DIR to point to a durable volume or
  // replace FileStorageService with an implementation backed by an external datastore.
  console.warn(
    '[questionnaire] Running on Vercel without DATA_DIR; using ephemeral filesystem storage. ' +
      'Questionnaires and responses may be lost between deployments or cold starts.',
  );
}

const storage = new FileStorageService({ dataDirectory: DATA_DIR });

/**
 * Returns true when the error indicates a resource was not found on disk.
 * Used to distinguish 404-worthy errors from genuine server failures.
 */
function isNotFoundError(err: unknown): boolean {
  return err instanceof Error && err.message.toLowerCase().includes('not found');
}

export const app = express();

// CORS configuration: permissive in development, restricted/disabled otherwise
const NODE_ENV = process.env['NODE_ENV'] ?? 'development';
const CORS_ORIGINS = process.env['CORS_ORIGINS'];

if (NODE_ENV === 'development') {
  // In development, allow all origins for convenience
  app.use(cors());
} else if (CORS_ORIGINS) {
  // In non-development environments, restrict CORS to an explicit allowlist
  const allowedOrigins = CORS_ORIGINS.split(',')
    .map(origin => origin.trim())
    .filter(origin => origin.length > 0);

  app.use(
    cors({
      origin(origin, callback) {
        // Allow requests with no Origin header (e.g., server-to-server or same-origin)
        if (!origin) {
          return callback(null, true);
        }

        if (allowedOrigins.includes(origin)) {
          return callback(null, true);
        }

        return callback(new Error('Not allowed by CORS'));
      },
    }),
  );
}

app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// ── Questionnaire Routes ──────────────────────────────────────────────────────

/** List all questionnaires */
app.get('/api/questionnaires', async (_req, res) => {
  try {
    const list = await storage.listQuestionnaires();
    res.json(list);
  } catch (err) {
    console.error('Error listing questionnaires:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

/** Create a new questionnaire */
app.post('/api/questionnaires', async (req, res) => {
  try {
    const result = safeValidateQuestionnaire(req.body);
    if (!result.success) {
      res.status(400).json({ error: 'Invalid questionnaire', details: result.error });
      return;
    }
    await storage.saveQuestionnaire(result.data);
    res.status(201).json(result.data);
  } catch (err) {
    console.error('Error creating questionnaire:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

/** Get a single questionnaire by ID */
app.get('/api/questionnaires/:id', async (req, res) => {
  try {
    const questionnaire = await storage.loadQuestionnaire(req.params['id'] ?? '');
    res.json(questionnaire);
  } catch {
    res.status(404).json({ error: 'Questionnaire not found' });
  }
});

/** Update an existing questionnaire */
app.put('/api/questionnaires/:id', async (req, res) => {
  try {
    const result = safeValidateQuestionnaire(req.body);
    if (!result.success) {
      res.status(400).json({ error: 'Invalid questionnaire', details: result.error });
      return;
    }
    const pathId = req.params['id'] ?? '';
    if (!pathId) {
      res.status(400).json({ error: 'Missing questionnaire ID in path' });
      return;
    }
    if (result.data.id !== pathId) {
      res.status(400).json({
        error: 'Path ID does not match questionnaire ID in body',
        pathId,
        bodyId: result.data.id,
      });
      return;
    }
    await storage.saveQuestionnaire(result.data);
    res.json(result.data);
  } catch (err) {
    res.status(500).json({ error: String(err) });
  }
});

/** Delete a questionnaire */
app.delete('/api/questionnaires/:id', async (req, res) => {
  try {
    await storage.deleteQuestionnaire(req.params['id'] ?? '');
    res.status(204).send();
  } catch {
    res.status(404).json({ error: 'Questionnaire not found' });
  }
});

// ── Response Routes ───────────────────────────────────────────────────────────

/** List all responses (optionally filtered by questionnaireId) */
app.get('/api/responses', async (req, res) => {
  try {
    const questionnaireId =
      typeof req.query['questionnaireId'] === 'string' ? req.query['questionnaireId'] : undefined;
    const responses = await storage.listResponses(questionnaireId);
    res.json(responses);
  } catch (err) {
    res.status(500).json({ error: String(err) });
  }
});

/** Get a single response by session ID */
app.get('/api/responses/:id', async (req, res) => {
  try {
    const response = await storage.loadResponse(req.params['id'] ?? '');
    res.json(response);
  } catch {
    res.status(404).json({ error: 'Response not found' });
  }
});

// ── Session Routes ────────────────────────────────────────────────────────────

/** Start a new questionnaire session */
app.post('/api/sessions', async (req, res) => {
  try {
    const body = req.body as { questionnaireId?: string };
    if (!body.questionnaireId) {
      res.status(400).json({ error: 'questionnaireId is required' });
      return;
    }
    const sessionId = await storage.createSession(body.questionnaireId);
    res.status(201).json({ sessionId });
  } catch (err) {
    if (isNotFoundError(err)) {
      res.status(404).json({ error: 'Questionnaire not found' });
    } else {
      res.status(500).json({ error: String(err) });
    }
  }
});

/** Get current session state including the current question */
app.get('/api/sessions/:sessionId', async (req, res) => {
  try {
    const sessionId = req.params['sessionId'] ?? '';
    const session = await storage.loadSession(sessionId);
    const questionnaire = await storage.loadQuestionnaire(session.questionnaireId);
    const response = await storage.loadResponse(sessionId);

    const currentIndex = response.progress.currentQuestionIndex;
    const currentQuestion = questionnaire.questions[currentIndex] ?? null;

    res.json({
      session,
      questionnaire: {
        id: questionnaire.id,
        title: questionnaire.metadata.title,
        totalQuestions: questionnaire.questions.length,
        config: questionnaire.config
      },
      currentQuestion,
      currentQuestionIndex: currentIndex,
      progress: response.progress,
      answers: response.answers
    });
  } catch {
    res.status(404).json({ error: 'Session not found' });
  }
});

/** Submit an answer and advance to the next question */
app.post('/api/sessions/:sessionId/answer', async (req, res) => {
  try {
    const sessionId = req.params['sessionId'] ?? '';
    const session = await storage.loadSession(sessionId);
    const questionnaire = await storage.loadQuestionnaire(session.questionnaireId);
    const response = await storage.loadResponse(sessionId);

    const body = req.body as { questionId?: string; value?: unknown; skipped?: boolean };

    if (!body.questionId) {
      res.status(400).json({ error: 'questionId is required' });
      return;
    }

    const totalQuestions = questionnaire.questions.length;

    if (totalQuestions === 0) {
      res.status(400).json({ error: 'Questionnaire has no questions' });
      return;
    }

    // Ensure current progress index is within questionnaire bounds
    const currentIndex = response.progress.currentQuestionIndex;
    if (currentIndex < 0 || currentIndex >= totalQuestions) {
      res.status(400).json({ error: 'Invalid current question index in response progress' });
      return;
    }

    const expectedQuestionId = questionnaire.questions[currentIndex]?.id;
    if (expectedQuestionId && body.questionId !== expectedQuestionId) {
      res.status(400).json({
        error: 'Answers must be submitted for the current question in order',
        expectedQuestionId
      });
      return;
    }

    const answer: Answer = {
      questionId: body.questionId,
      value: body.value !== undefined ? body.value : null,
      answeredAt: new Date().toISOString(),
      skipped: body.skipped ?? false
    };

    // Replace existing answer for this question or append
    const existingIdx = response.answers.findIndex(a => a.questionId === body.questionId);
    const updatedAnswers: Answer[] =
      existingIdx >= 0
        ? response.answers.map((a, i) => (i === existingIdx ? answer : a))
        : [...response.answers, answer];

    const hasExistingAnswer = existingIdx >= 0;
    const rawNextIndex = hasExistingAnswer
      ? response.progress.currentQuestionIndex
      : response.progress.currentQuestionIndex + 1;
    const nextIndex = Math.min(rawNextIndex, totalQuestions);

    const answeredCount = updatedAnswers.filter(a => !a.skipped).length;
    const skippedCount = updatedAnswers.filter(a => a.skipped === true).length;
    const isComplete = nextIndex >= totalQuestions;

    const percentComplete =
      totalQuestions > 0 ? Math.round((nextIndex / totalQuestions) * 100) : 100;

    const updatedResponse = {
      ...response,
      answers: updatedAnswers,
      lastSavedAt: new Date().toISOString(),
      progress: {
        ...response.progress,
        currentQuestionIndex: nextIndex,
        answeredCount,
        skippedCount,
        percentComplete
      }
    };

    await storage.saveResponse(updatedResponse);

    const nextQuestion = isComplete ? null : (questionnaire.questions[nextIndex] ?? null);

    res.json({
      nextQuestion,
      nextQuestionIndex: isComplete ? null : nextIndex,
      progress: updatedResponse.progress,
      isComplete
    });
  } catch (err) {
    if (isNotFoundError(err)) {
      res.status(404).json({ error: 'Session not found' });
    } else {
      res.status(500).json({ error: String(err) });
    }
  }
});

/** Mark a session as complete */
app.post('/api/sessions/:sessionId/complete', async (req, res) => {
  try {
    const sessionId = req.params['sessionId'] ?? '';
    const session = await storage.loadSession(sessionId);
    const response = await storage.loadResponse(sessionId);

    const now = new Date().toISOString();
    const completedResponse = {
      ...response,
      status: ResponseStatus.COMPLETED,
      completedAt: now,
      lastSavedAt: now
    };

    await storage.saveResponse(completedResponse);
    await storage.updateSession(sessionId, { status: 'completed', updatedAt: now });

    // Return sessionId so callers can fetch the response via GET /api/responses/:id
    // (responses are stored and loaded by sessionId, not by response.id)
    res.json({ success: true, sessionId });
  } catch (err) {
    if (isNotFoundError(err)) {
      res.status(404).json({ error: 'Session not found' });
    } else {
      res.status(500).json({ error: String(err) });
    }
  }
});

// ── Start Server ──────────────────────────────────────────────────────────────

// Export the app for Vercel serverless functions
export default app;

// Only start the HTTP server when running locally (not in a Vercel deployment or test environment)
if (!isVercel && NODE_ENV !== 'test') {
  app.listen(PORT, () => {
    console.log(`Questionnaire web server running at http://localhost:${PORT}`);
    console.log(`Data directory: ${DATA_DIR}`);
  });
}
