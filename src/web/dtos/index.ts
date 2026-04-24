/**
 * Data Transfer Objects (DTOs) for Web Operations
 *
 * Zod schemas for request/response validation at the HTTP boundary.
 * These extend the core domain schemas with web-specific fields and error formats.
 */

import { z } from 'zod';

// ── Questionnaire DTOs ────────────────────────────────────────────────────────

export const CreateQuestionnaireBodySchema = z.object({
  title: z.string().min(1, 'Title is required'),
  description: z.string().optional(),
  author: z.string().optional(),
  questions: z.array(z.any()).check(z.minLength(1, { error: 'At least one question is required' })),
  config: z.record(z.string(), z.any()).optional(),
  tags: z.array(z.string()).optional(),
});

export type CreateQuestionnaireBody = z.infer<typeof CreateQuestionnaireBodySchema>;

export const UpdateQuestionnaireBodySchema = z.object({
  title: z.string().min(1).optional(),
  description: z.string().optional(),
  author: z.string().optional(),
  questions: z.array(z.any()).check(z.minLength(1, {})).optional(),
  config: z.record(z.string(), z.any()).optional(),
  tags: z.array(z.string()).optional(),
});

export type UpdateQuestionnaireBody = z.infer<typeof UpdateQuestionnaireBodySchema>;

export const QuestionnaireListQuerySchema = z.object({
  publishedOnly: z.coerce.boolean().optional(),
  tag: z.string().optional(),
  limit: z.coerce.number().int().positive().optional(),
  offset: z.coerce.number().int().min(0).optional(),
});

export type QuestionnaireListQuery = z.infer<typeof QuestionnaireListQuerySchema>;

// ── Session / Answer DTOs ─────────────────────────────────────────────────────

export const StartSessionBodySchema = z.object({
  questionnaireId: z.string().min(1, 'questionnaireId is required'),
});

export type StartSessionBody = z.infer<typeof StartSessionBodySchema>;

export const SubmitAnswerBodySchema = z.object({
  questionId: z.string().min(1, 'questionId is required'),
  value: z.unknown().optional(),
  skipped: z.boolean().optional().default(false),
});

export type SubmitAnswerBody = z.infer<typeof SubmitAnswerBodySchema>;

// ── Response / Review DTOs ────────────────────────────────────────────────────

export const ResponseListQuerySchema = z.object({
  questionnaireId: z.string().optional(),
  status: z.enum(['in_progress', 'completed', 'abandoned']).optional(),
  completedAfter: z.string().datetime().optional(),
  completedBefore: z.string().datetime().optional(),
  limit: z.coerce.number().int().positive().optional(),
  offset: z.coerce.number().int().min(0).optional(),
});

export type ResponseListQuery = z.infer<typeof ResponseListQuerySchema>;

export const ExportQuerySchema = z.object({
  format: z.enum(['json', 'csv']).default('json'),
  status: z.enum(['in_progress', 'completed', 'abandoned']).optional(),
  completedAfter: z.string().datetime().optional(),
  completedBefore: z.string().datetime().optional(),
});

export type ExportQuery = z.infer<typeof ExportQuerySchema>;

// ── Standard API response envelopes ──────────────────────────────────────────

export interface ApiSuccess<T> {
  data: T;
}

export interface ApiError {
  error: string;
  details?: unknown;
  code?: string;
}

export function apiSuccess<T>(data: T): ApiSuccess<T> {
  return { data };
}

export function apiError(message: string, details?: unknown, code?: string): ApiError {
  return { error: message, ...(details !== undefined && { details }), ...(code && { code }) };
}
