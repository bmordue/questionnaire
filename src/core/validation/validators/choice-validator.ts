import { BaseValidator } from './base-validator.js';
import type { ValidationResult, ChoiceValidationRules } from '../types.js';

/**
 * Validator for choice inputs (single and multiple)
 */
export class ChoiceValidator extends BaseValidator<string | string[], ChoiceValidationRules> {
  validate(value: string | string[], rules: ChoiceValidationRules): ValidationResult {
    const errors: import('../types.js').ValidationError[] = [];
    const warnings: import('../types.js').ValidationWarning[] = [];

    // Required validation
    if (rules.required) {
      if (Array.isArray(value) && value.length === 0) {
        errors.push(this.createError(
          'REQUIRED_SELECTION',
          'Please select at least one option'
        ));
        return this.createFailure(errors, warnings);
      } else if (!Array.isArray(value) && (!value || value.trim().length === 0)) {
        errors.push(this.createError(
          'REQUIRED_SELECTION',
          'Please make a selection'
        ));
        return this.createFailure(errors, warnings);
      }
    }

    // Skip further validation if no value
    if (!value || (Array.isArray(value) && value.length === 0)) {
      return this.createSuccess(warnings);
    }

    if (Array.isArray(value)) {
      // Multiple choice validation
      if (rules.minSelections !== undefined && value.length < rules.minSelections) {
        errors.push(this.createError(
          'INSUFFICIENT_SELECTIONS',
          `Please select at least ${rules.minSelections} options`
        ));
      }

      if (rules.maxSelections !== undefined && value.length > rules.maxSelections) {
        errors.push(this.createError(
          'TOO_MANY_SELECTIONS',
          `Please select no more than ${rules.maxSelections} options`
        ));
      }

      // Valid option validation
      if (rules.validOptions) {
        const invalidOptions = value.filter(v => !rules.validOptions!.includes(v));
        if (invalidOptions.length > 0) {
          errors.push(this.createError(
            'INVALID_OPTIONS',
            `Invalid selections: ${invalidOptions.join(', ')}`
          ));
        }
      }

      // Warnings for approaching selection limits
      if (rules.maxSelections !== undefined && value.length > rules.maxSelections * 0.8) {
        warnings.push(this.createWarning(
          'APPROACHING_LIMIT',
          `Approaching selection limit (${value.length}/${rules.maxSelections})`
        ));
      }
    } else {
      // Single choice validation
      if (rules.validOptions && !rules.validOptions.includes(value)) {
        errors.push(this.createError(
          'INVALID_OPTION',
          'Please select a valid option'
        ));
      }
    }

    return errors.length === 0
      ? this.createSuccess(warnings)
      : this.createFailure(errors, warnings);
  }
}
