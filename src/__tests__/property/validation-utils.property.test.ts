import { describe, it, expect } from '@jest/globals';
import fc from 'fast-check';
import {
  isValidEmail,
  isValidDate,
  isInRange,
  matchesPattern,
  validateLength,
  formatZodError
} from '../../core/schemas/validation.js';
import { z } from 'zod';

describe('Property-Based Tests: Validation Utilities', () => {
  describe('isValidEmail', () => {
    /**
     * Discovered edge case: Zod's email validator is stricter than RFC 5321.
     * fc.emailAddress() generates RFC-compliant addresses like "!@a.aa" that
     * Zod rejects. Zod also rejects local parts ending with a dot (e.g. "a.@b.com").
     * We constrain the arbitrary to simple alphanumeric local parts.
     */
    it('should accept well-formed emails with alphanumeric local parts', () => {
      const safeEmail = fc.tuple(
        fc.stringMatching(/^[a-z][a-z0-9]{0,19}$/),
        fc.stringMatching(/^[a-z][a-z0-9]{0,9}\.[a-z]{2,4}$/)
      ).map(([local, domain]) => `${local}@${domain}`);
      fc.assert(
        fc.property(
          safeEmail,
          (email) => {
            expect(isValidEmail(email)).toBe(true);
          }
        )
      );
    });

    it('should reject strings without @ symbol', () => {
      fc.assert(
        fc.property(
          fc.string().filter(s => !s.includes('@')),
          (notEmail) => {
            expect(isValidEmail(notEmail)).toBe(false);
          }
        )
      );
    });

    it('should always return a boolean', () => {
      fc.assert(
        fc.property(
          fc.string(),
          (s) => {
            const result = isValidEmail(s);
            expect(typeof result).toBe('boolean');
          }
        )
      );
    });
  });

  describe('isValidDate', () => {
    it('should accept valid ISO datetime strings', () => {
      fc.assert(
        fc.property(
          fc.date({ min: new Date('2000-01-01'), max: new Date('2099-12-31'), noInvalidDate: true }),
          (date) => {
            expect(isValidDate(date.toISOString())).toBe(true);
          }
        )
      );
    });

    it('should reject arbitrary non-date strings', () => {
      fc.assert(
        fc.property(
          fc.string().filter(s => !/^\d{4}-\d{2}-\d{2}/.test(s)),
          (notDate) => {
            expect(isValidDate(notDate)).toBe(false);
          }
        )
      );
    });

    it('should always return a boolean', () => {
      fc.assert(
        fc.property(
          fc.string(),
          (s) => {
            expect(typeof isValidDate(s)).toBe('boolean');
          }
        )
      );
    });
  });

  describe('isInRange', () => {
    it('should return true when value is within [min, max]', () => {
      fc.assert(
        fc.property(
          fc.double({ min: -1e6, max: 1e6, noNaN: true }),
          fc.double({ min: -1e6, max: 1e6, noNaN: true }),
          fc.double({ min: -1e6, max: 1e6, noNaN: true }),
          (a, b, c) => {
            const sorted = [a, b, c].sort((x, y) => x - y) as [number, number, number];
            const [min, value, max] = sorted;
            expect(isInRange(value, min, max)).toBe(true);
          }
        )
      );
    });

    it('should return false when value < min', () => {
      fc.assert(
        fc.property(
          fc.double({ min: -1e6, max: 1e6, noNaN: true }),
          fc.double({ min: 0.001, max: 1e6, noNaN: true }),
          (min, offset) => {
            const value = min - offset;
            expect(isInRange(value, min)).toBe(false);
          }
        )
      );
    });

    it('should return false when value > max', () => {
      fc.assert(
        fc.property(
          fc.double({ min: -1e6, max: 1e6, noNaN: true }),
          fc.double({ min: 0.001, max: 1e6, noNaN: true }),
          (max, offset) => {
            const value = max + offset;
            expect(isInRange(value, undefined, max)).toBe(false);
          }
        )
      );
    });

    it('should return true when no bounds are specified', () => {
      fc.assert(
        fc.property(
          fc.double({ noNaN: true }),
          (value) => {
            expect(isInRange(value)).toBe(true);
          }
        )
      );
    });

    it('boundary: value equal to min should be in range', () => {
      fc.assert(
        fc.property(
          fc.double({ min: -1e6, max: 1e6, noNaN: true }),
          (boundary) => {
            expect(isInRange(boundary, boundary)).toBe(true);
          }
        )
      );
    });

    it('boundary: value equal to max should be in range', () => {
      fc.assert(
        fc.property(
          fc.double({ min: -1e6, max: 1e6, noNaN: true }),
          (boundary) => {
            expect(isInRange(boundary, undefined, boundary)).toBe(true);
          }
        )
      );
    });
  });

  describe('matchesPattern', () => {
    it('should match strings that satisfy the pattern', () => {
      fc.assert(
        fc.property(
          fc.stringMatching(/^[a-z]+$/),
          (s) => {
            expect(matchesPattern(s, '^[a-z]+$')).toBe(true);
          }
        )
      );
    });

    it('should return false for invalid regex patterns', () => {
      // Invalid regex should not throw, just return false
      expect(matchesPattern('test', '[invalid')).toBe(false);
    });

    it('should always return a boolean', () => {
      fc.assert(
        fc.property(
          fc.string(),
          fc.string(),
          (value, pattern) => {
            expect(typeof matchesPattern(value, pattern)).toBe('boolean');
          }
        )
      );
    });
  });

  describe('validateLength', () => {
    it('should return valid for strings within length bounds', () => {
      fc.assert(
        fc.property(
          fc.integer({ min: 0, max: 50 }),
          fc.integer({ min: 0, max: 50 }),
          (a, b) => {
            const minLen = Math.min(a, b);
            const maxLen = Math.max(a, b);
            // Generate a string of length exactly between minLen and maxLen
            const str = 'x'.repeat(minLen + Math.floor((maxLen - minLen) / 2));
            const result = validateLength(str, minLen, maxLen);
            expect(result.valid).toBe(true);
            expect(result.message).toBeUndefined();
          }
        )
      );
    });

    it('should return invalid for strings shorter than minLength', () => {
      fc.assert(
        fc.property(
          fc.integer({ min: 2, max: 100 }),
          (minLen) => {
            const shortStr = 'x'.repeat(minLen - 1);
            const result = validateLength(shortStr, minLen);
            expect(result.valid).toBe(false);
            expect(result.message).toBeDefined();
          }
        )
      );
    });

    it('should return invalid for strings longer than maxLength', () => {
      fc.assert(
        fc.property(
          fc.integer({ min: 0, max: 50 }),
          (maxLen) => {
            const longStr = 'x'.repeat(maxLen + 1);
            const result = validateLength(longStr, undefined, maxLen);
            expect(result.valid).toBe(false);
            expect(result.message).toBeDefined();
          }
        )
      );
    });

    it('should return valid when no constraints are given', () => {
      fc.assert(
        fc.property(
          fc.string(),
          (s) => {
            const result = validateLength(s);
            expect(result.valid).toBe(true);
          }
        )
      );
    });
  });

  describe('formatZodError', () => {
    it('should always return valid: false with error messages', () => {
      fc.assert(
        fc.property(
          fc.string({ minLength: 1 }),
          (fieldName) => {
            // Create a schema that will fail and produce a ZodError
            const schema = z.object({ [fieldName]: z.number() });
            const result = schema.safeParse({ [fieldName]: 'not-a-number' });
            if (!result.success) {
              const formatted = formatZodError(result.error);
              expect(formatted.valid).toBe(false);
              expect(formatted.message).toBe('Validation failed');
              expect(formatted.errors).toBeDefined();
              expect(formatted.errors!.length).toBeGreaterThan(0);
            }
          }
        )
      );
    });

    it('should include path information in error messages', () => {
      fc.assert(
        fc.property(
          fc.string({ minLength: 1 }).filter(s => /^[a-zA-Z_][a-zA-Z0-9_]*$/.test(s)),
          (fieldName) => {
            const schema = z.object({ [fieldName]: z.number() });
            const result = schema.safeParse({ [fieldName]: 'invalid' });
            if (!result.success) {
              const formatted = formatZodError(result.error);
              // At least one error should mention the field name
              const hasFieldInError = formatted.errors!.some(e => e.includes(fieldName));
              expect(hasFieldInError).toBe(true);
            }
          }
        )
      );
    });
  });
});
