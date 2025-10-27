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

/**
 * Main Questionnaire Schema
 */
export const QuestionnaireSchema = z.object({
  id: z.string(),
  version: z.string(),
  metadata: QuestionnaireMetadataSchema,
  questions: z.array(QuestionSchema).min(1),
  config: QuestionnaireConfigSchema
});

/**
 * TypeScript types derived from schemas
 */
export type Questionnaire = z.infer<typeof QuestionnaireSchema>;
export type QuestionnaireMetadata = z.infer<typeof QuestionnaireMetadataSchema>;
export type QuestionnaireConfig = z.infer<typeof QuestionnaireConfigSchema>;

/**
 * Validation utilities
 */

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
