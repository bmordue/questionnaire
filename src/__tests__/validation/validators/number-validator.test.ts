import { describe, it, expect } from '@jest/globals';
import { NumberValidator } from '../../../core/validation/validators/number-validator.js';

describe('NumberValidator', () => {
  const validator = new NumberValidator();

  describe('required validation', () => {
    it('should fail when required field is null', () => {
      const result = validator.validate(null as any, { required: true });
      expect(result.isValid).toBe(false);
      expect(result.errors[0]?.code).toBe('REQUIRED_FIELD');
    });

    it('should fail when required field is undefined', () => {
      const result = validator.validate(undefined as any, { required: true });
      expect(result.isValid).toBe(false);
      expect(result.errors[0]?.code).toBe('REQUIRED_FIELD');
    });

    it('should pass when required field has value', () => {
      const result = validator.validate(42, { required: true });
      expect(result.isValid).toBe(true);
    });

    it('should pass when optional field is null', () => {
      const result = validator.validate(null as any, { required: false });
      expect(result.isValid).toBe(true);
    });
  });

  describe('type validation', () => {
    it('should fail when value is NaN', () => {
      const result = validator.validate(NaN, {});
      expect(result.isValid).toBe(false);
      expect(result.errors[0]?.code).toBe('INVALID_NUMBER');
    });

    it('should fail when value is not a number', () => {
      const result = validator.validate('123' as any, {});
      expect(result.isValid).toBe(false);
      expect(result.errors[0]?.code).toBe('INVALID_NUMBER');
    });
  });

  describe('integer validation', () => {
    it('should fail when integer required but decimal provided', () => {
      const result = validator.validate(42.5, { integer: true });
      expect(result.isValid).toBe(false);
      expect(result.errors[0]?.code).toBe('MUST_BE_INTEGER');
    });

    it('should pass when integer required and integer provided', () => {
      const result = validator.validate(42, { integer: true });
      expect(result.isValid).toBe(true);
    });
  });

  describe('range validation', () => {
    it('should fail when below minimum', () => {
      const result = validator.validate(5, { min: 10 });
      expect(result.isValid).toBe(false);
      expect(result.errors[0]?.code).toBe('BELOW_MINIMUM');
      expect(result.errors[0]?.message).toContain('at least 10');
    });

    it('should fail when above maximum', () => {
      const result = validator.validate(15, { max: 10 });
      expect(result.isValid).toBe(false);
      expect(result.errors[0]?.code).toBe('ABOVE_MAXIMUM');
      expect(result.errors[0]?.message).toContain('no more than 10');
    });

    it('should pass when within range', () => {
      const result = validator.validate(5, { min: 1, max: 10 });
      expect(result.isValid).toBe(true);
    });

    it('should warn when near minimum', () => {
      const result = validator.validate(11, { min: 10, max: 100 });
      expect(result.isValid).toBe(true);
      expect(result.warnings).toHaveLength(1);
      expect(result.warnings[0]?.code).toBe('NEAR_MINIMUM');
    });

    it('should warn when near maximum', () => {
      const result = validator.validate(99, { min: 10, max: 100 });
      expect(result.isValid).toBe(true);
      expect(result.warnings).toHaveLength(1);
      expect(result.warnings[0]?.code).toBe('NEAR_MAXIMUM');
    });
  });

  describe('precision validation', () => {
    it('should fail when too many decimal places', () => {
      const result = validator.validate(3.14159, { precision: 2 });
      expect(result.isValid).toBe(false);
      expect(result.errors[0]?.code).toBe('TOO_MANY_DECIMALS');
    });

    it('should pass when decimal places within limit', () => {
      const result = validator.validate(3.14, { precision: 2 });
      expect(result.isValid).toBe(true);
    });

    it('should pass for whole numbers regardless of precision', () => {
      const result = validator.validate(42, { precision: 2 });
      expect(result.isValid).toBe(true);
    });
  });

  describe('combined validations', () => {
    it('should return multiple errors', () => {
      const result = validator.validate(0.5, {
        min: 1,
        max: 10,
        integer: true
      });
      expect(result.isValid).toBe(false);
      expect(result.errors.length).toBeGreaterThanOrEqual(2);
    });
  });
});
