import { describe, it, expect } from '@jest/globals';
import { ValidationManager } from '../../core/validation/validation-manager.js';
import type { Question } from '../../core/schemas/question.js';
import { QuestionType } from '../../core/schemas/question.js';

describe('ValidationManager', () => {
  const manager = new ValidationManager();

  describe('validateAnswer - text questions', () => {
    it('should validate text question with minLength', () => {
      const question: Question = {
        id: 'q1',
        type: QuestionType.TEXT,
        text: 'Enter text',
        required: true,
        validation: {
          minLength: 5,
          maxLength: 100
        }
      };

      const result = manager.validateAnswer(question, 'hi');
      expect(result.isValid).toBe(false);
      expect(result.errors[0]?.code).toBe('MIN_LENGTH');
    });

    it('should validate text question with pattern', () => {
      const question: Question = {
        id: 'q1',
        type: QuestionType.TEXT,
        text: 'Enter text',
        required: false,
        validation: {
          pattern: '^[a-z]+$',
          patternMessage: 'Only lowercase'
        }
      };

      const result = manager.validateAnswer(question, 'ABC');
      expect(result.isValid).toBe(false);
      expect(result.errors[0]?.message).toBe('Only lowercase');
    });
  });

  describe('validateAnswer - number questions', () => {
    it('should validate number question with range', () => {
      const question: Question = {
        id: 'q1',
        type: QuestionType.NUMBER,
        text: 'Enter number',
        required: true,
        validation: {
          min: 1,
          max: 10
        }
      };

      const result = manager.validateAnswer(question, 15);
      expect(result.isValid).toBe(false);
      expect(result.errors[0]?.code).toBe('ABOVE_MAXIMUM');
    });

    it('should validate number question requiring integer', () => {
      const question: Question = {
        id: 'q1',
        type: QuestionType.NUMBER,
        text: 'Enter number',
        required: false,
        validation: {
          integer: true
        }
      };

      const result = manager.validateAnswer(question, 3.14);
      expect(result.isValid).toBe(false);
      expect(result.errors[0]?.code).toBe('MUST_BE_INTEGER');
    });
  });

  describe('validateAnswer - choice questions', () => {
    it('should validate single choice question', () => {
      const question: Question = {
        id: 'q1',
        type: QuestionType.SINGLE_CHOICE,
        text: 'Choose one',
        required: true,
        options: [
          { value: 'a', label: 'Option A' },
          { value: 'b', label: 'Option B' }
        ]
      };

      const result = manager.validateAnswer(question, 'c');
      expect(result.isValid).toBe(false);
      expect(result.errors[0]?.code).toBe('INVALID_OPTION');
    });

    it('should validate multiple choice question', () => {
      const question: Question = {
        id: 'q1',
        type: QuestionType.MULTIPLE_CHOICE,
        text: 'Choose multiple',
        required: true,
        options: [
          { value: 'a', label: 'Option A' },
          { value: 'b', label: 'Option B' }
        ],
        validation: {
          minSelections: 1,
          maxSelections: 2
        }
      };

      const result = manager.validateAnswer(question, []);
      expect(result.isValid).toBe(false);
      expect(result.errors[0]?.code).toBe('REQUIRED_SELECTION');
    });
  });

  describe('validateAnswer - date questions', () => {
    it('should validate date format', () => {
      const question: Question = {
        id: 'q1',
        type: QuestionType.DATE,
        text: 'Enter date',
        required: true
      };

      const result = manager.validateAnswer(question, '01/15/2024');
      expect(result.isValid).toBe(false);
      expect(result.errors[0]?.code).toBe('INVALID_FORMAT');
    });

    it('should validate date range', () => {
      const question: Question = {
        id: 'q1',
        type: QuestionType.DATE,
        text: 'Enter date',
        required: false,
        validation: {
          minDate: '2024-01-01',
          maxDate: '2024-12-31'
        }
      };

      const result = manager.validateAnswer(question, '2025-01-01');
      expect(result.isValid).toBe(false);
      expect(result.errors[0]?.code).toBe('DATE_TOO_LATE');
    });
  });

  describe('validateAnswer - email questions', () => {
    it('should validate email format', () => {
      const question: Question = {
        id: 'q1',
        type: QuestionType.EMAIL,
        text: 'Enter email',
        required: true
      };

      const result = manager.validateAnswer(question, 'not-an-email');
      expect(result.isValid).toBe(false);
      expect(result.errors[0]?.code).toBe('INVALID_EMAIL');
    });
  });

  describe('validateAnswer - rating questions', () => {
    it('should validate rating range', () => {
      const question: Question = {
        id: 'q1',
        type: QuestionType.RATING,
        text: 'Rate this',
        required: true,
        validation: {
          min: 1,
          max: 5
        }
      };

      const result = manager.validateAnswer(question, 6);
      expect(result.isValid).toBe(false);
      expect(result.errors[0]?.code).toBe('ABOVE_MAXIMUM');
    });
  });

  describe('validateAnswer - boolean questions', () => {
    it('should validate boolean type', () => {
      const question: Question = {
        id: 'q1',
        type: QuestionType.BOOLEAN,
        text: 'Yes or no',
        required: true
      };

      const result = manager.validateAnswer(question, null);
      expect(result.isValid).toBe(false);
      expect(result.errors[0]?.code).toBe('REQUIRED_FIELD');
    });
  });

  describe('validateAllAnswers', () => {
    it('should validate all questions', () => {
      const questions: Question[] = [
        {
          id: 'q1',
          type: QuestionType.TEXT,
          text: 'Question 1',
          required: true
        },
        {
          id: 'q2',
          type: QuestionType.NUMBER,
          text: 'Question 2',
          required: true,
          validation: { min: 1, max: 10 }
        }
      ];

      const responses = new Map<string, any>([
        ['q1', ''],
        ['q2', 15]
      ]);

      const results = manager.validateAllAnswers(responses, questions);
      expect(results.size).toBe(2);
      expect(results.get('q1')?.isValid).toBe(false);
      expect(results.get('q2')?.isValid).toBe(false);
    });
  });

  describe('isAllValid', () => {
    it('should return false if any validation failed', () => {
      const results = new Map([
        ['q1', { isValid: true, errors: [], warnings: [] }],
        ['q2', { isValid: false, errors: [{ code: 'ERROR', message: 'Error', severity: 'error' as const }], warnings: [] }]
      ]);

      expect(manager.isAllValid(results)).toBe(false);
    });

    it('should return true if all validations passed', () => {
      const results = new Map([
        ['q1', { isValid: true, errors: [], warnings: [] }],
        ['q2', { isValid: true, errors: [], warnings: [] }]
      ]);

      expect(manager.isAllValid(results)).toBe(true);
    });
  });

  describe('getAllErrors', () => {
    it('should return only failed validations', () => {
      const results = new Map([
        ['q1', { isValid: true, errors: [], warnings: [] }],
        ['q2', { isValid: false, errors: [{ code: 'ERROR', message: 'Error', severity: 'error' as const }], warnings: [] }]
      ]);

      const errors = manager.getAllErrors(results);
      expect(errors).toHaveLength(1);
      expect(errors[0]?.questionId).toBe('q2');
    });
  });
});
