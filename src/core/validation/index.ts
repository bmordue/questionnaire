/**
 * Validation module exports
 */

// Types
export type {
  ValidationResult,
  ValidationError,
  ValidationWarning,
  TextValidationRules,
  NumberValidationRules,
  ChoiceValidationRules,
  DateValidationRules,
  EmailValidationRules,
  RatingValidationRules,
  BooleanValidationRules,
  CrossValidationRule,
  DependencyRule,
  ConsistencyRule,
  CompletenessRule
} from './types.js';

// Validators
export { BaseValidator } from './validators/base-validator.js';
export { TextValidator } from './validators/text-validator.js';
export { NumberValidator } from './validators/number-validator.js';
export { ChoiceValidator } from './validators/choice-validator.js';
export { DateValidator } from './validators/date-validator.js';
export { EmailValidator } from './validators/email-validator.js';
export { RatingValidator } from './validators/rating-validator.js';
export { BooleanValidator } from './validators/boolean-validator.js';

// Cross-validation
export { CrossQuestionValidator } from './cross-validation/cross-validator.js';

// Validation manager
export { ValidationManager } from './validation-manager.js';
