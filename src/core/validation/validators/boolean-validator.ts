import { BaseValidator } from './base-validator.js';
import type { ValidationResult, BooleanValidationRules } from '../types.js';

/**
 * Validator for boolean inputs
 */
export class BooleanValidator extends BaseValidator<boolean, BooleanValidationRules> {
  validate(value: boolean, rules: BooleanValidationRules): ValidationResult {
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
    if (typeof value !== 'boolean') {
      errors.push(this.createError(
        'INVALID_BOOLEAN',
        'Please enter a valid boolean value'
      ));
      return this.createFailure(errors, warnings);
    }

    // Must be true validation (for consent forms, etc.)
    if (rules.mustBeTrue && value !== true) {
      errors.push(this.createError(
        'MUST_BE_TRUE',
        'This field must be accepted'
      ));
    }

    return errors.length === 0
      ? this.createSuccess(warnings)
      : this.createFailure(errors, warnings);
  }
}
