import { describe, it, expect } from '@jest/globals';
import { TextValidator } from '../../../core/validation/validators/text-validator.js';

describe('TextValidator', () => {
  const validator = new TextValidator();

  describe('required validation', () => {
    it('should fail when required field is empty', () => {
      const result = validator.validate('', { required: true });
      expect(result.isValid).toBe(false);
      expect(result.errors).toHaveLength(1);
      expect(result.errors[0]?.code).toBe('REQUIRED_FIELD');
    });

    it('should fail when required field is whitespace only', () => {
      const result = validator.validate('   ', { required: true });
      expect(result.isValid).toBe(false);
      expect(result.errors[0]?.code).toBe('REQUIRED_FIELD');
    });

    it('should pass when required field has value', () => {
      const result = validator.validate('hello', { required: true });
      expect(result.isValid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('should pass when optional field is empty', () => {
      const result = validator.validate('', { required: false });
      expect(result.isValid).toBe(true);
    });
  });

  describe('length validation', () => {
    it('should fail when below minimum length', () => {
      const result = validator.validate('hi', { minLength: 3 });
      expect(result.isValid).toBe(false);
      expect(result.errors[0]?.code).toBe('MIN_LENGTH');
      expect(result.errors[0]?.message).toContain('Minimum length is 3');
    });

    it('should fail when above maximum length', () => {
      const result = validator.validate('hello world!', { maxLength: 10 });
      expect(result.isValid).toBe(false);
      expect(result.errors[0]?.code).toBe('MAX_LENGTH');
      expect(result.errors[0]?.message).toContain('Maximum length is 10');
    });

    it('should pass when length is within range', () => {
      const result = validator.validate('hello', { minLength: 3, maxLength: 10 });
      expect(result.isValid).toBe(true);
    });

    it('should warn when approaching maximum length', () => {
      const result = validator.validate('helloworld', { maxLength: 10 });
      expect(result.isValid).toBe(true);
      expect(result.warnings).toHaveLength(1);
      expect(result.warnings[0]?.code).toBe('APPROACHING_LIMIT');
    });
  });

  describe('pattern validation', () => {
    it('should fail when pattern does not match', () => {
      const result = validator.validate('ABC123', { pattern: '^[a-z]+$' });
      expect(result.isValid).toBe(false);
      expect(result.errors[0]?.code).toBe('INVALID_PATTERN');
    });

    it('should use custom pattern message', () => {
      const result = validator.validate('123', {
        pattern: '^[a-z]+$',
        patternMessage: 'Only lowercase letters allowed'
      });
      expect(result.isValid).toBe(false);
      expect(result.errors[0]?.message).toBe('Only lowercase letters allowed');
    });

    it('should pass when pattern matches', () => {
      const result = validator.validate('abc', { pattern: '^[a-z]+$' });
      expect(result.isValid).toBe(true);
    });
  });

  describe('custom validation', () => {
    it('should fail when custom validator returns invalid', () => {
      const result = validator.validate('test', {
        customValidator: (value) => ({
          isValid: false,
          message: 'Custom error'
        })
      });
      expect(result.isValid).toBe(false);
      expect(result.errors[0]?.code).toBe('CUSTOM_VALIDATION');
      expect(result.errors[0]?.message).toBe('Custom error');
    });

    it('should pass when custom validator returns valid', () => {
      const result = validator.validate('test', {
        customValidator: (value) => ({
          isValid: true,
          message: ''
        })
      });
      expect(result.isValid).toBe(true);
    });
  });

  describe('combined validations', () => {
    it('should return multiple errors', () => {
      const result = validator.validate('AB', {
        minLength: 3,
        pattern: '^[a-z]+$'
      });
      expect(result.isValid).toBe(false);
      expect(result.errors.length).toBeGreaterThanOrEqual(1);
    });
  });
});
