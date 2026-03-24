/**
 * User Schema
 *
 * Zod schema for user accounts with role-based access control.
 */

import { z } from 'zod';

/** User roles */
export const UserRoleSchema = z.enum(['admin', 'creator', 'respondent']);
export type UserRole = z.infer<typeof UserRoleSchema>;

/** Core user schema */
export const UserSchema = z.object({
  /** Unique user identifier */
  id: z.string().min(1),
  /** Email address (used for login, must be unique) */
  email: z.string().email(),
  /** bcrypt password hash */
  passwordHash: z.string().min(1),
  /** User display name */
  name: z.string().min(1).max(100),
  /** Role for access control */
  role: UserRoleSchema.default('respondent'),
  /** Account creation timestamp */
  createdAt: z.string().datetime(),
  /** Last update timestamp */
  updatedAt: z.string().datetime(),
  /** Whether the account is active */
  active: z.boolean().default(true),
  /** Password reset token (if requested) */
  passwordResetToken: z.string().optional(),
  /** Password reset token expiry */
  passwordResetExpiry: z.string().datetime().optional(),
});

export type User = z.infer<typeof UserSchema>;

/** Public user view (without sensitive fields) */
export const PublicUserSchema = UserSchema.omit({
  passwordHash: true,
  passwordResetToken: true,
  passwordResetExpiry: true,
});

export type PublicUser = z.infer<typeof PublicUserSchema>;

/** User registration input */
export const RegisterInputSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8, 'Password must be at least 8 characters'),
  name: z.string().min(1).max(100),
});

export type RegisterInput = z.infer<typeof RegisterInputSchema>;

/** User login input */
export const LoginInputSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
});

export type LoginInput = z.infer<typeof LoginInputSchema>;

/** Password change input */
export const ChangePasswordInputSchema = z.object({
  currentPassword: z.string().min(1),
  newPassword: z.string().min(8, 'Password must be at least 8 characters'),
});

export type ChangePasswordInput = z.infer<typeof ChangePasswordInputSchema>;

/** Password reset request input */
export const PasswordResetRequestSchema = z.object({
  email: z.string().email(),
});

export type PasswordResetRequest = z.infer<typeof PasswordResetRequestSchema>;

/** Password reset confirmation input */
export const PasswordResetConfirmSchema = z.object({
  token: z.string().min(1),
  newPassword: z.string().min(8, 'Password must be at least 8 characters'),
});

export type PasswordResetConfirm = z.infer<typeof PasswordResetConfirmSchema>;
