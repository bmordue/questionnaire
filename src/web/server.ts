/**
 * Web server for managing questionnaires and responses
 *
 * Provides REST API endpoints and serves the static frontend.
 */

import express from 'express';
import cors from 'cors';
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
const DATA_DIR = process.env['DATA_DIR'] ?? path.join(process.cwd(), 'data');

const storage = new FileStorageService({ dataDirectory: DATA_DIR });

const app = express();
app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// ── Questionnaire Routes ──────────────────────────────────────────────────────

/** List all questionnaires */
app.get('/api/questionnaires', async (_req, res) => {
  try {
    const list = await storage.listQuestionnaires();
    res.json(list);
  } catch (err) {
    res.status(500).json({ error: String(err) });
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
    res.status(500).json({ error: String(err) });
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
    res.status(500).json({ error: String(err) });
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

    const nextIndex = response.progress.currentQuestionIndex + 1;
    const answeredCount = updatedAnswers.filter(a => !a.skipped).length;
    const skippedCount = updatedAnswers.filter(a => a.skipped === true).length;
    const total = questionnaire.questions.length;
    const isComplete = nextIndex >= total;

    const updatedResponse = {
      ...response,
      answers: updatedAnswers,
      lastSavedAt: new Date().toISOString(),
      progress: {
        ...response.progress,
        currentQuestionIndex: nextIndex,
        answeredCount,
        skippedCount,
        percentComplete: Math.round((nextIndex / total) * 100)
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
    res.status(500).json({ error: String(err) });
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

    res.json({ success: true, responseId: session.responseId });
  } catch (err) {
    res.status(500).json({ error: String(err) });
  }
});

// ── Start Server ──────────────────────────────────────────────────────────────

app.listen(PORT, () => {
  console.log(`Questionnaire web server running at http://localhost:${PORT}`);
  console.log(`Data directory: ${DATA_DIR}`);
});
