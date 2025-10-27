import { describe, it, expect } from '@jest/globals';
import {
  TextValidationSchema,
  NumberValidationSchema,
  DateValidationSchema,
  RatingValidationSchema
} from '../../core/schemas/question.js';
import { ValidationTestHelpers } from '../helpers/validation-helpers.js';

describe('Validation Rules', () => {
  describe('Text Validation Rules', () => {
    describe('Valid Cases', () => {
      it('should accept text validation with minLength', () => {
        const validation = { minLength: 5 };
        ValidationTestHelpers.expectValidationSuccess(TextValidationSchema, validation);
      });

      it('should accept text validation with maxLength', () => {
        const validation = { maxLength: 100 };
        ValidationTestHelpers.expectValidationSuccess(TextValidationSchema, validation);
      });

      it('should accept text validation with min and max length', () => {
        const validation = { minLength: 5, maxLength: 100 };
        ValidationTestHelpers.expectValidationSuccess(TextValidationSchema, validation);
      });

      it('should accept text validation with pattern', () => {
        const validation = { pattern: '^[A-Za-z]+$' };
        ValidationTestHelpers.expectValidationSuccess(TextValidationSchema, validation);
      });

      it('should accept text validation with pattern and message', () => {
        const validation = {
          pattern: '^[A-Za-z]+$',
          patternMessage: 'Only letters allowed'
        };
        ValidationTestHelpers.expectValidationSuccess(TextValidationSchema, validation);
      });

      it('should accept empty text validation', () => {
        const validation = {};
        ValidationTestHelpers.expectValidationSuccess(TextValidationSchema, validation);
      });

      it('should accept undefined text validation', () => {
        ValidationTestHelpers.expectValidationSuccess(TextValidationSchema, undefined);
      });
    });

    describe('Invalid Cases', () => {
      it('should reject text validation with invalid minLength type', () => {
        const validation = { minLength: '5' as any };
        ValidationTestHelpers.expectValidationError(TextValidationSchema, validation);
      });

      it('should reject text validation with invalid maxLength type', () => {
        const validation = { maxLength: '100' as any };
        ValidationTestHelpers.expectValidationError(TextValidationSchema, validation);
      });

      it('should reject text validation with invalid pattern type', () => {
        const validation = { pattern: 123 as any };
        ValidationTestHelpers.expectValidationError(TextValidationSchema, validation);
      });
    });
  });

  describe('Number Validation Rules', () => {
    describe('Valid Cases', () => {
      it('should accept number validation with min', () => {
        const validation = { min: 0 };
        ValidationTestHelpers.expectValidationSuccess(NumberValidationSchema, validation);
      });

      it('should accept number validation with max', () => {
        const validation = { max: 100 };
        ValidationTestHelpers.expectValidationSuccess(NumberValidationSchema, validation);
      });

      it('should accept number validation with min and max', () => {
        const validation = { min: 0, max: 100 };
        ValidationTestHelpers.expectValidationSuccess(NumberValidationSchema, validation);
      });

      it('should accept number validation with integer flag', () => {
        const validation = { integer: true };
        ValidationTestHelpers.expectValidationSuccess(NumberValidationSchema, validation);
      });

      it('should accept number validation with all fields', () => {
        const validation = { min: 0, max: 100, integer: true };
        ValidationTestHelpers.expectValidationSuccess(NumberValidationSchema, validation);
      });

      it('should accept negative min and max values', () => {
        const validation = { min: -100, max: -10 };
        ValidationTestHelpers.expectValidationSuccess(NumberValidationSchema, validation);
      });

      it('should accept decimal min and max values', () => {
        const validation = { min: 0.5, max: 99.9 };
        ValidationTestHelpers.expectValidationSuccess(NumberValidationSchema, validation);
      });

      it('should accept empty number validation', () => {
        const validation = {};
        ValidationTestHelpers.expectValidationSuccess(NumberValidationSchema, validation);
      });

      it('should accept undefined number validation', () => {
        ValidationTestHelpers.expectValidationSuccess(NumberValidationSchema, undefined);
      });
    });

    describe('Invalid Cases', () => {
      it('should reject number validation with invalid min type', () => {
        const validation = { min: '0' as any };
        ValidationTestHelpers.expectValidationError(NumberValidationSchema, validation);
      });

      it('should reject number validation with invalid max type', () => {
        const validation = { max: '100' as any };
        ValidationTestHelpers.expectValidationError(NumberValidationSchema, validation);
      });

      it('should reject number validation with invalid integer type', () => {
        const validation = { integer: 'true' as any };
        ValidationTestHelpers.expectValidationError(NumberValidationSchema, validation);
      });
    });
  });

  describe('Date Validation Rules', () => {
    describe('Valid Cases', () => {
      it('should accept date validation with minDate', () => {
        const validation = { minDate: '2000-01-01' };
        ValidationTestHelpers.expectValidationSuccess(DateValidationSchema, validation);
      });

      it('should accept date validation with maxDate', () => {
        const validation = { maxDate: '2025-12-31' };
        ValidationTestHelpers.expectValidationSuccess(DateValidationSchema, validation);
      });

      it('should accept date validation with min and max dates', () => {
        const validation = { minDate: '2000-01-01', maxDate: '2025-12-31' };
        ValidationTestHelpers.expectValidationSuccess(DateValidationSchema, validation);
      });

      it('should accept date validation with allowPast', () => {
        const validation = { allowPast: true };
        ValidationTestHelpers.expectValidationSuccess(DateValidationSchema, validation);
      });

      it('should accept date validation with allowFuture', () => {
        const validation = { allowFuture: false };
        ValidationTestHelpers.expectValidationSuccess(DateValidationSchema, validation);
      });

      it('should accept date validation with all fields', () => {
        const validation = {
          minDate: '2000-01-01',
          maxDate: '2025-12-31',
          allowPast: true,
          allowFuture: false
        };
        ValidationTestHelpers.expectValidationSuccess(DateValidationSchema, validation);
      });

      it('should accept empty date validation', () => {
        const validation = {};
        ValidationTestHelpers.expectValidationSuccess(DateValidationSchema, validation);
      });

      it('should accept undefined date validation', () => {
        ValidationTestHelpers.expectValidationSuccess(DateValidationSchema, undefined);
      });
    });

    describe('Invalid Cases', () => {
      it('should reject date validation with invalid minDate type', () => {
        const validation = { minDate: 123 as any };
        ValidationTestHelpers.expectValidationError(DateValidationSchema, validation);
      });

      it('should reject date validation with invalid maxDate type', () => {
        const validation = { maxDate: 123 as any };
        ValidationTestHelpers.expectValidationError(DateValidationSchema, validation);
      });

      it('should reject date validation with invalid allowPast type', () => {
        const validation = { allowPast: 'true' as any };
        ValidationTestHelpers.expectValidationError(DateValidationSchema, validation);
      });

      it('should reject date validation with invalid allowFuture type', () => {
        const validation = { allowFuture: 'false' as any };
        ValidationTestHelpers.expectValidationError(DateValidationSchema, validation);
      });
    });
  });

  describe('Rating Validation Rules', () => {
    describe('Valid Cases', () => {
      it('should accept rating validation with min and max', () => {
        const validation = { min: 1, max: 5 };
        ValidationTestHelpers.expectValidationSuccess(RatingValidationSchema, validation);
      });

      it('should accept rating validation with step', () => {
        const validation = { min: 0, max: 10, step: 0.5 };
        ValidationTestHelpers.expectValidationSuccess(RatingValidationSchema, validation);
      });

      it('should accept various rating scales', () => {
        const scales = [
          { min: 1, max: 5 },
          { min: 0, max: 10 },
          { min: 1, max: 10 },
          { min: 0, max: 100 }
        ];

        scales.forEach((validation) => {
          ValidationTestHelpers.expectValidationSuccess(RatingValidationSchema, validation);
        });
      });

      it('should accept negative rating scales', () => {
        const validation = { min: -5, max: 5 };
        ValidationTestHelpers.expectValidationSuccess(RatingValidationSchema, validation);
      });

      it('should accept decimal step values', () => {
        const validation = { min: 0, max: 5, step: 0.1 };
        ValidationTestHelpers.expectValidationSuccess(RatingValidationSchema, validation);
      });
    });

    describe('Invalid Cases', () => {
      it('should reject rating validation without min', () => {
        const validation = { max: 5 };
        ValidationTestHelpers.expectValidationError(RatingValidationSchema, validation);
      });

      it('should reject rating validation without max', () => {
        const validation = { min: 1 };
        ValidationTestHelpers.expectValidationError(RatingValidationSchema, validation);
      });

      it('should reject rating validation with invalid min type', () => {
        const validation = { min: '1' as any, max: 5 };
        ValidationTestHelpers.expectValidationError(RatingValidationSchema, validation);
      });

      it('should reject rating validation with invalid max type', () => {
        const validation = { min: 1, max: '5' as any };
        ValidationTestHelpers.expectValidationError(RatingValidationSchema, validation);
      });

      it('should reject rating validation with invalid step type', () => {
        const validation = { min: 1, max: 5, step: '0.5' as any };
        ValidationTestHelpers.expectValidationError(RatingValidationSchema, validation);
      });

      it('should accept undefined rating validation', () => {
        // Note: RatingValidationSchema is optional, so undefined is valid
        ValidationTestHelpers.expectValidationSuccess(RatingValidationSchema, undefined);
      });
    });
  });

  describe('Validation Rule Combinations', () => {
    it('should handle complex text validation rules', () => {
      const validation = {
        minLength: 10,
        maxLength: 1000,
        pattern: '^[A-Za-z0-9\\s]+$',
        patternMessage: 'Only alphanumeric characters and spaces allowed'
      };
      ValidationTestHelpers.expectValidationSuccess(TextValidationSchema, validation);
    });

    it('should handle complex number validation rules', () => {
      const validation = {
        min: 18,
        max: 99,
        integer: true
      };
      ValidationTestHelpers.expectValidationSuccess(NumberValidationSchema, validation);
    });

    it('should handle complex date validation rules', () => {
      const validation = {
        minDate: '1900-01-01',
        maxDate: '2025-12-31',
        allowPast: true,
        allowFuture: false
      };
      ValidationTestHelpers.expectValidationSuccess(DateValidationSchema, validation);
    });

    it('should handle edge case rating validation', () => {
      const validation = {
        min: 0,
        max: 1,
        step: 0.01
      };
      ValidationTestHelpers.expectValidationSuccess(RatingValidationSchema, validation);
    });
  });
});
