/**
 * Auth Middleware
 *
 * Reads identity from Authelia forward-auth proxy headers (Remote-User,
 * Remote-Name, Remote-Email, Remote-Groups) set by nginx after authentication
 * succeeds. The app trusts these headers — nginx MUST strip them from
 * untrusted clients before forwarding to this service.
 *
 * Users are provisioned just-in-time: on the first authenticated request for
 * a previously-unknown email, a User record is created in the local store.
 *
 * Requests that arrive without any identity headers are processed as the
 * built-in guest user (see GUEST_USER). The guest sentinel has no group
 * memberships and therefore no admin or ownership privileges; protected
 * endpoints still gate access via requireAuth and per-resource ACL checks.
 *
 * Optional strict mode:
 *   requireProxyAuth() is exported for deployments that want to reject
 *   unauthenticated requests outright (defense in depth behind a proxy).
 *   It is no longer registered by default; opt in by calling it explicitly
 *   in the middleware stack. It is gated by NODE_ENV=production or
 *   REQUIRE_PROXY_AUTH=true.
 *
 * Development/local mode:
 *   Set DEV_STUB_USER="email:Display Name:group1,group2" to inject a fake
 *   identity so the service can be exercised without the full Authelia stack.
 *   DEV_STUB_USER is ignored when NODE_ENV=production.
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
const HEADER_REMOTE_EMAIL = 'remote-email';
const HEADER_REMOTE_GROUPS = 'remote-groups';

/**
 * Sentinel user assigned when no authentication headers are present.
 * Guest users have no group memberships and therefore no admin privileges.
 */
export const GUEST_USER: RuntimeUser = {
  id: 'guest',
  email: 'guest@localhost',
  name: 'Guest',
  createdAt: new Date(0).toISOString(),
  updatedAt: new Date(0).toISOString(),
  active: true,
  groups: [],
};

/**
 * The name of the group that grants admin (manage-all) access.
 * Override with the ADMIN_GROUP environment variable.
 */
function adminGroup(): string {
  return process.env['ADMIN_GROUP'] ?? 'admins';
}

/**
 * Returns true when the service is running in production proxy-auth mode.
 * Controlled by NODE_ENV=production or REQUIRE_PROXY_AUTH=true.
 */
function proxyAuthRequired(): boolean {
  return (
    process.env['NODE_ENV'] === 'production' ||
    process.env['REQUIRE_PROXY_AUTH'] === 'true'
  );
}

/**
 * Parse the DEV_STUB_USER environment variable into identity fields.
 * Format: "email:Display Name:group1,group2"
 * The groups segment is optional.
 * Returns null if the variable is unset or the format is invalid.
 */
function parseDevStubUser(): { email: string; name: string; groups: string[] } | null {
  const raw = process.env['DEV_STUB_USER'];
  if (!raw || proxyAuthRequired()) return null;

  const firstColon = raw.indexOf(':');
  if (firstColon < 0) return null;

  const email = raw.slice(0, firstColon).trim();
  if (!email) return null;

  const rest = raw.slice(firstColon + 1);
  const secondColon = rest.indexOf(':');
  let name: string;
  let groupsStr: string;

  if (secondColon < 0) {
    name = rest.trim();
    groupsStr = '';
  } else {
    name = rest.slice(0, secondColon).trim();
    groupsStr = rest.slice(secondColon + 1).trim();
  }

  if (!name) name = email;
  const groups = groupsStr ? groupsStr.split(',').map(g => g.trim()).filter(Boolean) : [];
  return { email, name, groups };
}

/**
 * Optional strict-mode middleware: enforce that every request carries Authelia
 * proxy headers.
 *
 * Active when NODE_ENV=production or REQUIRE_PROXY_AUTH=true (otherwise it is
 * a pass-through). Returns 401 if the Remote-User header is absent.
 *
 * This middleware is **not** registered by default — by default, requests
 * without identity headers fall through to the guest identity in loadUser.
 * Call this explicitly in your middleware stack if you want to reject
 * unauthenticated requests as a defense-in-depth measure.
 */
export function requireProxyAuth(req: Request, res: Response, next: NextFunction): void {
  if (!proxyAuthRequired()) {
    next();
    return;
  }

  const remoteUser = req.headers[HEADER_REMOTE_USER];
  if (typeof remoteUser !== 'string' || remoteUser.trim() === '') {
    res.status(401).json({ error: 'Missing proxy authentication headers' });
    return;
  }

  next();
}

/**
 * Load user identity from Authelia proxy headers and JIT-provision a User
 * record if the email is encountered for the first time.
 *
 * Header resolution priority:
 *  1. Real Authelia proxy headers (Remote-User / Remote-Name / Remote-Groups)
 *  2. DEV_STUB_USER environment variable (development only)
 *  3. Guest sentinel (unauthenticated — only permitted outside production)
 *
 * Sets res.locals['user'] as a RuntimeUser (includes per-request groups).
 * Also logs the authenticated principal (email) for audit purposes — tokens
 * and passwords are never logged.
 */
export function loadUser(userRepository: FileUserRepository) {
  return async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      // Prefer the real Remote-User header; fall back to Remote-Email if present
      const rawEmail =
        req.headers[HEADER_REMOTE_USER] ??
        req.headers[HEADER_REMOTE_EMAIL];

      const email = typeof rawEmail === 'string' ? rawEmail.trim().toLowerCase() : '';

      if (email !== '') {
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
        console.log(`[auth] principal="${email}" method=${req.method} path=${req.originalUrl}`);
      } else {
        // Check for development stub identity
        const stub = parseDevStubUser();
        if (stub) {
          const user = await userRepository.findOrCreate(stub.email.toLowerCase(), stub.name);
          const runtimeUser: RuntimeUser = { ...user, groups: stub.groups };
          res.locals['user'] = runtimeUser;
          console.log(`[auth] stub principal="${stub.email}" method=${req.method} path=${req.originalUrl}`);
        } else {
          // No authentication headers and no stub — treat as guest
          res.locals['user'] = GUEST_USER;
          console.log(`[auth] principal=guest method=${req.method} path=${req.originalUrl}`);
        }
      }
    } catch {
      // Non-fatal: proceed as guest
      res.locals['user'] = GUEST_USER;
    }
    next();
  };
}

/**
 * Require an authenticated user (proxy headers were present and resolved to a
 * real user, not the guest sentinel).
 * Returns 401 if the request is unauthenticated.
 */
export function requireAuth(_req: Request, res: Response, next: NextFunction): void {
  const user = res.locals['user'] as RuntimeUser | undefined;
  if (!user || user.id === GUEST_USER.id) {
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
