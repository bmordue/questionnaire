/**
 * Auth Middleware
 *
 * Reads identity from Authelia forward-auth proxy headers (Remote-User,
 * Remote-Name, Remote-Groups) set by nginx after authentication succeeds.
 * The app trusts these headers — nginx MUST strip them from untrusted clients.
 *
 * Users are provisioned just-in-time: on the first authenticated request for
 * a previously-unknown email, a User record is created in the local store.
 */

import type { Request, Response, NextFunction } from 'express';
import type { FileUserRepository } from '../../core/repositories/file-user-repository.js';
import type { RuntimeUser } from '../../core/schemas/user.js';

/**
 * Header names as set by Authelia.
 * Confirm these match your Authelia `headers:` configuration.
 */
const HEADER_REMOTE_USER = 'remote-user';
const HEADER_REMOTE_NAME = 'remote-name';
const HEADER_REMOTE_GROUPS = 'remote-groups';

/**
 * The name of the group that grants admin (manage-all) access.
 * Override with the ADMIN_GROUP environment variable.
 */
function adminGroup(): string {
  return process.env['ADMIN_GROUP'] ?? 'admins';
}

/**
 * Load user identity from Authelia proxy headers and JIT-provision a User
 * record if the email is encountered for the first time.
 *
 * Sets res.locals['user'] as a RuntimeUser (includes per-request groups).
 * Non-blocking — if headers are absent, continues with no user set.
 */
export function loadUser(userRepository: FileUserRepository) {
  return async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const email = req.headers[HEADER_REMOTE_USER];
      if (typeof email === 'string' && email.trim() !== '') {
        const name = (typeof req.headers[HEADER_REMOTE_NAME] === 'string'
          ? req.headers[HEADER_REMOTE_NAME]
          : email) as string;

        const rawGroups = req.headers[HEADER_REMOTE_GROUPS];
        const groups: string[] = typeof rawGroups === 'string' && rawGroups.trim() !== ''
          ? rawGroups.split(',').map(g => g.trim()).filter(Boolean)
          : [];

        // JIT-provision: find existing user or create one
        const user = await userRepository.findOrCreate(email.toLowerCase(), name);

        const runtimeUser: RuntimeUser = { ...user, groups };
        res.locals['user'] = runtimeUser;
      }
    } catch {
      // Non-fatal: proceed unauthenticated
    }
    next();
  };
}

/**
 * Require an authenticated user (proxy headers were present).
 * Returns 401 if unauthenticated.
 */
export function requireAuth(_req: Request, res: Response, next: NextFunction): void {
  if (!res.locals['user']) {
    res.status(401).json({ error: 'Authentication required' });
    return;
  }
  next();
}

/**
 * Require membership in the admin group (from Remote-Groups).
 * Returns 403 if the user is not in the configured admin group.
 */
export function requireAdmin(_req: Request, res: Response, next: NextFunction): void {
  const user = res.locals['user'] as RuntimeUser | undefined;
  if (!user || !user.groups.includes(adminGroup())) {
    res.status(403).json({ error: 'Admin access required' });
    return;
  }
  next();
}

/**
 * Returns true if the request's authenticated user is an admin.
 */
export function isAdmin(res: Response): boolean {
  const user = res.locals['user'] as RuntimeUser | undefined;
  return !!user && user.groups.includes(adminGroup());
}
