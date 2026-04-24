/**
 * ACL Middleware
 *
 * Per-questionnaire access control enforcement.
 * Works in conjunction with the loadUser middleware which must run first.
 */

import type { Request, Response, NextFunction } from 'express';
import type { StorageService } from '../../core/storage/types.js';
import type { RuntimeUser } from '../../core/schemas/user.js';
import type { PermissionLevel } from '../../core/schemas/questionnaire.js';
import { resolvePermission, permissionSatisfies } from '../../core/schemas/questionnaire.js';

/**
 * Middleware factory that enforces a minimum permission level on a questionnaire.
 *
 * Expects:
 *   - req.params.id to be the questionnaire ID
 *   - res.locals['user'] to be set by loadUser (or returns 401)
 *
 * Returns:
 *   - 401 if not authenticated
 *   - 404 if questionnaire not found
 *   - 403 if authenticated but insufficient permission
 *   - calls next() if permission check passes
 *
 * On success, attaches the loaded questionnaire to res.locals['questionnaire']
 * so downstream handlers do not need to re-load it.
 */
export function requireQuestionnairePermission(
  storage: StorageService,
  required: PermissionLevel,
) {
  return async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    const user = res.locals['user'] as RuntimeUser | undefined;
    if (!user) {
      res.status(401).json({ error: 'Authentication required' });
      return;
    }

    const id = Array.isArray(req.params['id']) ? req.params['id'][0] : (req.params['id'] ?? '');
    let questionnaire;
    try {
      questionnaire = await storage.loadQuestionnaire(id || '');
    } catch {
      res.status(404).json({ error: 'Questionnaire not found' });
      return;
    }

    const effective = resolvePermission(questionnaire, user.id, user.groups);
    if (!permissionSatisfies(effective, required)) {
      res.status(403).json({ error: 'Insufficient permissions' });
      return;
    }

    // Cache the loaded questionnaire so downstream handlers can skip re-loading
    res.locals['questionnaire'] = questionnaire;
    next();
  };
}

/**
 * Middleware that verifies the requesting user owns the session they are
 * operating on. To be applied on session-specific routes.
 *
 * Expects:
 *   - req.params.sessionId to be the session ID
 *   - res.locals['user'] to be set by loadUser
 *
 * Returns 401, 403, or 404 as appropriate.
 */
export function requireSessionOwner(storage: StorageService) {
  return async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    const user = res.locals['user'] as RuntimeUser | undefined;
    if (!user) {
      res.status(401).json({ error: 'Authentication required' });
      return;
    }

    const sessionId = Array.isArray(req.params['sessionId']) ? req.params['sessionId'][0] : (req.params['sessionId'] ?? '');
    let session;
    try {
      session = await storage.loadSession(sessionId || '');
    } catch {
      res.status(404).json({ error: 'Session not found' });
      return;
    }

    // Admins can access any session; otherwise must own it
    const adminGroup = process.env['ADMIN_GROUP'] ?? 'admins';
    const isAdmin = user.groups.includes(adminGroup);

    if (!isAdmin && session.userId !== user.id) {
      res.status(403).json({ error: 'Insufficient permissions' });
      return;
    }

    res.locals['session'] = session;
    next();
  };
}
