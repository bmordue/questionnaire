import { z } from 'zod';
import { QuestionSchema } from './question.js';

// Metadata schema
export const MetadataSchema = z.object({
  createdAt: z.string().datetime().optional(),
  updatedAt: z.string().datetime().optional(),
  version: z.string().default('1.0.0')
});

// Main questionnaire schema
export const QuestionnaireSchema = z.object({
  id: z.string(),
  title: z.string(),
  description: z.string().optional(),
  version: z.string().default('1.0.0'),
  questions: z.array(QuestionSchema),
  metadata: MetadataSchema.optional()
});

export type Questionnaire = z.infer<typeof QuestionnaireSchema>;
