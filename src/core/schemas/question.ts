import { z } from 'zod';

// Question type enum
export const QuestionType = z.enum([
  'text',
  'number',
  'email',
  'single_choice',
  'multiple_choice',
  'boolean',
  'date',
  'rating'
]);

export type QuestionType = z.infer<typeof QuestionType>;

// Conditional logic schema
export const ConditionalSchema = z.object({
  showIf: z.object({
    questionId: z.string(),
    operator: z.enum(['equals', 'notEquals', 'greaterThan', 'lessThan', 'greaterThanOrEqual', 'lessThanOrEqual', 'contains']),
    value: z.union([z.string(), z.number(), z.boolean()])
  })
});

// Validation rules for different question types
export const TextValidationSchema = z.object({
  minLength: z.number().optional(),
  maxLength: z.number().optional(),
  pattern: z.string().optional()
}).optional();

export const NumberValidationSchema = z.object({
  min: z.number().optional(),
  max: z.number().optional(),
  integer: z.boolean().optional()
}).optional();

export const DateValidationSchema = z.object({
  minDate: z.string().optional(),
  maxDate: z.string().optional()
}).optional();

export const ChoiceValidationSchema = z.object({
  minSelections: z.number().optional(),
  maxSelections: z.number().optional()
}).optional();

// Base question schema
const BaseQuestionSchema = z.object({
  id: z.string(),
  text: z.string(),
  description: z.string().optional(),
  required: z.boolean().default(false),
  conditional: ConditionalSchema.optional()
});

// Question schemas by type
export const TextQuestionSchema = BaseQuestionSchema.extend({
  type: z.literal('text'),
  validation: TextValidationSchema
});

export const NumberQuestionSchema = BaseQuestionSchema.extend({
  type: z.literal('number'),
  validation: NumberValidationSchema
});

export const EmailQuestionSchema = BaseQuestionSchema.extend({
  type: z.literal('email'),
  validation: TextValidationSchema
});

export const SingleChoiceQuestionSchema = BaseQuestionSchema.extend({
  type: z.literal('single_choice'),
  options: z.array(z.string()),
  validation: ChoiceValidationSchema
});

export const MultipleChoiceQuestionSchema = BaseQuestionSchema.extend({
  type: z.literal('multiple_choice'),
  options: z.array(z.string()),
  validation: ChoiceValidationSchema
});

export const BooleanQuestionSchema = BaseQuestionSchema.extend({
  type: z.literal('boolean')
});

export const DateQuestionSchema = BaseQuestionSchema.extend({
  type: z.literal('date'),
  validation: DateValidationSchema
});

export const RatingQuestionSchema = BaseQuestionSchema.extend({
  type: z.literal('rating'),
  validation: NumberValidationSchema
});

// Discriminated union of all question types
export const QuestionSchema = z.discriminatedUnion('type', [
  TextQuestionSchema,
  NumberQuestionSchema,
  EmailQuestionSchema,
  SingleChoiceQuestionSchema,
  MultipleChoiceQuestionSchema,
  BooleanQuestionSchema,
  DateQuestionSchema,
  RatingQuestionSchema
]);

export type Question = z.infer<typeof QuestionSchema>;
