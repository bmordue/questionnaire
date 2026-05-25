/**
 * Web server for managing questionnaires and responses
 *
 * Authentication is handled externally by Authelia (forward-auth via nginx).
 * Identity is read from Remote-User / Remote-Name / Remote-Groups headers.
 */

import express from 'express';
import type { Response } from 'express';
import cors from 'cors';
import { z } from 'zod';
import os from 'os';
import path from 'path';
import { fileURLToPath } from 'url';

import { FileStorageService } from '../core/storage.js';
import { BackendStorageService } from '../core/storage/backend-storage-service.js';
import { S3StorageBackend, RetryableStorageBackend } from '../core/storage/backend.js';
import type { S3BackendConfig } from '../core/storage/backend.js';
import type { StorageService } from '../core/storage/types.js';
import {
  safeValidateQuestionnaire,
  resolvePermission,
  permissionSatisfies,
  PermissionLevelSchema,
} from '../core/schemas/questionnaire.js';
import type { Questionnaire } from '../core/schemas/questionnaire.js';
import { ResponseStatus } from '../core/schemas/response.js';
import type { Answer } from '../core/schemas/response.js';
import type { RuntimeUser } from '../core/schemas/user.js';
import { FileUserRepository } from '../core/repositories/file-user-repository.js';
import { ReviewService } from '../core/services/review-service.js';
import { GUEST_USER, loadUser, requireAuth } from './middleware/auth.js';
import { requireQuestionnairePermission, requireSessionOwner } from './middleware/acl.js';
import { errorHandler } from './middleware/error-handler.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const PORT = (() => {
  const p = parseInt(process.env['PORT'] ?? '', 10);
  return Number.isNaN(p) ? 3000 : p;
})();
const isVercel = process.env['VERCEL'] === '1' || process.env['VERCEL'] === 'true';

/**
 * Normalise a BASE_PATH value: ensure a leading slash and strip trailing
 * slashes.  An empty or missing value results in an empty string (serve from
 * root).
 *
 * Examples:
 *   BASE_PATH=qqq   → '/qqq'
 *   BASE_PATH=/qqq  → '/qqq'
 *   BASE_PATH=/qqq/ → '/qqq'
 *   BASE_PATH=/     → ''
 *   (unset)         → ''
 */
const BASE_PATH = (() => {
  const bp = (process.env['BASE_PATH'] ?? '').trim();
  if (!bp) return '';
  const normalised = '/' + bp.replace(/^\/+/, '').replace(/\/+$/, '');
  return normalised === '/' ? '' : normalised;
})();

type OpenFgaPermission =
  | 'view_app'
  | 'create_questionnaire'
  | 'create_response'
  | 'view_questionnaire'
  | 'view_response';

const OPENFGA_API_URL = (process.env['OPENFGA_API_URL'] ?? '').trim().replace(/\/+$/, '');
const OPENFGA_STORE_ID = (process.env['OPENFGA_STORE_ID'] ?? '').trim();
const OPENFGA_AUTHORIZATION_MODEL_ID = (process.env['OPENFGA_AUTHORIZATION_MODEL_ID'] ?? '').trim();
const OPENFGA_API_TOKEN = (process.env['OPENFGA_API_TOKEN'] ?? '').trim();
const OPENFGA_APP_OBJECT = 'app:questionnaire';
const OPENFGA_REQUEST_TIMEOUT_MS = 3000;

function isOpenFgaEnabled(): boolean {
  return OPENFGA_API_URL !== '' && OPENFGA_STORE_ID !== '';
}

function questionnaireObject(id: string): string {
  return `questionnaire:${id}`;
}

function responseObject(id: string): string {
  return `response:${id}`;
}

/**
 * Validate AUTH_LOGOUT_URL before using it as a redirect target.
 * Allowed forms:
 *  - Absolute http/https URL
 *  - Same-origin relative path beginning with a single slash (e.g. /signout)
 */
function validatedLogoutRedirect(rawUrl: string | undefined): string | null {
  const value = (rawUrl ?? '').trim();
  if (!value) return null;

  if (value.startsWith('/')) {
    try {
      const pathOnly = value.split(/[?#]/, 1)[0] ?? '';
      const decoded = decodeURIComponent(pathOnly);
      if (decoded.split('/').includes('..')) return null;
    } catch {
      return null;
    }
    return value.startsWith('//') ? null : value;
  }

  try {
    const parsed = new URL(value);
    if (parsed.protocol === 'http:' || parsed.protocol === 'https:') {
      return value;
    }
  } catch {
    return null;
  }

  return null;
}

// On Vercel, process.cwd() points to /var/task which is read-only.
// Fall back to os.tmpdir() (writable, but ephemeral) when DATA_DIR is not explicitly set.
const DATA_DIR =
  process.env['DATA_DIR'] ??
  (isVercel ? path.join(os.tmpdir(), 'questionnaire-data') : path.join(process.cwd(), 'data'));

// ── Storage layer ─────────────────────────────────────────────────────────────

/**
 * Build the storage service.
 *
 * When S3_BUCKET is set (expected for Vercel deployments) we use
 * S3StorageBackend wrapped with retry logic.  Otherwise we fall back to the
 * filesystem-based FileStorageService.
 */
function createStorage(): StorageService {
  const s3Bucket = process.env['S3_BUCKET'];

  if (s3Bucket) {
    const s3Config: S3BackendConfig = {
      bucket: s3Bucket,
      keyPrefix: process.env['S3_KEY_PREFIX'] ?? '',
      region: process.env['S3_REGION'] ?? process.env['AWS_REGION'] ?? 'us-east-1',
      forcePathStyle: process.env['S3_FORCE_PATH_STYLE'] === 'true'
    };
    if (process.env['S3_ENDPOINT']) s3Config.endpoint = process.env['S3_ENDPOINT'];
    if (process.env['AWS_ACCESS_KEY_ID']) s3Config.accessKeyId = process.env['AWS_ACCESS_KEY_ID'];
    if (process.env['AWS_SECRET_ACCESS_KEY']) s3Config.secretAccessKey = process.env['AWS_SECRET_ACCESS_KEY'];

    const backend = new S3StorageBackend(s3Config);

    const retryable = new RetryableStorageBackend(backend, {
      maxAttempts: 3,
      baseDelayMs: 200,
      maxDelayMs: 3000
    });

    console.log(
      `[questionnaire] Using S3 storage backend (bucket: ${s3Bucket}, ` +
        `region: ${process.env['S3_REGION'] ?? process.env['AWS_REGION'] ?? 'us-east-1'})`
    );

    return new BackendStorageService({ backend: retryable });
  }

  if (isVercel && !process.env['DATA_DIR']) {
    // When running on Vercel without S3 or an explicit DATA_DIR, the filesystem
    // is ephemeral. This deployment should be treated as demo-only.
    console.warn(
      '[questionnaire] Running on Vercel without S3_BUCKET; using ephemeral filesystem storage. ' +
        'Questionnaires and responses may be lost between deployments or cold starts.',
    );
  }

  return new FileStorageService({ dataDirectory: DATA_DIR });
}

const storage = createStorage();

// ── User repository (JIT provisioning) ───────────────────────────────────────

const userRepository = new FileUserRepository({ dataDirectory: DATA_DIR });
userRepository.initialize().catch(err => {
  console.error('[users] Initialization error:', err);
});

// ── Helpers ───────────────────────────────────────────────────────────────────

function isNotFoundError(err: unknown): boolean {
  return err instanceof Error && err.message.toLowerCase().includes('not found');
}

function currentUser(res: Response): RuntimeUser {
  return res.locals['user'] as RuntimeUser;
}

async function openFgaCheck(
  userId: string,
  relation: OpenFgaPermission,
  object: string,
): Promise<boolean> {
  if (!isOpenFgaEnabled()) return true;
  const abortController = new AbortController();
  const timeoutId = setTimeout(() => abortController.abort(), OPENFGA_REQUEST_TIMEOUT_MS);
  const body: {
    tuple_key: { user: string; relation: OpenFgaPermission; object: string };
    authorization_model_id?: string;
  } = {
    tuple_key: {
      user: `user:${userId}`,
      relation,
      object,
    },
  };
  if (OPENFGA_AUTHORIZATION_MODEL_ID !== '') {
    body.authorization_model_id = OPENFGA_AUTHORIZATION_MODEL_ID;
  }
  let response: globalThis.Response;
  try {
    response = await fetch(
      `${OPENFGA_API_URL}/stores/${encodeURIComponent(OPENFGA_STORE_ID)}/check`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(OPENFGA_API_TOKEN !== '' ? { Authorization: `Bearer ${OPENFGA_API_TOKEN}` } : {}),
        },
        body: JSON.stringify(body),
        signal: abortController.signal,
      },
    );
  } catch (err) {
    if (err instanceof Error && err.name === 'AbortError') {
      throw new Error(`OpenFGA check timed out after ${OPENFGA_REQUEST_TIMEOUT_MS}ms`);
    }
    throw err;
  } finally {
    clearTimeout(timeoutId);
  }
  if (!response.ok) {
    throw new Error(`OpenFGA check failed with status ${response.status}`);
  }
  const payload = (await response.json()) as { allowed?: boolean };
  return payload.allowed === true;
}

async function enforceOpenFgaPermission(
  res: Response,
  relation: OpenFgaPermission,
  object: string,
): Promise<boolean> {
  const user = currentUser(res);
  try {
    const allowed = await openFgaCheck(user.id, relation, object);
    if (!allowed) {
      res.status(403).json({ error: 'Insufficient permissions' });
      return false;
    }
    return true;
  } catch (err) {
    console.error('[openfga] Permission check failed', {
      userId: user.id,
      relation,
      object,
      error: err,
    });
    res.status(503).json({ error: 'Authorization service unavailable' });
    return false;
  }
}

// ── App setup ─────────────────────────────────────────────────────────────────

export const app: express.Express = express();

// Trust one proxy hop (nginx) so req.ip reflects the real client IP
app.set('trust proxy', 1);
app.disable('x-powered-by');

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
  if (allowedOrigins.includes('*')) {
    app.use(cors());
  } else {
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
}

app.use(express.json());

// Security headers middleware to prevent clickjacking, MIME-type sniffing, and information leakage
app.use((_req, res, next) => {
  res.setHeader('X-Frame-Options', 'DENY');
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
  next();
});

// Resolve user identity from Authelia proxy headers (or dev stub / guest sentinel).
// Requests without identity headers are treated as the built-in guest user; protected
// endpoints still gate access via requireAuth and per-resource ACL checks.
app.use(loadUser(userRepository));

// ── Application router (mounted at BASE_PATH) ─────────────────────────────────

/**
 * All application routes (static assets + API) are registered on this router
 * so that they can be mounted at an optional BASE_PATH prefix without having
 * to repeat the prefix on every route definition.
 */
const router = express.Router();

// When OpenFGA is configured, require explicit "view_app" permission before
// serving static application assets.
router.use(async (req, res, next) => {
  if (!isOpenFgaEnabled()) {
    next();
    return;
  }
  const pathName = req.path;
  if (pathName.startsWith('/api/') || pathName === '/logout') {
    next();
    return;
  }
  const user = currentUser(res);
  if (!user || user.id === GUEST_USER.id) {
    res.status(401).type('text/plain').send('Authentication required');
    return;
  }
  if (!(await enforceOpenFgaPermission(res, 'view_app', OPENFGA_APP_OBJECT))) {
    return;
  }
  next();
});

// Serve a generated config.js that exposes APP_BASE to the browser.
// Must be registered before express.static so the server-generated response
// takes precedence over any file that might exist in public/.
router.get('/config.js', (_req, res) => {
  res.setHeader('Content-Type', 'application/javascript; charset=utf-8');
  res.setHeader('Cache-Control', 'no-cache');
  res.send(`window.APP_BASE = ${JSON.stringify(BASE_PATH)};`);
});

router.use(express.static(path.join(__dirname, 'public')));

// Mount the router at BASE_PATH (or at root if BASE_PATH is empty)
app.use(BASE_PATH || '/', router);

// ── Questionnaire Routes ──────────────────────────────────────────────────────

/** List questionnaires visible to the current user */
router.get('/api/questionnaires', requireAuth, async (_req, res, next) => {
  try {
    const user = currentUser(res);
    const adminGroup = process.env['ADMIN_GROUP'] ?? 'admins';
    const isAdmin = user.groups.includes(adminGroup);
    const list = await storage.listQuestionnaires();
    if (isAdmin) {
      const enriched = list.map(meta => ({ ...meta, effectivePermission: 'manage' as const }));
      res.json(enriched);
      return;
    }
    const visible = (
      await Promise.all(
        list.map(async meta => {
          try {
            const questionnaire = await storage.loadQuestionnaire(meta.id);
            const effectivePermission = resolvePermission(questionnaire, user.id, user.groups);
            return effectivePermission !== null ? { ...meta, effectivePermission } : null;
          } catch (err) {
            if (!isNotFoundError(err)) {
              console.error(`[questionnaires] Failed to load questionnaire ${meta.id} for permission check:`, err);
            }
            return null;
          }
        })
      )
    ).filter((meta): meta is NonNullable<typeof meta> => meta !== null);
    res.json(visible);
  } catch (err) {
    next(err);
  }
});

/** Create a questionnaire; automatically sets ownerId to the calling user */
router.post('/api/questionnaires', requireAuth, async (req, res, next) => {
  try {
    const user = currentUser(res);
    if (!(await enforceOpenFgaPermission(res, 'create_questionnaire', OPENFGA_APP_OBJECT))) {
      return;
    }
    const result = safeValidateQuestionnaire({ ...req.body, ownerId: user.id });
    if (!result.success) {
      res.status(400).json({ error: 'Invalid questionnaire', details: result.error });
      return;
    }
    await storage.saveQuestionnaire(result.data);
    res.status(201).json(result.data);
  } catch (err) {
    next(err);
  }
});

/** Get a single questionnaire — requires at least 'respond' access */
router.get(
  '/api/questionnaires/:id',
  requireQuestionnairePermission(storage, 'respond'),
  async (req, res, next) => {
    const questionnaire = res.locals['questionnaire'] as Questionnaire;
    if (!(await enforceOpenFgaPermission(res, 'view_questionnaire', questionnaireObject(questionnaire.id)))) {
      return;
    }
    next();
  },
  (_req, res) => {
    res.json(res.locals['questionnaire']);
  },
);

/** Update a questionnaire — requires 'manage' */
router.put(
  '/api/questionnaires/:id',
  requireQuestionnairePermission(storage, 'manage'),
  async (req, res, next) => {
    try {
      const result = safeValidateQuestionnaire(req.body);
      if (!result.success) {
        res.status(400).json({ error: 'Invalid questionnaire', details: result.error });
        return;
      }
      const pathId = req.params['id'] ?? '';
      if (result.data.id !== pathId) {
        res.status(400).json({ error: 'Path ID does not match questionnaire ID in body' });
        return;
      }
      const stored = res.locals['questionnaire'] as Questionnaire;
      const updated: Questionnaire = {
        id: result.data.id,
        version: result.data.version,
        metadata: result.data.metadata,
        questions: result.data.questions,
        config: result.data.config,
        ownerId: stored.ownerId,
        permissions: stored.permissions,
      };
      await storage.saveQuestionnaire(updated);
      res.json(updated);
    } catch (err) {
      next(err);
    }
  },
);

/** Delete a questionnaire — requires 'manage' */
router.delete(
  '/api/questionnaires/:id',
  requireQuestionnairePermission(storage, 'manage'),
  async (req, res, next) => {
    try {
      const id: string = Array.isArray(req.params['id']) ? (req.params['id'][0] ?? '') : (req.params['id'] ?? '');
      await storage.deleteQuestionnaire(id);
      res.status(204).send();
    } catch (err) {
      next(err);
    }
  },
);

// ── Permission Management ─────────────────────────────────────────────────────

/** List permissions on a questionnaire — requires 'manage' */
router.get(
  '/api/questionnaires/:id/permissions',
  requireQuestionnairePermission(storage, 'manage'),
  (_req, res) => {
    const q = res.locals['questionnaire'] as Questionnaire;
    res.json({ ownerId: q.ownerId, permissions: q.permissions });
  },
);

const GrantPermissionBodySchema = z.object({ level: PermissionLevelSchema });

/** Grant or update a user's permission on a questionnaire */
router.put(
  '/api/questionnaires/:id/permissions/:userId',
  requireQuestionnairePermission(storage, 'manage'),
  async (req, res, next) => {
    try {
      const parsed = GrantPermissionBodySchema.safeParse(req.body);
      if (!parsed.success) {
        res.status(400).json({ error: 'Validation failed', details: parsed.error.flatten() });
        return;
      }
      const targetUserIdParam = req.params['userId'];
      const targetUserId = Array.isArray(targetUserIdParam) ? (targetUserIdParam[0] ?? '') : (targetUserIdParam ?? '');
      const q = res.locals['questionnaire'] as Questionnaire;
      if (q.ownerId && q.ownerId === targetUserId) {
        res.status(400).json({ error: 'Cannot set explicit permission for the owner' });
        return;
      }
      const updated: Questionnaire = {
        ...q,
        permissions: [
          ...q.permissions.filter(p => p.userId !== targetUserId),
          { userId: targetUserId, level: parsed.data.level },
        ],
      };
      await storage.saveQuestionnaire(updated);
      res.json({ userId: targetUserId, level: parsed.data.level });
    } catch (err) {
      next(err);
    }
  },
);

/** Revoke a user's permission on a questionnaire */
router.delete(
  '/api/questionnaires/:id/permissions/:userId',
  requireQuestionnairePermission(storage, 'manage'),
  async (req, res, next) => {
    try {
      const targetUserIdParam = req.params['userId'];
      const targetUserId = Array.isArray(targetUserIdParam) ? (targetUserIdParam[0] ?? '') : (targetUserIdParam ?? '');
      const q = res.locals['questionnaire'] as Questionnaire;
      await storage.saveQuestionnaire({
        ...q,
        permissions: q.permissions.filter(p => p.userId !== targetUserId),
      });
      res.status(204).send();
    } catch (err) {
      next(err);
    }
  },
);

// ── Response Routes ───────────────────────────────────────────────────────────

/** List responses for a questionnaire — respond-only users see their own; view_responses/manage see all */
router.get('/api/responses', requireAuth, async (req, res, next) => {
  try {
    const questionnaireId =
      typeof req.query['questionnaireId'] === 'string'
        ? req.query['questionnaireId']
        : undefined;
    if (!questionnaireId) {
      res.status(400).json({ error: 'questionnaireId query parameter is required' });
      return;
    }
    const user = currentUser(res);
    let questionnaire: Questionnaire;
    try {
      questionnaire = await storage.loadQuestionnaire(questionnaireId);
    } catch {
      res.status(404).json({ error: 'Questionnaire not found' });
      return;
    }
    if (!(await enforceOpenFgaPermission(res, 'view_questionnaire', questionnaireObject(questionnaire.id)))) {
      return;
    }
    const effectivePermission = resolvePermission(questionnaire, user.id, user.groups);
    if (!permissionSatisfies(effectivePermission, 'respond')) {
      res.status(403).json({ error: 'Insufficient permissions' });
      return;
    }
    const allResponses = await storage.listResponses(questionnaireId);
    // view_responses and manage users see all responses; respond-only users see only their own
    const responses = permissionSatisfies(effectivePermission, 'view_responses')
      ? allResponses
      : allResponses.filter(r => r.userId === user.id);
    res.json(responses);
  } catch (err) {
    next(err);
  }
});

/** Get a single response — requires 'view_responses' on the parent questionnaire */
router.get('/api/responses/:id', requireAuth, async (req, res, next) => {
  try {
    const responseIdParam = req.params['id'];
    const responseId = Array.isArray(responseIdParam) ? (responseIdParam[0] ?? '') : (responseIdParam ?? '');
    const response = await storage.loadResponse(responseId);
    if (!(await enforceOpenFgaPermission(res, 'view_response', responseObject(response.id)))) {
      return;
    }
    const user = currentUser(res);
    let questionnaire: Questionnaire;
    try {
      questionnaire = await storage.loadQuestionnaire(response.questionnaireId);
    } catch {
      res.status(404).json({ error: 'Questionnaire not found' });
      return;
    }
    if (
      !permissionSatisfies(resolvePermission(questionnaire, user.id, user.groups), 'view_responses')
    ) {
      // respond-only users may fetch their own response; others are denied
      const effective = resolvePermission(questionnaire, user.id, user.groups);
      if (!permissionSatisfies(effective, 'respond') || response.userId !== user.id) {
        res.status(403).json({ error: 'Insufficient permissions' });
        return;
      }
    }
    res.json(response);
  } catch {
    res.status(404).json({ error: 'Response not found' });
  }
});

// ── Session Routes ────────────────────────────────────────────────────────────

/** Start a new session — requires 'respond' access on the questionnaire */
router.post('/api/sessions', requireAuth, async (req, res, next) => {
  try {
    const body = req.body as { questionnaireId?: string };
    if (!body.questionnaireId) {
      res.status(400).json({ error: 'questionnaireId is required' });
      return;
    }
    const user = currentUser(res);
    let questionnaire: Questionnaire;
    try {
      questionnaire = await storage.loadQuestionnaire(body.questionnaireId);
    } catch {
      res.status(404).json({ error: 'Questionnaire not found' });
      return;
    }
    if (!(await enforceOpenFgaPermission(res, 'create_response', questionnaireObject(questionnaire.id)))) {
      return;
    }
    if (
      !permissionSatisfies(resolvePermission(questionnaire, user.id, user.groups), 'respond')
    ) {
      res.status(403).json({ error: 'Insufficient permissions' });
      return;
    }
    const sessionId = await storage.createSession(body.questionnaireId, user.id);
    await storage.updateSession(sessionId, { userId: user.id });
    res.status(201).json({ sessionId });
  } catch (err) {
    if (isNotFoundError(err)) {
      res.status(404).json({ error: 'Questionnaire not found' });
    } else {
      next(err);
    }
  }
});

/** Get current session state including the current question */
router.get('/api/sessions/:sessionId', requireSessionOwner(storage), async (_req, res, next) => {
  try {
    const session = res.locals['session'];
    const questionnaire = await storage.loadQuestionnaire(session.questionnaireId);
    const response = await storage.loadResponse(session.sessionId);

    const currentIndex = response.progress.currentQuestionIndex;
    const currentQuestion = questionnaire.questions[currentIndex] ?? null;

    res.json({
      session,
      questionnaire: {
        id: questionnaire.id,
        title: questionnaire.metadata.title,
        totalQuestions: questionnaire.questions.length,
        config: questionnaire.config,
      },
      currentQuestion,
      currentQuestionIndex: currentIndex,
      progress: response.progress,
      answers: response.answers,
    });
  } catch (err) {
    next(err);
  }
});

/** Submit an answer and advance to the next question */
router.post('/api/sessions/:sessionId/answer', requireSessionOwner(storage), async (req, res, next) => {
  try {
    const session = res.locals['session'];
    const sessionId: string = session.sessionId;
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
      console.error('Error saving answer:', err);
      next(err);
    }
  }
});

/** Mark a session as complete */
router.post('/api/sessions/:sessionId/complete', requireSessionOwner(storage), async (_req, res, next) => {
  try {
    const session = res.locals['session'];
    const sessionId: string = session.sessionId;
    const response = await storage.loadResponse(sessionId);
    const now = new Date().toISOString();
    await storage.saveResponse({
      ...response,
      status: ResponseStatus.COMPLETED,
      completedAt: now,
      lastSavedAt: now,
    });
    await storage.updateSession(sessionId, { status: 'completed', updatedAt: now });
    res.json({ success: true, sessionId });
  } catch (err) {
    if (isNotFoundError(err)) {
      res.status(404).json({ error: 'Session not found' });
    } else {
      next(err);
    }
  }
});

// ── Auth / Identity ───────────────────────────────────────────────────────────

/** Return the current user's identity (sourced from Authelia proxy headers) */
router.get('/api/auth/me', (_req, res) => {
  const user = res.locals['user'];
  if (!user) {
    res.status(401).json({ error: 'Not authenticated' });
    return;
  }
  res.json({ user });
});

/**
 * Logout endpoint.
 * If `AUTH_LOGOUT_URL` is configured, redirect the user to that URL (external
 * identity provider / proxy logout). Otherwise, redirect to the app root.
 */
router.get('/logout', (_req, res) => {
  const logoutUrl = validatedLogoutRedirect(process.env['AUTH_LOGOUT_URL']);
  if (logoutUrl) {
    res.redirect(logoutUrl);
    return;
  }

  // Fallback: navigate back to the application root (this will leave the
  // user unauthenticated only if the upstream proxy clears its session).
  res.redirect(BASE_PATH || '/');
});

// ── User Directory ────────────────────────────────────────────────────────────

/** List all provisioned users — used by the sharing UI */
router.get('/api/users', requireAuth, async (_req, res, next) => {
  try {
    const users = await userRepository.findAll();
    res.json(users.map(u => ({ id: u.id, email: u.email, name: u.name })));
  } catch (err) {
    next(err);
  }
});

// ── Review Routes ─────────────────────────────────────────────────────────────

const reviewService = new ReviewService(storage);

/** Get completion stats for a questionnaire */
router.get(
  '/api/questionnaires/:id/stats',
  requireQuestionnairePermission(storage, 'view_responses'),
  async (req, res, next) => {
    try {
      const stats = await reviewService.getCompletionStats(req.params['id'] as string);
      res.json(stats);
    } catch (err) {
      next(err);
    }
  },
);

/** Get full analytics summary for a questionnaire */
router.get(
  '/api/questionnaires/:id/summary',
  requireQuestionnairePermission(storage, 'view_responses'),
  async (req, res, next) => {
    try {
      const summary = await reviewService.getSummary(req.params['id'] as string);
      res.json(summary);
    } catch (err) {
      next(err);
    }
  },
);

/** Export responses for a questionnaire */
router.get(
  '/api/questionnaires/:id/export',
  requireQuestionnairePermission(storage, 'view_responses'),
  async (req, res, next) => {
    try {
      const format = req.query['format'] === 'csv' ? 'csv' : 'json';
      const id = req.params['id'] as string;
      if (format === 'csv') {
        res.setHeader('Content-Type', 'text/csv');
        res.setHeader('Content-Disposition', `attachment; filename="responses-${id}.csv"`);
        res.send(await reviewService.exportToCsv(id));
      } else {
        res.setHeader('Content-Type', 'application/json');
        res.setHeader('Content-Disposition', `attachment; filename="responses-${id}.json"`);
        res.send(await reviewService.exportToJson(id));
      }
    } catch (err) {
      next(err);
    }
  },
);

// ── Error Handling ────────────────────────────────────────────────────────────

app.use(errorHandler);

// ── Start Server ──────────────────────────────────────────────────────────────

// Export the app for Vercel serverless functions
export default app;

// Only start the HTTP server when running locally (not in a Vercel deployment or test environment)
if (!isVercel && NODE_ENV !== 'test') {
  // Bind to 127.0.0.1 in production so the service is only reachable via the
  // nginx reverse proxy. In development, bind to all interfaces for convenience.
  const HOST = NODE_ENV === 'production' ? '127.0.0.1' : '0.0.0.0';
  app.listen(PORT, HOST, () => {
    console.log(`Questionnaire web server running at http://${HOST}:${PORT}${BASE_PATH || '/'}`);
    console.log(`Data directory: ${DATA_DIR}`);
    if (BASE_PATH) {
      console.log(`Sub-path: ${BASE_PATH}`);
    }
    if (NODE_ENV === 'production') {
      console.log('[auth] Production mode: requests without proxy headers are processed as the guest identity');
    } else {
      const stub = process.env['DEV_STUB_USER'];
      if (stub) {
        console.log(`[auth] DEV_STUB_USER is set — stub identity active (${stub.split(':')[0] ?? 'unknown'})`);
      } else {
        console.log('[auth] Development mode: no DEV_STUB_USER set; unauthenticated requests use the guest identity');
      }
    }
  });
}
