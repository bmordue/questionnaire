// Re-export all schemas
export * from './schemas/question.js';
export * from './schemas/questionnaire.js';
/**
 * Core Schema Module
 * 
 * This module provides comprehensive TypeScript schemas using Zod for:
 * - Questionnaire definitions
 * - Question types and validation
 * - Response tracking and storage
 * 
 * All schemas provide runtime validation and compile-time type safety.
 */

// Export all question-related schemas and types
export {
  QuestionType,
  QuestionSchema,
  TextQuestionSchema,
  EmailQuestionSchema,
  NumberQuestionSchema,
  SingleChoiceQuestionSchema,
  MultipleChoiceQuestionSchema,
  BooleanQuestionSchema,
  DateQuestionSchema,
  RatingQuestionSchema
} from './schemas/question.js';

export type {
  Question,
  TextQuestion,
  EmailQuestion,
  NumberQuestion,
  SingleChoiceQuestion,
  MultipleChoiceQuestion,
  BooleanQuestion,
  DateQuestion,
  RatingQuestion,
  QuestionOption,
  ConditionalLogic
} from './schemas/question.js';

// Export all questionnaire-related schemas and types
export {
  QuestionnaireSchema,
  validateQuestionnaire,
  safeValidateQuestionnaire
} from './schemas/questionnaire.js';

export type {
  Questionnaire,
  QuestionnaireMetadata,
  QuestionnaireConfig
} from './schemas/questionnaire.js';

// Export all response-related schemas and types
export {
  ResponseStatus,
  QuestionnaireResponseSchema,
  validateResponse,
  safeValidateResponse,
  createResponse
} from './schemas/response.js';

export type {
  QuestionnaireResponse,
  Answer,
  ResponseProgress
} from './schemas/response.js';

