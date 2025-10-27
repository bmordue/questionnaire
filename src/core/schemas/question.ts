import { z } from 'zod';

/**
 * Question Types Enum
 * Defines all supported question types in the questionnaire system
 */
export enum QuestionType {
  TEXT = 'text',
  NUMBER = 'number',
  EMAIL = 'email',
  SINGLE_CHOICE = 'single_choice',
  MULTIPLE_CHOICE = 'multiple_choice',
  BOOLEAN = 'boolean',
  DATE = 'date',
  RATING = 'rating'
}

/**
 * Base validation rule schema
 */
const ValidationRuleSchema = z.object({
  type: z.enum(['min', 'max', 'pattern', 'minLength', 'maxLength', 'integer']),
  value: z.union([z.string(), z.number()]),
  message: z.string().optional()
});

/**
 * Text question validation rules
 */
const TextValidationSchema = z.object({
  minLength: z.number().optional(),
  maxLength: z.number().optional(),
  pattern: z.string().optional(),
  patternMessage: z.string().optional()
}).optional();

/**
 * Number question validation rules
 */
const NumberValidationSchema = z.object({
  min: z.number().optional(),
  max: z.number().optional(),
  integer: z.boolean().optional()
}).optional();

/**
 * Date question validation rules
 */
const DateValidationSchema = z.object({
  minDate: z.string().optional(),
  maxDate: z.string().optional(),
  allowPast: z.boolean().optional(),
  allowFuture: z.boolean().optional()
}).optional();

/**
 * Rating question validation rules
 */
const RatingValidationSchema = z.object({
  min: z.number(),
  max: z.number(),
  step: z.number().optional()
}).optional();

/**
 * Question option for choice-based questions
 */
const QuestionOptionSchema = z.object({
  value: z.string(),
  label: z.string(),
  description: z.string().optional()
});

/**
 * Conditional logic for dynamic questionnaires
 */
const ConditionalLogicSchema = z.object({
  dependsOn: z.string(),
  operator: z.enum(['equals', 'notEquals', 'contains', 'greaterThan', 'lessThan']),
  value: z.any(),
  action: z.enum(['show', 'hide', 'require'])
});

/**
 * Base Question Schema
 * Common fields for all question types
 */
const BaseQuestionSchema = z.object({
  id: z.string(),
  type: z.nativeEnum(QuestionType),
  text: z.string(),
  description: z.string().optional(),
  required: z.boolean().default(false),
  conditional: ConditionalLogicSchema.optional(),
  metadata: z.record(z.string(), z.any()).optional()
});

/**
 * Text Question Schema
 */
export const TextQuestionSchema = BaseQuestionSchema.extend({
  type: z.literal(QuestionType.TEXT),
  validation: TextValidationSchema
});

/**
 * Email Question Schema
 */
export const EmailQuestionSchema = BaseQuestionSchema.extend({
  type: z.literal(QuestionType.EMAIL),
  validation: TextValidationSchema
});

/**
 * Number Question Schema
 */
export const NumberQuestionSchema = BaseQuestionSchema.extend({
  type: z.literal(QuestionType.NUMBER),
  validation: NumberValidationSchema
});

/**
 * Single Choice Question Schema
 */
export const SingleChoiceQuestionSchema = BaseQuestionSchema.extend({
  type: z.literal(QuestionType.SINGLE_CHOICE),
  options: z.array(QuestionOptionSchema).min(1),
  validation: z.object({
    allowOther: z.boolean().optional()
  }).optional()
});

/**
 * Multiple Choice Question Schema
 */
export const MultipleChoiceQuestionSchema = BaseQuestionSchema.extend({
  type: z.literal(QuestionType.MULTIPLE_CHOICE),
  options: z.array(QuestionOptionSchema).min(1),
  validation: z.object({
    minSelections: z.number().optional(),
    maxSelections: z.number().optional(),
    allowOther: z.boolean().optional()
  }).optional()
});

/**
 * Boolean Question Schema
 */
export const BooleanQuestionSchema = BaseQuestionSchema.extend({
  type: z.literal(QuestionType.BOOLEAN),
  validation: z.object({}).optional()
});

/**
 * Date Question Schema
 */
export const DateQuestionSchema = BaseQuestionSchema.extend({
  type: z.literal(QuestionType.DATE),
  validation: DateValidationSchema
});

/**
 * Rating Question Schema
 */
export const RatingQuestionSchema = BaseQuestionSchema.extend({
  type: z.literal(QuestionType.RATING),
  validation: RatingValidationSchema
});

/**
 * Discriminated Union of all Question Types
 */
export const QuestionSchema = z.discriminatedUnion('type', [
  TextQuestionSchema,
  EmailQuestionSchema,
  NumberQuestionSchema,
  SingleChoiceQuestionSchema,
  MultipleChoiceQuestionSchema,
  BooleanQuestionSchema,
  DateQuestionSchema,
  RatingQuestionSchema
]);

/**
 * TypeScript types derived from schemas
 */
export type Question = z.infer<typeof QuestionSchema>;
export type TextQuestion = z.infer<typeof TextQuestionSchema>;
export type EmailQuestion = z.infer<typeof EmailQuestionSchema>;
export type NumberQuestion = z.infer<typeof NumberQuestionSchema>;
export type SingleChoiceQuestion = z.infer<typeof SingleChoiceQuestionSchema>;
export type MultipleChoiceQuestion = z.infer<typeof MultipleChoiceQuestionSchema>;
export type BooleanQuestion = z.infer<typeof BooleanQuestionSchema>;
export type DateQuestion = z.infer<typeof DateQuestionSchema>;
export type RatingQuestion = z.infer<typeof RatingQuestionSchema>;
export type QuestionOption = z.infer<typeof QuestionOptionSchema>;
export type ConditionalLogic = z.infer<typeof ConditionalLogicSchema>;
