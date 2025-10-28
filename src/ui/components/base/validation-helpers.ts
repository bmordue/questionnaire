import type { ValidationResult } from './types.js';

/**
 * Validation helper utilities for components
 */
export class ValidationHelpers {
  /**
   * Validate email format
   */
  static validateEmail(email: string): ValidationResult {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      return { isValid: false, message: 'Please enter a valid email address' };
    }
    return { isValid: true };
  }

  /**
   * Validate date format (YYYY-MM-DD)
   */
  static validateDateFormat(dateString: string): ValidationResult {
    const dateRegex = /^\d{4}-\d{2}-\d{2}$/;
    if (!dateRegex.test(dateString)) {
      return { isValid: false, message: 'Please enter date in YYYY-MM-DD format' };
    }

    const date = new Date(dateString);
    if (isNaN(date.getTime())) {
      return { isValid: false, message: 'Please enter a valid date' };
    }

    return { isValid: true };
  }

  /**
   * Validate string length
   */
  static validateLength(
    value: string,
    minLength?: number,
    maxLength?: number
  ): ValidationResult {
    if (minLength !== undefined && value.length < minLength) {
      return {
        isValid: false,
        message: `Minimum length is ${minLength} characters`
      };
    }

    if (maxLength !== undefined && value.length > maxLength) {
      return {
        isValid: false,
        message: `Maximum length is ${maxLength} characters`
      };
    }

    return { isValid: true };
  }

  /**
   * Validate pattern match
   */
  static validatePattern(
    value: string,
    pattern: string,
    message?: string
  ): ValidationResult {
    const regex = new RegExp(pattern);
    if (!regex.test(value)) {
      return {
        isValid: false,
        message: message || 'Invalid format'
      };
    }
    return { isValid: true };
  }

  /**
   * Validate number range
   */
  static validateRange(
    value: number,
    min?: number,
    max?: number
  ): ValidationResult {
    if (min !== undefined && value < min) {
      return {
        isValid: false,
        message: `Minimum value is ${min}`
      };
    }

    if (max !== undefined && value > max) {
      return {
        isValid: false,
        message: `Maximum value is ${max}`
      };
    }

    return { isValid: true };
  }

  /**
   * Validate integer
   */
  static validateInteger(value: number): ValidationResult {
    if (!Number.isInteger(value)) {
      return {
        isValid: false,
        message: 'Please enter a whole number'
      };
    }
    return { isValid: true };
  }

  /**
   * Validate date range
   */
  static validateDateRange(
    date: Date,
    minDate?: string | Date,
    maxDate?: string | Date
  ): ValidationResult {
    if (minDate) {
      const min = typeof minDate === 'string' ? new Date(minDate) : minDate;
      if (date < min) {
        return {
          isValid: false,
          message: `Date must be after ${min.toISOString().split('T')[0]}`
        };
      }
    }

    if (maxDate) {
      const max = typeof maxDate === 'string' ? new Date(maxDate) : maxDate;
      if (date > max) {
        return {
          isValid: false,
          message: `Date must be before ${max.toISOString().split('T')[0]}`
        };
      }
    }

    return { isValid: true };
  }

  /**
   * Combine multiple validation results
   */
  static combineValidationResults(...results: ValidationResult[]): ValidationResult {
    for (const result of results) {
      if (!result.isValid) {
        return result;
      }
    }
    return { isValid: true };
  }
}
