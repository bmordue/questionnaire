import { describe, it, expect } from '@jest/globals';
import { CrossQuestionValidator } from '../../../core/validation/cross-validation/cross-validator.js';
import type { DependencyRule, ConsistencyRule, CompletenessRule } from '../../../core/validation/types.js';
import type { Question } from '../../../core/schemas/question.js';
import { QuestionType } from '../../../core/schemas/question.js';

describe('CrossQuestionValidator', () => {
  const validator = new CrossQuestionValidator();

  const mockQuestions: Question[] = [
    {
      id: 'q1',
      type: QuestionType.TEXT,
      text: 'Question 1',
      required: false
    },
    {
      id: 'q2',
      type: QuestionType.TEXT,
      text: 'Question 2',
      required: false
    },
    {
      id: 'q3',
      type: QuestionType.TEXT,
      text: 'Question 3',
      required: false
    }
  ];

  describe('dependency validation', () => {
    it('should fail when dependent question is answered but required is not', () => {
      const responses = new Map([
        ['q1', 'answer1'],
        ['q2', '']
      ]);

      const rule: DependencyRule = {
        type: 'dependency',
        dependentQuestion: 'q1',
        requiredQuestion: 'q2',
        message: 'Q2 is required when Q1 is answered'
      };

      const result = validator.validate(responses, mockQuestions, [rule]);
      expect(result.isValid).toBe(false);
      expect(result.errors[0]?.code).toBe('DEPENDENCY_VIOLATION');
      expect(result.errors[0]?.message).toContain('Q2 is required when Q1 is answered');
    });

    it('should pass when both dependent and required are answered', () => {
      const responses = new Map([
        ['q1', 'answer1'],
        ['q2', 'answer2']
      ]);

      const rule: DependencyRule = {
        type: 'dependency',
        dependentQuestion: 'q1',
        requiredQuestion: 'q2'
      };

      const result = validator.validate(responses, mockQuestions, [rule]);
      expect(result.isValid).toBe(true);
    });

    it('should pass when neither dependent nor required are answered', () => {
      const responses = new Map([
        ['q1', ''],
        ['q2', '']
      ]);

      const rule: DependencyRule = {
        type: 'dependency',
        dependentQuestion: 'q1',
        requiredQuestion: 'q2'
      };

      const result = validator.validate(responses, mockQuestions, [rule]);
      expect(result.isValid).toBe(true);
    });
  });

  describe('consistency validation', () => {
    it('should fail when values must match but do not', () => {
      const responses = new Map([
        ['q1', 'value1'],
        ['q2', 'value2']
      ]);

      const rule: ConsistencyRule = {
        type: 'consistency',
        questions: ['q1', 'q2'],
        mustMatch: true,
        message: 'Values must match'
      };

      const result = validator.validate(responses, mockQuestions, [rule]);
      expect(result.isValid).toBe(false);
      expect(result.errors[0]?.code).toBe('CONSISTENCY_VIOLATION');
    });

    it('should pass when values match', () => {
      const responses = new Map([
        ['q1', 'same-value'],
        ['q2', 'same-value']
      ]);

      const rule: ConsistencyRule = {
        type: 'consistency',
        questions: ['q1', 'q2'],
        mustMatch: true
      };

      const result = validator.validate(responses, mockQuestions, [rule]);
      expect(result.isValid).toBe(true);
    });
  });

  describe('completeness validation', () => {
    it('should fail when required questions are not answered', () => {
      const responses = new Map([
        ['q1', 'answer1'],
        ['q2', '']
      ]);

      const rule: CompletenessRule = {
        type: 'completeness',
        requiredQuestions: ['q1', 'q2', 'q3']
      };

      const result = validator.validate(responses, mockQuestions, [rule]);
      expect(result.isValid).toBe(false);
      expect(result.errors.length).toBeGreaterThanOrEqual(1);
      expect(result.errors.some(e => e.code === 'INCOMPLETE')).toBe(true);
    });

    it('should pass when all required questions are answered', () => {
      const responses = new Map([
        ['q1', 'answer1'],
        ['q2', 'answer2'],
        ['q3', 'answer3']
      ]);

      const rule: CompletenessRule = {
        type: 'completeness',
        requiredQuestions: ['q1', 'q2', 'q3']
      };

      const result = validator.validate(responses, mockQuestions, [rule]);
      expect(result.isValid).toBe(true);
    });
  });

  describe('multiple rules', () => {
    it('should validate multiple rules and return all errors', () => {
      const responses = new Map([
        ['q1', 'answer1'],
        ['q2', ''],
        ['q3', '']
      ]);

      const rules = [
        {
          type: 'dependency' as const,
          dependentQuestion: 'q1',
          requiredQuestion: 'q2'
        },
        {
          type: 'completeness' as const,
          requiredQuestions: ['q1', 'q2', 'q3']
        }
      ];

      const result = validator.validate(responses, mockQuestions, rules);
      expect(result.isValid).toBe(false);
      expect(result.errors.length).toBeGreaterThanOrEqual(2);
    });
  });
});
