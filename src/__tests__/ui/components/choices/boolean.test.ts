import { describe, it, expect } from '@jest/globals';
import { BooleanComponent } from '../../../../ui/components/choices/boolean.js';
import type { BooleanQuestion } from '../../../../core/schema.js';
import { QuestionType } from '../../../../core/schema.js';

describe('BooleanComponent', () => {
  const component = new BooleanComponent();

  describe('validate', () => {
    it('should validate true value', () => {
      const question: BooleanQuestion = {
        id: 'q1',
        type: QuestionType.BOOLEAN,
        text: 'Do you agree?',
        required: false
      };

      expect(component.validate(true, question).isValid).toBe(true);
    });

    it('should validate false value', () => {
      const question: BooleanQuestion = {
        id: 'q1',
        type: QuestionType.BOOLEAN,
        text: 'Do you agree?',
        required: false
      };

      expect(component.validate(false, question).isValid).toBe(true);
    });
  });

  describe('format', () => {
    it('should format true as "Yes"', () => {
      expect(component.format(true)).toBe('Yes');
    });

    it('should format false as "No"', () => {
      expect(component.format(false)).toBe('No');
    });
  });

  describe('getPromptConfig', () => {
    it('should return valid prompt configuration', () => {
      const question: BooleanQuestion = {
        id: 'q1',
        type: QuestionType.BOOLEAN,
        text: 'Do you agree to the terms?',
        required: true
      };

      const config = component.getPromptConfig(question);
      expect(config.type).toBe('confirm');
      expect(config.name).toBe('answer');
      expect(config.message).toBeDefined();
      expect(config.default).toBe(false);
    });
  });
});
