import { BaseValidator } from './base-validator.js';
import type { ValidationResult, TextValidationRules } from '../types.js';

/**
 * Validator for text inputs
 */
export class TextValidator extends BaseValidator<string, TextValidationRules> {
  validate(value: string, rules: TextValidationRules): ValidationResult {
    const errors: import('../types.js').ValidationError[] = [];
    const warnings: import('../types.js').ValidationWarning[] = [];

    // Required validation
    if (rules.required && (!value || value.trim().length === 0)) {
      errors.push(this.createError(
        'REQUIRED_FIELD',
        'This field is required'
      ));
      return this.createFailure(errors, warnings);
    }

    // Skip further validation if value is empty and not required
    if (!value || value.trim().length === 0) {
      return this.createSuccess(warnings);
    }

    // Length validation
    if (rules.minLength !== undefined && value.length < rules.minLength) {
      errors.push(this.createError(
        'MIN_LENGTH',
        `Minimum length is ${rules.minLength} characters (current: ${value.length})`
      ));
    }

    if (rules.maxLength !== undefined && value.length > rules.maxLength) {
      errors.push(this.createError(
        'MAX_LENGTH',
        `Maximum length is ${rules.maxLength} characters (current: ${value.length})`
      ));
    }

    // Pattern validation
    if (rules.pattern) {
      const regex = new RegExp(rules.pattern);
      if (!regex.test(value)) {
        errors.push(this.createError(
          'INVALID_PATTERN',
          rules.patternMessage || 'Invalid format'
        ));
      }
    }

    // Custom validation
    if (rules.customValidator) {
      const customResult = rules.customValidator(value);
      if (!customResult.isValid) {
        errors.push(this.createError(
          'CUSTOM_VALIDATION',
          customResult.message
        ));
      }
    }

    // Warnings for approaching limits
    if (rules.maxLength !== undefined && value.length > rules.maxLength * 0.9) {
      warnings.push(this.createWarning(
        'APPROACHING_LIMIT',
        `Approaching character limit (${value.length}/${rules.maxLength})`
      ));
    }

    return errors.length === 0 
      ? this.createSuccess(warnings)
      : this.createFailure(errors, warnings);
  }
}
