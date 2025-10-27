import { describe, it, expect } from '@jest/globals';
import { DateInputComponent } from '../../../../ui/components/inputs/date-input.js';
import type { DateQuestion } from '../../../../core/schema.js';
import { QuestionType } from '../../../../core/schema.js';

describe('DateInputComponent', () => {
  const component = new DateInputComponent();

  describe('validate', () => {
    it('should validate correct date format', () => {
      const question: DateQuestion = {
        id: 'q1',
        type: QuestionType.DATE,
        text: 'Date of birth',
        required: false
      };

      expect(component.validate('2024-01-15', question).isValid).toBe(true);
    });

    it('should reject invalid date format', () => {
      const question: DateQuestion = {
        id: 'q1',
        type: QuestionType.DATE,
        text: 'Date of birth',
        required: false
      };

      expect(component.validate('15-01-2024', question).isValid).toBe(false);
      expect(component.validate('2024/01/15', question).isValid).toBe(false);
      expect(component.validate('invalid', question).isValid).toBe(false);
    });

    it('should reject invalid dates', () => {
      const question: DateQuestion = {
        id: 'q1',
        type: QuestionType.DATE,
        text: 'Date',
        required: false
      };

      expect(component.validate('2024-13-01', question).isValid).toBe(false);
      expect(component.validate('2024-01-32', question).isValid).toBe(false);
    });

    it('should validate required field', () => {
      const question: DateQuestion = {
        id: 'q1',
        type: QuestionType.DATE,
        text: 'Date',
        required: true
      };

      expect(component.validate('', question).isValid).toBe(false);
      expect(component.validate('2024-01-15', question).isValid).toBe(true);
    });

    it('should allow empty value for non-required field', () => {
      const question: DateQuestion = {
        id: 'q1',
        type: QuestionType.DATE,
        text: 'Date',
        required: false
      };

      expect(component.validate('', question).isValid).toBe(true);
    });

    it('should validate minDate constraint', () => {
      const question: DateQuestion = {
        id: 'q1',
        type: QuestionType.DATE,
        text: 'Date',
        required: false,
        validation: {
          minDate: '2024-01-01'
        }
      };

      expect(component.validate('2023-12-31', question).isValid).toBe(false);
      expect(component.validate('2024-01-01', question).isValid).toBe(true);
      expect(component.validate('2024-06-15', question).isValid).toBe(true);
    });

    it('should validate maxDate constraint', () => {
      const question: DateQuestion = {
        id: 'q1',
        type: QuestionType.DATE,
        text: 'Date',
        required: false,
        validation: {
          maxDate: '2024-12-31'
        }
      };

      expect(component.validate('2024-06-15', question).isValid).toBe(true);
      expect(component.validate('2024-12-31', question).isValid).toBe(true);
      expect(component.validate('2025-01-01', question).isValid).toBe(false);
    });

    it('should validate date range', () => {
      const question: DateQuestion = {
        id: 'q1',
        type: QuestionType.DATE,
        text: 'Date',
        required: false,
        validation: {
          minDate: '2024-01-01',
          maxDate: '2024-12-31'
        }
      };

      expect(component.validate('2023-12-31', question).isValid).toBe(false);
      expect(component.validate('2024-06-15', question).isValid).toBe(true);
      expect(component.validate('2025-01-01', question).isValid).toBe(false);
    });
  });

  describe('format', () => {
    it('should return the date as-is', () => {
      expect(component.format('2024-01-15')).toBe('2024-01-15');
    });
  });

  describe('getPromptConfig', () => {
    it('should return valid prompt configuration', () => {
      const question: DateQuestion = {
        id: 'q1',
        type: QuestionType.DATE,
        text: 'What is the date?',
        required: true
      };

      const config = component.getPromptConfig(question);
      expect(config.type).toBe('input');
      expect(config.name).toBe('answer');
      expect(config.message).toBeDefined();
      expect(config.message).toContain('YYYY-MM-DD');
      expect(config.validate).toBeDefined();
      expect(config.transformer).toBeDefined();
    });
  });
});
