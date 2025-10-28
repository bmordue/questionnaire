import { BaseValidator } from './base-validator.js';
import type { ValidationResult, EmailValidationRules } from '../types.js';

/**
 * Validator for email inputs
 */
export class EmailValidator extends BaseValidator<string, EmailValidationRules> {
  validate(value: string, rules: EmailValidationRules): ValidationResult {
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

    // Email format validation
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(value)) {
      errors.push(this.createError(
        'INVALID_EMAIL',
        'Please enter a valid email address'
      ));
      return this.createFailure(errors, warnings);
    }

    // Custom domain validation
    if (rules.customDomains && rules.customDomains.length > 0) {
      const domain = value.split('@')[1];
      if (domain && !rules.customDomains.includes(domain)) {
        errors.push(this.createError(
          'INVALID_DOMAIN',
          `Email must be from one of these domains: ${rules.customDomains.join(', ')}`
        ));
      }
    }

    return errors.length === 0
      ? this.createSuccess(warnings)
      : this.createFailure(errors, warnings);
  }
}
