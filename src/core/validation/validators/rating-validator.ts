import { BaseValidator } from './base-validator.js';
import type { ValidationResult, RatingValidationRules } from '../types.js';

/**
 * Validator for rating inputs
 */
export class RatingValidator extends BaseValidator<number, RatingValidationRules> {
  validate(value: number, rules: RatingValidationRules): ValidationResult {
    const errors: import('../types.js').ValidationError[] = [];
    const warnings: import('../types.js').ValidationWarning[] = [];

    // Required validation
    if (rules.required && (value === null || value === undefined)) {
      errors.push(this.createError(
        'REQUIRED_FIELD',
        'This field is required'
      ));
      return this.createFailure(errors, warnings);
    }

    // Skip further validation if value is not provided and not required
    if (value === null || value === undefined) {
      return this.createSuccess(warnings);
    }

    // Type validation
    if (typeof value !== 'number' || isNaN(value)) {
      errors.push(this.createError(
        'INVALID_RATING',
        'Please enter a valid rating'
      ));
      return this.createFailure(errors, warnings);
    }

    // Must be integer
    if (!Number.isInteger(value)) {
      errors.push(this.createError(
        'MUST_BE_INTEGER',
        'Rating must be a whole number'
      ));
    }

    // Range validation
    const min = rules.min ?? 1;
    const max = rules.max ?? 5;

    if (value < min) {
      errors.push(this.createError(
        'BELOW_MINIMUM',
        `Rating must be at least ${min}`
      ));
    }

    if (value > max) {
      errors.push(this.createError(
        'ABOVE_MAXIMUM',
        `Rating must be no more than ${max}`
      ));
    }

    return errors.length === 0
      ? this.createSuccess(warnings)
      : this.createFailure(errors, warnings);
  }
}
