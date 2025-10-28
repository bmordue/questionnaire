import { BaseValidator } from './base-validator.js';
import type { ValidationResult, NumberValidationRules } from '../types.js';

/**
 * Validator for number inputs
 */
export class NumberValidator extends BaseValidator<number, NumberValidationRules> {
  validate(value: number, rules: NumberValidationRules): ValidationResult {
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
        'INVALID_NUMBER',
        'Please enter a valid number'
      ));
      return this.createFailure(errors, warnings);
    }

    // Integer validation
    if (rules.integer && !Number.isInteger(value)) {
      errors.push(this.createError(
        'MUST_BE_INTEGER',
        'Please enter a whole number'
      ));
    }

    // Range validation
    if (rules.min !== undefined && value < rules.min) {
      errors.push(this.createError(
        'BELOW_MINIMUM',
        `Value must be at least ${rules.min}`
      ));
    }

    if (rules.max !== undefined && value > rules.max) {
      errors.push(this.createError(
        'ABOVE_MAXIMUM',
        `Value must be no more than ${rules.max}`
      ));
    }

    // Precision validation
    if (rules.precision !== undefined) {
      const decimalPlaces = this.getDecimalPlaces(value);
      if (decimalPlaces > rules.precision) {
        errors.push(this.createError(
          'TOO_MANY_DECIMALS',
          `Maximum ${rules.precision} decimal places allowed`
        ));
      }
    }

    // Range warnings
    if (rules.min !== undefined && rules.max !== undefined) {
      const range = rules.max - rules.min;
      if (value < rules.min + range * 0.1) {
        warnings.push(this.createWarning(
          'NEAR_MINIMUM',
          'Value is near the minimum allowed'
        ));
      }
      if (value > rules.max - range * 0.1) {
        warnings.push(this.createWarning(
          'NEAR_MAXIMUM',
          'Value is near the maximum allowed'
        ));
      }
    }

    return errors.length === 0
      ? this.createSuccess(warnings)
      : this.createFailure(errors, warnings);
  }

  /**
   * Get the number of decimal places in a number
   */
  private getDecimalPlaces(value: number): number {
    const str = value.toString();
    const decimalIndex = str.indexOf('.');
    return decimalIndex === -1 ? 0 : str.length - decimalIndex - 1;
  }
}
