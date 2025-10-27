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
    });
  });
});
