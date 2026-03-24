/**
 * Error Handling Middleware
 *
 * Converts known error types to appropriate HTTP responses.
 */

import type { Request, Response, NextFunction } from 'express';
import { AuthError } from '../../core/auth/auth-service.js';
import {
  QuestionnaireNotFoundError,
  QuestionnaireValidationError,
} from '../../core/services/questionnaire-service.js';
import { ResponseNotFoundError, InvalidAnswerError } from '../../core/services/response-service.js';
import { EntityNotFoundError, ConcurrencyError } from '../../core/repositories/interfaces.js';

/**
 * Central error handler. Must be registered last with app.use().
 */
export function errorHandler(
  err: unknown,
  _req: Request,
  res: Response,
  _next: NextFunction,
): void {
  // Handle malformed JSON body (Express body-parser throws SyntaxError)
  if (err instanceof SyntaxError && 'body' in (err as any)) {
    res.status(400).json({ error: 'Invalid JSON in request body' });
    return;
  }

  if (err instanceof AuthError) {
    const status = err.code === 'INVALID_CREDENTIALS' || err.code === 'INVALID_TOKEN' ? 401 : 400;
    res.status(status).json({ error: err.message, code: err.code });
    return;
  }

  if (err instanceof QuestionnaireNotFoundError || err instanceof ResponseNotFoundError) {
    res.status(404).json({ error: err.message });
    return;
  }

  if (err instanceof QuestionnaireValidationError) {
    res.status(400).json({ error: err.message, details: err.details });
    return;
  }

  if (err instanceof InvalidAnswerError) {
    res.status(400).json({ error: err.message });
    return;
  }

  if (err instanceof EntityNotFoundError) {
    res.status(404).json({ error: err.message });
    return;
  }

  if (err instanceof ConcurrencyError) {
    res.status(409).json({ error: err.message, code: 'CONCURRENCY_CONFLICT' });
    return;
  }

  // Generic server error
  console.error('Unhandled error:', err);
  res.status(500).json({ error: 'Internal server error' });
}

/**
 * 404 handler for unmatched routes.
 */
export function notFoundHandler(req: Request, res: Response): void {
  res.status(404).json({ error: `Route not found: ${req.method} ${req.path}` });
}
