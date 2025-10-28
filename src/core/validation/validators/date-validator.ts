import { BaseValidator } from './base-validator.js';
import type { ValidationResult, DateValidationRules } from '../types.js';

/**
 * Validator for date inputs
 */
export class DateValidator extends BaseValidator<string, DateValidationRules> {
  validate(value: string, rules: DateValidationRules): ValidationResult {
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

    // Format validation
    const dateRegex = /^\d{4}-\d{2}-\d{2}$/;
    if (!dateRegex.test(value)) {
      errors.push(this.createError(
        'INVALID_FORMAT',
        'Please enter date in YYYY-MM-DD format'
      ));
      return this.createFailure(errors, warnings);
    }

    // Parse date
    const date = new Date(value);
    if (isNaN(date.getTime())) {
      errors.push(this.createError(
        'INVALID_DATE',
        'Please enter a valid date'
      ));
      return this.createFailure(errors, warnings);
    }

    // Range validation
    if (rules.minDate) {
      const min = typeof rules.minDate === 'string' ? new Date(rules.minDate) : rules.minDate;
      if (date < min) {
        errors.push(this.createError(
          'DATE_TOO_EARLY',
          `Date must be after ${this.formatDate(min)}`
        ));
      }
    }

    if (rules.maxDate) {
      const max = typeof rules.maxDate === 'string' ? new Date(rules.maxDate) : rules.maxDate;
      if (date > max) {
        errors.push(this.createError(
          'DATE_TOO_LATE',
          `Date must be before ${this.formatDate(max)}`
        ));
      }
    }

    return errors.length === 0
      ? this.createSuccess(warnings)
      : this.createFailure(errors, warnings);
  }

  /**
   * Format date for display
   */
  private formatDate(date: Date): string {
    const isoString = date.toISOString().split('T')[0];
    return isoString;
  }
}
