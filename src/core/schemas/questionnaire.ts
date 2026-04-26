import { z } from 'zod';
import { QuestionSchema } from './question.js';

/**
 * Questionnaire Metadata Schema
 */
export const QuestionnaireMetadataSchema = z.object({
  title: z.string(),
  description: z.string().optional(),
  author: z.string().optional(),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
  tags: z.array(z.string()).optional()
});

/**
 * Questionnaire Configuration Schema
 */
export const QuestionnaireConfigSchema = z.object({
  allowBack: z.boolean().default(true),
  allowSkip: z.boolean().default(false),
  shuffleQuestions: z.boolean().default(false),
  showProgress: z.boolean().default(true)
}).optional();

// ── Access Control ────────────────────────────────────────────────────────────

/**
 * Permission levels for per-questionnaire access control.
 *
 * Hierarchy (highest to lowest): manage > view_responses > respond
 *
 *   manage         — edit/delete the questionnaire, view all responses,
 *                    grant/revoke permissions for other users
 *   view_responses — view all responses (read-only analytics); cannot edit
 *   respond        — view the questionnaire and submit one response
 */
export const PermissionLevelSchema = z.enum(['manage', 'view_responses', 'respond']);
export type PermissionLevel = z.infer<typeof PermissionLevelSchema>;

/** A single ACL entry granting a user a specific permission level */
export const QuestionnairePermissionSchema = z.object({
  userId: z.string().min(1),
  level: PermissionLevelSchema,
});
export type QuestionnairePermission = z.infer<typeof QuestionnairePermissionSchema>;

/**
 * Main Questionnaire Schema
 */
export const QuestionnaireSchema = z.object({
  id: z.string(),
  version: z.string(),
  metadata: QuestionnaireMetadataSchema,
  questions: z.array(QuestionSchema).min(1),
  config: QuestionnaireConfigSchema,
  /**
   * The userId of the user who created this questionnaire.
   * Optional for backwards-compatibility with pre-ACL files (treated as admin-only).
   */
  ownerId: z.string().optional(),
  /**
   * Per-user permission grants. The owner always has implicit 'manage' access.
   * Users not listed here (and not the owner) have no access.
   */
  permissions: z.array(QuestionnairePermissionSchema).default([]),
});

/**
 * TypeScript types derived from schemas
 */
export type Questionnaire = z.infer<typeof QuestionnaireSchema>;
export type QuestionnaireMetadata = z.infer<typeof QuestionnaireMetadataSchema>;
export type QuestionnaireConfig = z.infer<typeof QuestionnaireConfigSchema>;

// ── Permission resolution ─────────────────────────────────────────────────────

/**
 * Resolve the effective permission level for a given user on a questionnaire.
 *
 * Rules (in priority order):
 *   1. If groups contains the admin group name → 'manage' (regardless of ownership)
 *   2. If userId matches ownerId → 'manage'
 *   3. If userId appears in permissions[] → that level
 *   4. Otherwise → null (no access)
 *
 * The admin group name comes from the ADMIN_GROUP env var (default: 'admins').
 */
export function resolvePermission(
  questionnaire: Questionnaire,
  userId: string,
  groups: string[] = [],
): PermissionLevel | null {
  const adminGroup = process.env['ADMIN_GROUP'] ?? 'admins';

  if (groups.includes(adminGroup)) return 'manage';
  if (questionnaire.ownerId && questionnaire.ownerId === userId) return 'manage';

  const entry = questionnaire.permissions.find(p => p.userId === userId);
  return entry?.level ?? null;
}

/**
 * Returns true if the given effective permission level satisfies the required level.
 *
 * Level hierarchy: manage > view_responses > respond
 */
export function permissionSatisfies(
  effective: PermissionLevel | null,
  required: PermissionLevel,
): boolean {
  if (effective === null) return false;
  const rank: Record<PermissionLevel, number> = {
    manage: 3,
    view_responses: 2,
    respond: 1,
  };
  return rank[effective] >= rank[required];
}

// ── Validation utilities ──────────────────────────────────────────────────────

/**
 * Validates a questionnaire object
 * @param data - The questionnaire data to validate
 * @returns Validated questionnaire object
 * @throws ZodError if validation fails
 */
export function validateQuestionnaire(data: unknown): Questionnaire {
  return QuestionnaireSchema.parse(data);
}

/**
 * Safely validates a questionnaire object
 * @param data - The questionnaire data to validate
 * @returns Success object with data or error details
 */
export function safeValidateQuestionnaire(data: unknown) {
  return QuestionnaireSchema.safeParse(data);
}
