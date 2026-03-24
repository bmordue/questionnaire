/**
 * Auth Service
 *
 * Provides login, logout, registration, and password management.
 */

import { FileUserRepository } from '../repositories/file-user-repository.js';
import { SessionManager } from './session-manager.js';
import { hashPassword, verifyPassword } from './password-hasher.js';
import { generateSecureToken, timingSafeEqual } from './tokens.js';
import type { User, PublicUser, RegisterInput, LoginInput } from '../schemas/user.js';

export interface AuthResult {
  user: PublicUser;
  /** Session token to store in a cookie */
  token: string;
}

export class AuthError extends Error {
  constructor(
    message: string,
    public readonly code: 'INVALID_CREDENTIALS' | 'EMAIL_TAKEN' | 'USER_NOT_FOUND' | 'INVALID_TOKEN' | 'ACCOUNT_INACTIVE',
  ) {
    super(message);
    this.name = 'AuthError';
  }
}

function toPublicUser(user: User): PublicUser {
  const { passwordHash, passwordResetToken, passwordResetExpiry, ...publicUser } = user;
  void passwordHash;
  void passwordResetToken;
  void passwordResetExpiry;
  return publicUser;
}

export class AuthService {
  constructor(
    private readonly users: FileUserRepository,
    private readonly sessions: SessionManager,
  ) {}

  /**
   * Register a new user account.
   */
  async register(
    input: RegisterInput,
    opts: { role?: User['role']; userAgent?: string; ipAddress?: string } = {},
  ): Promise<AuthResult> {
    const emailTaken = await this.users.emailExists(input.email);
    if (emailTaken) {
      throw new AuthError(`Email already registered: ${input.email}`, 'EMAIL_TAKEN');
    }

    const passwordHash = await hashPassword(input.password);

    const createData: Parameters<typeof this.users.create>[0] = {
      email: input.email,
      passwordHash,
      name: input.name,
    };
    if (opts.role !== undefined) createData.role = opts.role;
    const user = await this.users.create(createData);

    const sessionOpts: { userAgent?: string; ipAddress?: string } = {};
    if (opts.userAgent !== undefined) sessionOpts.userAgent = opts.userAgent;
    if (opts.ipAddress !== undefined) sessionOpts.ipAddress = opts.ipAddress;
    const session = await this.sessions.create(user.id, sessionOpts);

    return { user: toPublicUser(user), token: session.token };
  }

  /**
   * Authenticate a user with email + password.
   */
  async login(
    input: LoginInput,
    opts: { userAgent?: string; ipAddress?: string } = {},
  ): Promise<AuthResult> {
    const user = await this.users.findByEmail(input.email);

    // Always run bcrypt comparison to prevent timing attacks
    const dummyHash = '$2a$12$aaaaaaaaaaaaaaaaaaaaaa.aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa';
    const hashToCompare = user ? user.passwordHash : dummyHash;
    const valid = await verifyPassword(input.password, hashToCompare);

    if (!user || !valid) {
      throw new AuthError('Invalid email or password', 'INVALID_CREDENTIALS');
    }

    if (!user.active) {
      throw new AuthError('Account is inactive', 'ACCOUNT_INACTIVE');
    }

    const loginOpts: { userAgent?: string; ipAddress?: string } = {};
    if (opts.userAgent !== undefined) loginOpts.userAgent = opts.userAgent;
    if (opts.ipAddress !== undefined) loginOpts.ipAddress = opts.ipAddress;
    const session = await this.sessions.create(user.id, loginOpts);

    return { user: toPublicUser(user), token: session.token };
  }

  /**
   * Validate a session token and return the associated user.
   * Returns null if the token is invalid or expired.
   */
  async validateSession(token: string): Promise<PublicUser | null> {
    const session = await this.sessions.get(token);
    if (!session) return null;

    const user = await this.users.findById(session.userId);
    if (!user || !user.active) return null;

    return toPublicUser(user);
  }

  /**
   * Log out by destroying the session.
   */
  async logout(token: string): Promise<void> {
    await this.sessions.destroy(token);
  }

  /**
   * Log out all sessions for a user.
   */
  async logoutAll(userId: string): Promise<void> {
    await this.sessions.destroyForUser(userId);
  }

  /**
   * Change a user's password (requires current password).
   */
  async changePassword(
    userId: string,
    currentPassword: string,
    newPassword: string,
  ): Promise<void> {
    const user = await this.users.findById(userId);
    if (!user) throw new AuthError(`User not found: ${userId}`, 'USER_NOT_FOUND');

    const valid = await verifyPassword(currentPassword, user.passwordHash);
    if (!valid) throw new AuthError('Current password is incorrect', 'INVALID_CREDENTIALS');

    const newHash = await hashPassword(newPassword);
    await this.users.update(userId, { passwordHash: newHash });

    // Invalidate all existing sessions
    await this.sessions.destroyForUser(userId);
  }

  /**
   * Initiate a password reset – returns the reset token (caller should email it).
   */
  async requestPasswordReset(email: string): Promise<string> {
    const user = await this.users.findByEmail(email);
    // Return without error even if user not found (security: prevent enumeration)
    if (!user) return generateSecureToken();

    const token = generateSecureToken();
    await this.users.setPasswordResetToken(user.id, token, 60);
    return token;
  }

  /**
   * Complete a password reset with the token received by email.
   */
  async confirmPasswordReset(token: string, newPassword: string): Promise<void> {
    const users = await this.users.findAll();
    const user = users.find(
      u =>
        u.passwordResetToken !== undefined &&
        u.passwordResetExpiry !== undefined &&
        timingSafeEqual(u.passwordResetToken, token) &&
        new Date(u.passwordResetExpiry) > new Date(),
    );

    if (!user) {
      throw new AuthError('Invalid or expired password reset token', 'INVALID_TOKEN');
    }

    const newHash = await hashPassword(newPassword);
    await this.users.update(user.id, { passwordHash: newHash });
    await this.users.clearPasswordResetToken(user.id);
    await this.sessions.destroyForUser(user.id);
  }
}
