import type { ValidationResult, ValidationError, ValidationWarning } from '../types.js';

/**
 * Abstract base class for all validators
 */
export abstract class BaseValidator<T, R = any> {
  /**
   * Validate a value against the provided rules
   */
  abstract validate(value: T, rules: R): ValidationResult;

  /**
   * Create a validation error
   */
  protected createError(code: string, message: string, field?: string, context?: any): ValidationError {
    const error: ValidationError = {
      code,
      message,
      severity: 'error'
    };
    if (field !== undefined) error.field = field;
    if (context !== undefined) error.context = context;
    return error;
  }

  /**
   * Create a validation warning
   */
  protected createWarning(code: string, message: string, field?: string, context?: any): ValidationWarning {
    const warning: ValidationWarning = {
      code,
      message,
      severity: 'warning'
    };
    if (field !== undefined) warning.field = field;
    if (context !== undefined) warning.context = context;
    return warning;
  }

  /**
   * Create a success result
   */
  protected createSuccess(warnings: ValidationWarning[] = []): ValidationResult {
    return {
      isValid: true,
      errors: [],
      warnings
    };
  }

  /**
   * Create a failure result
   */
  protected createFailure(errors: ValidationError[], warnings: ValidationWarning[] = []): ValidationResult {
    return {
      isValid: false,
      errors,
      warnings
    };
  }
}
