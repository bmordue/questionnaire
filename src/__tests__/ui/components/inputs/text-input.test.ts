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
  });
});
