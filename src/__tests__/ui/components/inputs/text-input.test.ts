import { describe, it, expect } from '@jest/globals';
import { TextInputComponent } from '../../../../ui/components/inputs/text-input.js';
import type { Question, TextQuestion } from '../../../../core/schema.js';
import { QuestionType } from '../../../../core/schema.js';

describe('TextInputComponent', () => {
  const component = new TextInputComponent();

  describe('validate', () => {
    it('should validate required field with value', () => {
      const question: TextQuestion = {
        id: 'q1',
        type: QuestionType.TEXT,
        text: 'Name',
        required: true
      };

      const result = component.validate('John', question);
      expect(result.isValid).toBe(true);
    });

    it('should reject required field without value', () => {
      const question: TextQuestion = {
        id: 'q1',
        type: QuestionType.TEXT,
        text: 'Name',
        required: true
      };

      const result = component.validate('', question);
      expect(result.isValid).toBe(false);
      expect(result.message).toBe('This field is required');
    });

    it('should allow empty value for non-required field', () => {
      const question: TextQuestion = {
        id: 'q1',
        type: QuestionType.TEXT,
        text: 'Name',
        required: false
      };

      const result = component.validate('', question);
      expect(result.isValid).toBe(true);
    });

    it('should validate minLength constraint', () => {
      const question: TextQuestion = {
        id: 'q1',
        type: QuestionType.TEXT,
        text: 'Name',
        required: false,
        validation: {
          minLength: 5
        }
      };

      expect(component.validate('John', question).isValid).toBe(false);
      expect(component.validate('Johnny', question).isValid).toBe(true);
    });

    it('should validate maxLength constraint', () => {
      const question: TextQuestion = {
        id: 'q1',
        type: QuestionType.TEXT,
        text: 'Name',
        required: false,
        validation: {
          maxLength: 10
        }
      };

      expect(component.validate('Short', question).isValid).toBe(true);
      expect(component.validate('This is too long', question).isValid).toBe(false);
    });

    it('should validate pattern constraint', () => {
      const question: TextQuestion = {
        id: 'q1',
        type: QuestionType.TEXT,
        text: 'Username',
        required: false,
        validation: {
          pattern: '^[a-z0-9]+$',
          patternMessage: 'Only lowercase letters and numbers'
        }
      };

      expect(component.validate('john123', question).isValid).toBe(true);
      expect(component.validate('John123', question).isValid).toBe(false);
    });

    it('should validate multiple constraints', () => {
      const question: TextQuestion = {
        id: 'q1',
        type: QuestionType.TEXT,
        text: 'Username',
        required: true,
        validation: {
          minLength: 3,
          maxLength: 10,
          pattern: '^[a-z0-9]+$'
        }
      };

      expect(component.validate('', question).isValid).toBe(false);
      expect(component.validate('ab', question).isValid).toBe(false);
      expect(component.validate('abc', question).isValid).toBe(true);
      expect(component.validate('abcdefghijk', question).isValid).toBe(false);
      expect(component.validate('ABC', question).isValid).toBe(false);
    });
  });

  describe('format', () => {
    it('should return the answer as-is', () => {
      expect(component.format('test')).toBe('test');
      expect(component.format('Hello World')).toBe('Hello World');
    });
  });

  describe('getPromptConfig', () => {
    it('should return valid prompt configuration', () => {
      const question: TextQuestion = {
        id: 'q1',
        type: QuestionType.TEXT,
        text: 'What is your name?',
        required: true
      };

      const config = component.getPromptConfig(question);
      expect(config.type).toBe('input');
      expect(config.name).toBe('answer');
      expect(config.message).toBeDefined();
      expect(config.validate).toBeDefined();
    });

    it('should show character count in transformer if maxLength is defined', () => {
      const question: TextQuestion = {
        id: 'q1',
        type: QuestionType.TEXT,
        text: 'Bio',
        required: false,
        validation: {
          maxLength: 10
        }
      };

      const config = component.getPromptConfig(question);
      expect(config.transformer).toBeDefined();

      const result = config.transformer('Hello');
      expect(result).toContain('Hello');
      expect(result).toContain('[5/10]');
    });

    it('should show error-styled character count when exceeding maxLength', () => {
      const question: TextQuestion = {
        id: 'q1',
        type: QuestionType.TEXT,
        text: 'Bio',
        required: false,
        validation: {
          maxLength: 10
        }
      };

      const config = component.getPromptConfig(question);
      expect(config.transformer).toBeDefined();

      const result = config.transformer('Hello World!');
      expect(result).toContain('Hello World!');
      expect(result).toContain('[12/10]');
    });
    it('should not show character count if maxLength is not defined', () => {
      const question: TextQuestion = {
        id: 'q1',
        type: QuestionType.TEXT,
        text: 'Name',
        required: false
      };

      const config = component.getPromptConfig(question);
      if (config.transformer) {
        const result = config.transformer('John');
        expect(result).toContain('John');
        expect(result).not.toContain('[');
      }
    });

    it('should show range hint when input is empty and validation exists', () => {
      const question: TextQuestion = {
        id: 'q1',
        type: QuestionType.TEXT,
        text: 'Name',
        required: true,
        validation: {
          minLength: 3,
          maxLength: 10
        }
      };

      const config = component.getPromptConfig(question);
      if (config.transformer) {
        const result = config.transformer('');
        expect(result).toContain('(Length: 3-10)');
      }
    });

    it('should show live validation feedback when typing', () => {
      const question: TextQuestion = {
        id: 'q1',
        type: QuestionType.TEXT,
        text: 'Name',
        required: true,
        validation: {
          minLength: 5
        }
      };

      const config = component.getPromptConfig(question);
      if (config.transformer) {
        // Invalid case
        const invalidResult = config.transformer('John');
        expect(invalidResult).toContain('John');
        expect(invalidResult).toContain('(Minimum length is 5 characters)');

        // Valid case
        const validResult = config.transformer('Johnny');
        expect(validResult).toContain('Johnny');
        expect(validResult).toContain('(Valid)');
      }
    });
  });
});
