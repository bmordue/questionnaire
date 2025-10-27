import { z } from 'zod';

/**
 * Validation Utilities
 * 
 * Provides helper functions for common validation operations
 */

/**
 * Validates an email address
 */
export function isValidEmail(email: string): boolean {
  const emailSchema = z.string().email();
  return emailSchema.safeParse(email).success;
}

/**
 * Validates a date string in ISO format
 */
export function isValidDate(dateString: string): boolean {
  const dateSchema = z.string().datetime();
  return dateSchema.safeParse(dateString).success;
}

/**
 * Validates that a value is within a numeric range
 */
export function isInRange(value: number, min?: number, max?: number): boolean {
  if (min !== undefined && value < min) return false;
  if (max !== undefined && value > max) return false;
  return true;
}

/**
 * Validates a string against a pattern
 */
export function matchesPattern(value: string, pattern: string): boolean {
  try {
    const regex = new RegExp(pattern);
    return regex.test(value);
  } catch {
    return false;
  }
}

/**
 * Validates string length constraints
 */
export function validateLength(
  value: string,
  minLength?: number,
  maxLength?: number
): { valid: boolean; message?: string } {
  if (minLength !== undefined && value.length < minLength) {
    return {
      valid: false,
      message: `Minimum length is ${minLength} characters`
    };
  }
  
  if (maxLength !== undefined && value.length > maxLength) {
    return {
      valid: false,
      message: `Maximum length is ${maxLength} characters`
    };
  }
  
  return { valid: true };
}

/**
 * Generic validation result type
 */
export interface ValidationResult {
  valid: boolean;
  message?: string;
  errors?: string[];
}

/**
 * Formats Zod errors into a readable format
 */
export function formatZodError(error: z.ZodError): ValidationResult {
  const errors = error.issues.map(issue => {
    const path = issue.path.join('.');
    return path ? `${path}: ${issue.message}` : issue.message;
  });
  
  return {
    valid: false,
    message: 'Validation failed',
    errors
  };
}
