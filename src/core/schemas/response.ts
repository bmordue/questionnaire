import { z } from 'zod';

/**
 * Answer Schema
 * Represents a single answer to a question with metadata
 */
const AnswerSchema = z.object({
  questionId: z.string(),
  value: z.any(),
  answeredAt: z.string().datetime(),
  duration: z.number().min(0).optional(), // Time spent on question in milliseconds
  attempts: z.number().int().min(0).optional(), // Number of times answer was changed
  skipped: z.boolean().optional() // Whether question was skipped
});

/**
 * Response Status Enum
 */
export enum ResponseStatus {
  IN_PROGRESS = 'in_progress',
  COMPLETED = 'completed',
  ABANDONED = 'abandoned'
}

/**
 * Response Progress Schema
 */
const ResponseProgressSchema = z.object({
  currentQuestionIndex: z.number().int().min(0),
  totalQuestions: z.number().int().min(1),
  answeredCount: z.number().int().min(0),
  skippedCount: z.number().int().min(0).optional(),
  percentComplete: z.number().min(0).max(100).optional()
});

/**
 * Questionnaire Response Schema
 */
export const QuestionnaireResponseSchema = z.object({
  id: z.string(),
  questionnaireId: z.string(),
  questionnaireVersion: z.string(),
  sessionId: z.string(),
  startedAt: z.string().datetime(),
  completedAt: z.string().datetime().optional(),
  lastSavedAt: z.string().datetime().optional(),
  totalDuration: z.number().min(0).optional(), // Total time in milliseconds
  status: z.nativeEnum(ResponseStatus),
  answers: z.array(AnswerSchema),
  progress: ResponseProgressSchema,
  metadata: z.record(z.string(), z.any()).optional(),
  version: z.string().default('1.0') // Response schema version (default applied by Zod when parsing incomplete objects; createResponse() sets this explicitly)
});

/**
 * TypeScript types derived from schemas
 */
export type QuestionnaireResponse = z.infer<typeof QuestionnaireResponseSchema>;
export type Answer = z.infer<typeof AnswerSchema>;
export type ResponseProgress = z.infer<typeof ResponseProgressSchema>;

/**
 * Validation utilities
 */

/**
 * Validates a questionnaire response object
 * @param data - The response data to validate
 * @returns Validated response object
 * @throws ZodError if validation fails
 */
export function validateResponse(data: unknown): QuestionnaireResponse {
  return QuestionnaireResponseSchema.parse(data);
}

/**
 * Safely validates a questionnaire response object
 * @param data - The response data to validate
 * @returns Success object with data or error details
 */
export function safeValidateResponse(data: unknown) {
  return QuestionnaireResponseSchema.safeParse(data);
}

/**
 * Creates a new questionnaire response
 */
export function createResponse(
  questionnaireId: string,
  questionnaireVersion: string,
  sessionId: string,
  totalQuestions: number
): QuestionnaireResponse {
  const now = new Date().toISOString();
  
  return QuestionnaireResponseSchema.parse({
    id: `response-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`,
    questionnaireId,
    questionnaireVersion,
    sessionId,
    startedAt: now,
    lastSavedAt: now,
    status: ResponseStatus.IN_PROGRESS,
    answers: [],
    progress: {
      currentQuestionIndex: 0,
      totalQuestions,
      answeredCount: 0,
      skippedCount: 0,
      percentComplete: 0
    },
    version: '1.0'
  });
}
