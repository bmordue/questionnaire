import { describe, it, expect } from '@jest/globals';
import { ValidationHelpers } from '../../../../ui/components/base/validation-helpers.js';

describe('ValidationHelpers', () => {
  describe('validateEmail', () => {
    it('should validate correct email addresses', () => {
      const result = ValidationHelpers.validateEmail('test@example.com');
      expect(result.isValid).toBe(true);
    });

    it('should reject invalid email addresses', () => {
      const result = ValidationHelpers.validateEmail('invalid-email');
      expect(result.isValid).toBe(false);
      expect(result.message).toBe('Please enter a valid email address');
    });

    it('should reject emails without @', () => {
      const result = ValidationHelpers.validateEmail('testexample.com');
      expect(result.isValid).toBe(false);
    });

    it('should reject emails without domain', () => {
      const result = ValidationHelpers.validateEmail('test@');
      expect(result.isValid).toBe(false);
    });
  });

  describe('validateDateFormat', () => {
    it('should validate correct date format', () => {
      const result = ValidationHelpers.validateDateFormat('2024-01-15');
      expect(result.isValid).toBe(true);
    });

    it('should reject invalid date format', () => {
      const result = ValidationHelpers.validateDateFormat('15-01-2024');
      expect(result.isValid).toBe(false);
      expect(result.message).toBe('Please enter date in YYYY-MM-DD format');
    });

    it('should reject invalid dates', () => {
      const result = ValidationHelpers.validateDateFormat('2024-13-45');
      expect(result.isValid).toBe(false);
      expect(result.message).toBe('Please enter a valid date');
    });
  });

  describe('validateLength', () => {
    it('should validate string within length constraints', () => {
      const result = ValidationHelpers.validateLength('hello', 3, 10);
      expect(result.isValid).toBe(true);
    });

    it('should reject string below minimum length', () => {
      const result = ValidationHelpers.validateLength('hi', 3, 10);
      expect(result.isValid).toBe(false);
      expect(result.message).toBe('Minimum length is 3 characters');
    });

    it('should reject string above maximum length', () => {
      const result = ValidationHelpers.validateLength('hello world!', 3, 10);
      expect(result.isValid).toBe(false);
      expect(result.message).toBe('Maximum length is 10 characters');
    });

    it('should validate with only minimum length', () => {
      const result = ValidationHelpers.validateLength('hello', 3);
      expect(result.isValid).toBe(true);
    });

    it('should validate with only maximum length', () => {
      const result = ValidationHelpers.validateLength('hello', undefined, 10);
      expect(result.isValid).toBe(true);
    });
  });

  describe('validatePattern', () => {
    it('should validate string matching pattern', () => {
      const result = ValidationHelpers.validatePattern('abc123', '^[a-z0-9]+$');
      expect(result.isValid).toBe(true);
    });

    it('should reject string not matching pattern', () => {
      const result = ValidationHelpers.validatePattern('ABC123', '^[a-z0-9]+$');
      expect(result.isValid).toBe(false);
      expect(result.message).toBe('Invalid format');
    });

    it('should use custom message', () => {
      const result = ValidationHelpers.validatePattern('ABC', '^[a-z]+$', 'Only lowercase letters');
      expect(result.isValid).toBe(false);
      expect(result.message).toBe('Only lowercase letters');
    });
  });

  describe('validateRange', () => {
    it('should validate number within range', () => {
      const result = ValidationHelpers.validateRange(5, 1, 10);
      expect(result.isValid).toBe(true);
    });

    it('should reject number below minimum', () => {
      const result = ValidationHelpers.validateRange(0, 1, 10);
      expect(result.isValid).toBe(false);
      expect(result.message).toBe('Minimum value is 1');
    });

    it('should reject number above maximum', () => {
      const result = ValidationHelpers.validateRange(11, 1, 10);
      expect(result.isValid).toBe(false);
      expect(result.message).toBe('Maximum value is 10');
    });

    it('should validate with only minimum', () => {
      const result = ValidationHelpers.validateRange(5, 1);
      expect(result.isValid).toBe(true);
    });

    it('should validate with only maximum', () => {
      const result = ValidationHelpers.validateRange(5, undefined, 10);
      expect(result.isValid).toBe(true);
    });
  });

  describe('validateInteger', () => {
    it('should validate integers', () => {
      const result = ValidationHelpers.validateInteger(5);
      expect(result.isValid).toBe(true);
    });

    it('should reject decimals', () => {
      const result = ValidationHelpers.validateInteger(5.5);
      expect(result.isValid).toBe(false);
      expect(result.message).toBe('Please enter a whole number');
    });
  });

  describe('validateDateRange', () => {
    it('should validate date within range', () => {
      const date = new Date('2024-06-15');
      const result = ValidationHelpers.validateDateRange(
        date,
        '2024-01-01',
        '2024-12-31'
      );
      expect(result.isValid).toBe(true);
    });

    it('should reject date before minimum', () => {
      const date = new Date('2023-12-31');
      const result = ValidationHelpers.validateDateRange(date, '2024-01-01');
      expect(result.isValid).toBe(false);
      expect(result.message).toContain('Date must be after');
    });

    it('should reject date after maximum', () => {
      const date = new Date('2025-01-01');
      const result = ValidationHelpers.validateDateRange(
        date,
        undefined,
        '2024-12-31'
      );
      expect(result.isValid).toBe(false);
      expect(result.message).toContain('Date must be before');
    });

    it('should work with Date objects', () => {
      const date = new Date('2024-06-15');
      const minDate = new Date('2024-01-01');
      const maxDate = new Date('2024-12-31');
      const result = ValidationHelpers.validateDateRange(date, minDate, maxDate);
      expect(result.isValid).toBe(true);
    });
  });

  describe('combineValidationResults', () => {
    it('should return first invalid result', () => {
      const result1 = { isValid: true };
      const result2 = { isValid: false, message: 'Error 1' };
      const result3 = { isValid: false, message: 'Error 2' };
      
      const combined = ValidationHelpers.combineValidationResults(
        result1,
        result2,
        result3
      );
      
      expect(combined.isValid).toBe(false);
      expect(combined.message).toBe('Error 1');
    });

    it('should return valid if all are valid', () => {
      const result1 = { isValid: true };
      const result2 = { isValid: true };
      
      const combined = ValidationHelpers.combineValidationResults(result1, result2);
      
      expect(combined.isValid).toBe(true);
    });
  });
});
