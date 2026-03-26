import { describe, it, expect } from '@jest/globals';
import { EmailInputComponent } from '../../../../ui/components/inputs/email-input.js';
import type { EmailQuestion } from '../../../../core/schema.js';
import { QuestionType } from '../../../../core/schema.js';

describe('EmailInputComponent', () => {
  const component = new EmailInputComponent();

  describe('validate', () => {
    it('should validate valid email addresses', () => {
      const question: EmailQuestion = {
        id: 'q1',
        type: QuestionType.EMAIL,
        text: 'Email',
        required: false
      };

      expect(component.validate('test@example.com', question).isValid).toBe(true);
      expect(component.validate('user.name@domain.co.uk', question).isValid).toBe(true);
    });

    it('should reject invalid email addresses', () => {
      const question: EmailQuestion = {
        id: 'q1',
        type: QuestionType.EMAIL,
        text: 'Email',
        required: false
      };

      expect(component.validate('invalid', question).isValid).toBe(false);
      expect(component.validate('test@', question).isValid).toBe(false);
      expect(component.validate('@example.com', question).isValid).toBe(false);
      expect(component.validate('test@com', question).isValid).toBe(false);
    });

    it('should validate required field', () => {
      const question: EmailQuestion = {
        id: 'q1',
        type: QuestionType.EMAIL,
        text: 'Email',
        required: true
      };

      expect(component.validate('', question).isValid).toBe(false);
      expect(component.validate('test@example.com', question).isValid).toBe(true);
    });

    it('should allow empty value for non-required field', () => {
      const question: EmailQuestion = {
        id: 'q1',
        type: QuestionType.EMAIL,
        text: 'Email',
        required: false
      };

      expect(component.validate('', question).isValid).toBe(true);
    });

    it('should validate minLength and maxLength', () => {
      const question: EmailQuestion = {
        id: 'q1',
        type: QuestionType.EMAIL,
        text: 'Email',
        required: true,
        validation: {
          minLength: 10,
          maxLength: 20
        }
      };

      // Valid: length 16
      expect(component.validate('test@example.com', question).isValid).toBe(true);

      // Invalid: length 9
      expect(component.validate('a@b.com', question).isValid).toBe(false);
      expect(component.validate('a@b.com', question).message).toContain('Minimum length is 10');

      // Invalid: length 21
      expect(component.validate('verylongemail@example.com', question).isValid).toBe(false);
      expect(component.validate('verylongemail@example.com', question).message).toContain('Maximum length is 20');
    });
  });

  describe('format', () => {
    it('should return the email as-is', () => {
      expect(component.format('test@example.com')).toBe('test@example.com');
    });
  });

  describe('getPromptConfig', () => {
    it('should return valid prompt configuration', () => {
      const question: EmailQuestion = {
        id: 'q1',
        type: QuestionType.EMAIL,
        text: 'What is your email?',
        required: true
      };

      const config = component.getPromptConfig(question);
      expect(config.type).toBe('input');
      expect(config.name).toBe('answer');
      expect(config.message).toBeDefined();
      expect(config.validate).toBeDefined();
      expect(config.transformer).toBeDefined();
    });

    it('should provide feedback in transformer', () => {
      const question: EmailQuestion = {
        id: 'q1',
        type: QuestionType.EMAIL,
        text: 'Email',
        required: true,
        validation: {
          maxLength: 20
        }
      };

      const config = component.getPromptConfig(question);

      // Valid email
      const validFeedback = config.transformer('test@example.com');
      expect(validFeedback).toContain('test@example.com');
      expect(validFeedback).toContain('[16/20]');
      expect(validFeedback).toContain('Valid email format');

      // Invalid/incomplete email
      const incompleteFeedback = config.transformer('test@');
      expect(incompleteFeedback).toContain('Incomplete email');

      // Over maxLength
      const overLengthFeedback = config.transformer('thisemailiswaytoolong@example.com');
      expect(overLengthFeedback).toContain('[33/20]');
    });
  });
});
