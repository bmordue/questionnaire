import { describe, it, expect } from '@jest/globals';
import { NumberInputComponent } from '../../../../ui/components/inputs/number-input.js';
import type { NumberQuestion } from '../../../../core/schema.js';
import { QuestionType } from '../../../../core/schema.js';

describe('NumberInputComponent', () => {
  const component = new NumberInputComponent();

  describe('validate', () => {
    it('should validate valid numbers', () => {
      const question: NumberQuestion = {
        id: 'q1',
        type: QuestionType.NUMBER,
        text: 'Age',
        required: false
      };

      expect(component.validate(25, question).isValid).toBe(true);
      expect(component.validate('25', question).isValid).toBe(true);
    });

    it('should reject invalid numbers', () => {
      const question: NumberQuestion = {
        id: 'q1',
        type: QuestionType.NUMBER,
        text: 'Age',
        required: false
      };

      const result = component.validate('abc', question);
      expect(result.isValid).toBe(false);
      expect(result.message).toBe('Please enter a valid number');
    });

    it('should validate required field', () => {
      const question: NumberQuestion = {
        id: 'q1',
        type: QuestionType.NUMBER,
        text: 'Age',
        required: true
      };

      expect(component.validate('', question).isValid).toBe(false);
      expect(component.validate(0, question).isValid).toBe(true);
    });

    it('should validate minimum constraint', () => {
      const question: NumberQuestion = {
        id: 'q1',
        type: QuestionType.NUMBER,
        text: 'Age',
        required: false,
        validation: {
          min: 18
        }
      };

      expect(component.validate(17, question).isValid).toBe(false);
      expect(component.validate(18, question).isValid).toBe(true);
      expect(component.validate(25, question).isValid).toBe(true);
    });

    it('should validate maximum constraint', () => {
      const question: NumberQuestion = {
        id: 'q1',
        type: QuestionType.NUMBER,
        text: 'Age',
        required: false,
        validation: {
          max: 100
        }
      };

      expect(component.validate(50, question).isValid).toBe(true);
      expect(component.validate(100, question).isValid).toBe(true);
      expect(component.validate(101, question).isValid).toBe(false);
    });

    it('should validate range constraint', () => {
      const question: NumberQuestion = {
        id: 'q1',
        type: QuestionType.NUMBER,
        text: 'Age',
        required: false,
        validation: {
          min: 18,
          max: 65
        }
      };

      expect(component.validate(17, question).isValid).toBe(false);
      expect(component.validate(18, question).isValid).toBe(true);
      expect(component.validate(40, question).isValid).toBe(true);
      expect(component.validate(65, question).isValid).toBe(true);
      expect(component.validate(66, question).isValid).toBe(false);
    });

    it('should validate integer constraint', () => {
      const question: NumberQuestion = {
        id: 'q1',
        type: QuestionType.NUMBER,
        text: 'Count',
        required: false,
        validation: {
          integer: true
        }
      };

      expect(component.validate(5, question).isValid).toBe(true);
      expect(component.validate(5.5, question).isValid).toBe(false);
    });
  });

  describe('format', () => {
    it('should format number as string', () => {
      expect(component.format(25)).toBe('25');
      expect(component.format(3.14)).toBe('3.14');
    });
  });

  describe('getPromptConfig', () => {
    it('should return valid prompt configuration', () => {
      const question: NumberQuestion = {
        id: 'q1',
        type: QuestionType.NUMBER,
        text: 'What is your age?',
        required: true
      };

      const config = component.getPromptConfig(question);
      expect(config.type).toBe('input');
      expect(config.name).toBe('answer');
      expect(config.message).toBeDefined();
      expect(config.validate).toBeDefined();
      expect(config.filter).toBeDefined();
    });
  });
});
