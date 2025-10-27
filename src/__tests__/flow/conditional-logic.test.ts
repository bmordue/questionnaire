/**
 * Conditional Logic Engine Tests
 */

import { describe, it, expect, beforeEach } from '@jest/globals';
import { ConditionalLogicEngine } from '../../core/flow/conditional-logic.js';
import { TestDataFactory } from '../helpers/test-data-factory.js';
import type { Condition } from '../../core/schema.js';

describe('ConditionalLogicEngine', () => {
  let engine: ConditionalLogicEngine;
  let responses: Map<string, any>;

  beforeEach(() => {
    engine = new ConditionalLogicEngine();
    responses = new Map();
  });

  describe('evaluateCondition', () => {
    describe('equals operator', () => {
      it('should return true when values are equal', () => {
        responses.set('q1', 'yes');
        const condition: Condition = {
          questionId: 'q1',
          operator: 'equals',
          value: 'yes'
        };

        expect(engine.evaluateCondition(condition, responses)).toBe(true);
      });

      it('should return false when values are not equal', () => {
        responses.set('q1', 'no');
        const condition: Condition = {
          questionId: 'q1',
          operator: 'equals',
          value: 'yes'
        };

        expect(engine.evaluateCondition(condition, responses)).toBe(false);
      });

      it('should work with numbers', () => {
        responses.set('q1', 42);
        const condition: Condition = {
          questionId: 'q1',
          operator: 'equals',
          value: 42
        };

        expect(engine.evaluateCondition(condition, responses)).toBe(true);
      });
    });

    describe('notEquals operator', () => {
      it('should return true when values are not equal', () => {
        responses.set('q1', 'no');
        const condition: Condition = {
          questionId: 'q1',
          operator: 'notEquals',
          value: 'yes'
        };

        expect(engine.evaluateCondition(condition, responses)).toBe(true);
      });

      it('should return false when values are equal', () => {
        responses.set('q1', 'yes');
        const condition: Condition = {
          questionId: 'q1',
          operator: 'notEquals',
          value: 'yes'
        };

        expect(engine.evaluateCondition(condition, responses)).toBe(false);
      });
    });

    describe('greaterThan operator', () => {
      it('should return true when response is greater', () => {
        responses.set('q1', 10);
        const condition: Condition = {
          questionId: 'q1',
          operator: 'greaterThan',
          value: 5
        };

        expect(engine.evaluateCondition(condition, responses)).toBe(true);
      });

      it('should return false when response is less', () => {
        responses.set('q1', 3);
        const condition: Condition = {
          questionId: 'q1',
          operator: 'greaterThan',
          value: 5
        };

        expect(engine.evaluateCondition(condition, responses)).toBe(false);
      });

      it('should return false when response is equal', () => {
        responses.set('q1', 5);
        const condition: Condition = {
          questionId: 'q1',
          operator: 'greaterThan',
          value: 5
        };

        expect(engine.evaluateCondition(condition, responses)).toBe(false);
      });

      it('should return false for non-numeric responses', () => {
        responses.set('q1', 'text');
        const condition: Condition = {
          questionId: 'q1',
          operator: 'greaterThan',
          value: 5
        };

        expect(engine.evaluateCondition(condition, responses)).toBe(false);
      });
    });

    describe('lessThan operator', () => {
      it('should return true when response is less', () => {
        responses.set('q1', 3);
        const condition: Condition = {
          questionId: 'q1',
          operator: 'lessThan',
          value: 5
        };

        expect(engine.evaluateCondition(condition, responses)).toBe(true);
      });

      it('should return false when response is greater', () => {
        responses.set('q1', 10);
        const condition: Condition = {
          questionId: 'q1',
          operator: 'lessThan',
          value: 5
        };

        expect(engine.evaluateCondition(condition, responses)).toBe(false);
      });
    });

    describe('greaterThanOrEqual operator', () => {
      it('should return true when response is greater', () => {
        responses.set('q1', 10);
        const condition: Condition = {
          questionId: 'q1',
          operator: 'greaterThanOrEqual',
          value: 5
        };

        expect(engine.evaluateCondition(condition, responses)).toBe(true);
      });

      it('should return true when response is equal', () => {
        responses.set('q1', 5);
        const condition: Condition = {
          questionId: 'q1',
          operator: 'greaterThanOrEqual',
          value: 5
        };

        expect(engine.evaluateCondition(condition, responses)).toBe(true);
      });

      it('should return false when response is less', () => {
        responses.set('q1', 3);
        const condition: Condition = {
          questionId: 'q1',
          operator: 'greaterThanOrEqual',
          value: 5
        };

        expect(engine.evaluateCondition(condition, responses)).toBe(false);
      });
    });

    describe('lessThanOrEqual operator', () => {
      it('should return true when response is less', () => {
        responses.set('q1', 3);
        const condition: Condition = {
          questionId: 'q1',
          operator: 'lessThanOrEqual',
          value: 5
        };

        expect(engine.evaluateCondition(condition, responses)).toBe(true);
      });

      it('should return true when response is equal', () => {
        responses.set('q1', 5);
        const condition: Condition = {
          questionId: 'q1',
          operator: 'lessThanOrEqual',
          value: 5
        };

        expect(engine.evaluateCondition(condition, responses)).toBe(true);
      });

      it('should return false when response is greater', () => {
        responses.set('q1', 10);
        const condition: Condition = {
          questionId: 'q1',
          operator: 'lessThanOrEqual',
          value: 5
        };

        expect(engine.evaluateCondition(condition, responses)).toBe(false);
      });
    });

    describe('contains operator', () => {
      it('should return true when array contains value', () => {
        responses.set('q1', ['a', 'b', 'c']);
        const condition: Condition = {
          questionId: 'q1',
          operator: 'contains',
          value: 'b'
        };

        expect(engine.evaluateCondition(condition, responses)).toBe(true);
      });

      it('should return false when array does not contain value', () => {
        responses.set('q1', ['a', 'b', 'c']);
        const condition: Condition = {
          questionId: 'q1',
          operator: 'contains',
          value: 'd'
        };

        expect(engine.evaluateCondition(condition, responses)).toBe(false);
      });

      it('should return false for non-array responses', () => {
        responses.set('q1', 'text');
        const condition: Condition = {
          questionId: 'q1',
          operator: 'contains',
          value: 'text'
        };

        expect(engine.evaluateCondition(condition, responses)).toBe(false);
      });
    });

    describe('notContains operator', () => {
      it('should return true when array does not contain value', () => {
        responses.set('q1', ['a', 'b', 'c']);
        const condition: Condition = {
          questionId: 'q1',
          operator: 'notContains',
          value: 'd'
        };

        expect(engine.evaluateCondition(condition, responses)).toBe(true);
      });

      it('should return false when array contains value', () => {
        responses.set('q1', ['a', 'b', 'c']);
        const condition: Condition = {
          questionId: 'q1',
          operator: 'notContains',
          value: 'b'
        };

        expect(engine.evaluateCondition(condition, responses)).toBe(false);
      });

      it('should return true for non-array responses', () => {
        responses.set('q1', 'text');
        const condition: Condition = {
          questionId: 'q1',
          operator: 'notContains',
          value: 'x'
        };

        expect(engine.evaluateCondition(condition, responses)).toBe(true);
      });
    });

    describe('in operator', () => {
      it('should return true when response is in values array', () => {
        responses.set('q1', 'b');
        const condition: Condition = {
          questionId: 'q1',
          operator: 'in',
          values: ['a', 'b', 'c']
        };

        expect(engine.evaluateCondition(condition, responses)).toBe(true);
      });

      it('should return false when response is not in values array', () => {
        responses.set('q1', 'd');
        const condition: Condition = {
          questionId: 'q1',
          operator: 'in',
          values: ['a', 'b', 'c']
        };

        expect(engine.evaluateCondition(condition, responses)).toBe(false);
      });
    });

    describe('notIn operator', () => {
      it('should return true when response is not in values array', () => {
        responses.set('q1', 'd');
        const condition: Condition = {
          questionId: 'q1',
          operator: 'notIn',
          values: ['a', 'b', 'c']
        };

        expect(engine.evaluateCondition(condition, responses)).toBe(true);
      });

      it('should return false when response is in values array', () => {
        responses.set('q1', 'b');
        const condition: Condition = {
          questionId: 'q1',
          operator: 'notIn',
          values: ['a', 'b', 'c']
        };

        expect(engine.evaluateCondition(condition, responses)).toBe(false);
      });
    });

    describe('isEmpty operator', () => {
      it('should return true for null', () => {
        responses.set('q1', null);
        const condition: Condition = {
          questionId: 'q1',
          operator: 'isEmpty'
        };

        expect(engine.evaluateCondition(condition, responses)).toBe(true);
      });

      it('should return true for undefined', () => {
        responses.set('q1', undefined);
        const condition: Condition = {
          questionId: 'q1',
          operator: 'isEmpty'
        };

        expect(engine.evaluateCondition(condition, responses)).toBe(true);
      });

      it('should return true for empty string', () => {
        responses.set('q1', '');
        const condition: Condition = {
          questionId: 'q1',
          operator: 'isEmpty'
        };

        expect(engine.evaluateCondition(condition, responses)).toBe(true);
      });

      it('should return true for empty array', () => {
        responses.set('q1', []);
        const condition: Condition = {
          questionId: 'q1',
          operator: 'isEmpty'
        };

        expect(engine.evaluateCondition(condition, responses)).toBe(true);
      });

      it('should return false for non-empty values', () => {
        responses.set('q1', 'text');
        const condition: Condition = {
          questionId: 'q1',
          operator: 'isEmpty'
        };

        expect(engine.evaluateCondition(condition, responses)).toBe(false);
      });
    });

    describe('isNotEmpty operator', () => {
      it('should return false for null', () => {
        responses.set('q1', null);
        const condition: Condition = {
          questionId: 'q1',
          operator: 'isNotEmpty'
        };

        expect(engine.evaluateCondition(condition, responses)).toBe(false);
      });

      it('should return false for undefined', () => {
        responses.set('q1', undefined);
        const condition: Condition = {
          questionId: 'q1',
          operator: 'isNotEmpty'
        };

        expect(engine.evaluateCondition(condition, responses)).toBe(false);
      });

      it('should return false for empty string', () => {
        responses.set('q1', '');
        const condition: Condition = {
          questionId: 'q1',
          operator: 'isNotEmpty'
        };

        expect(engine.evaluateCondition(condition, responses)).toBe(false);
      });

      it('should return false for empty array', () => {
        responses.set('q1', []);
        const condition: Condition = {
          questionId: 'q1',
          operator: 'isNotEmpty'
        };

        expect(engine.evaluateCondition(condition, responses)).toBe(false);
      });

      it('should return true for non-empty values', () => {
        responses.set('q1', 'text');
        const condition: Condition = {
          questionId: 'q1',
          operator: 'isNotEmpty'
        };

        expect(engine.evaluateCondition(condition, responses)).toBe(true);
      });

      it('should return true for non-empty arrays', () => {
        responses.set('q1', ['a']);
        const condition: Condition = {
          questionId: 'q1',
          operator: 'isNotEmpty'
        };

        expect(engine.evaluateCondition(condition, responses)).toBe(true);
      });
    });
  });

  describe('evaluateConditionGroup', () => {
    it('should evaluate single condition', () => {
      responses.set('q1', 'yes');
      const condition: Condition = {
        questionId: 'q1',
        operator: 'equals',
        value: 'yes'
      };

      expect(engine.evaluateConditionGroup(condition, responses)).toBe(true);
    });

    it('should evaluate array of conditions with AND logic', () => {
      responses.set('q1', 'yes');
      responses.set('q2', 10);

      const conditions: Condition[] = [
        {
          questionId: 'q1',
          operator: 'equals',
          value: 'yes'
        },
        {
          questionId: 'q2',
          operator: 'greaterThan',
          value: 5
        }
      ];

      expect(engine.evaluateConditionGroup(conditions, responses)).toBe(true);
    });

    it('should return false if any condition in array fails', () => {
      responses.set('q1', 'yes');
      responses.set('q2', 3);

      const conditions: Condition[] = [
        {
          questionId: 'q1',
          operator: 'equals',
          value: 'yes'
        },
        {
          questionId: 'q2',
          operator: 'greaterThan',
          value: 5
        }
      ];

      expect(engine.evaluateConditionGroup(conditions, responses)).toBe(false);
    });
  });

  describe('shouldShowQuestion', () => {
    it('should return true for questions without conditional logic', () => {
      const question = TestDataFactory.createValidTextQuestion();
      expect(engine.shouldShowQuestion(question, responses)).toBe(true);
    });

    it('should return true when showIf condition is met', () => {
      responses.set('q1', 'yes');
      const question = TestDataFactory.createValidTextQuestion({
        conditional: {
          showIf: {
            questionId: 'q1',
            operator: 'equals',
            value: 'yes'
          }
        }
      });

      expect(engine.shouldShowQuestion(question, responses)).toBe(true);
    });

    it('should return false when showIf condition is not met', () => {
      responses.set('q1', 'no');
      const question = TestDataFactory.createValidTextQuestion({
        conditional: {
          showIf: {
            questionId: 'q1',
            operator: 'equals',
            value: 'yes'
          }
        }
      });

      expect(engine.shouldShowQuestion(question, responses)).toBe(false);
    });

    it('should return false when hideIf condition is met', () => {
      responses.set('q1', 'yes');
      const question = TestDataFactory.createValidTextQuestion({
        conditional: {
          hideIf: {
            questionId: 'q1',
            operator: 'equals',
            value: 'yes'
          }
        }
      });

      expect(engine.shouldShowQuestion(question, responses)).toBe(false);
    });

    it('should return true when hideIf condition is not met', () => {
      responses.set('q1', 'no');
      const question = TestDataFactory.createValidTextQuestion({
        conditional: {
          hideIf: {
            questionId: 'q1',
            operator: 'equals',
            value: 'yes'
          }
        }
      });

      expect(engine.shouldShowQuestion(question, responses)).toBe(true);
    });

    it('should handle both showIf and hideIf', () => {
      responses.set('q1', 'yes');
      responses.set('q2', 'no');

      const question = TestDataFactory.createValidTextQuestion({
        conditional: {
          showIf: {
            questionId: 'q1',
            operator: 'equals',
            value: 'yes'
          },
          hideIf: {
            questionId: 'q2',
            operator: 'equals',
            value: 'yes'
          }
        }
      });

      expect(engine.shouldShowQuestion(question, responses)).toBe(true);
    });
  });

  describe('shouldSkipQuestion', () => {
    it('should return false for questions without skipIf', () => {
      const question = TestDataFactory.createValidTextQuestion();
      expect(engine.shouldSkipQuestion(question, responses)).toBe(false);
    });

    it('should return true when skipIf condition is met', () => {
      responses.set('q1', 'yes');
      const question = TestDataFactory.createValidTextQuestion({
        conditional: {
          skipIf: {
            questionId: 'q1',
            operator: 'equals',
            value: 'yes'
          }
        }
      });

      expect(engine.shouldSkipQuestion(question, responses)).toBe(true);
    });

    it('should return false when skipIf condition is not met', () => {
      responses.set('q1', 'no');
      const question = TestDataFactory.createValidTextQuestion({
        conditional: {
          skipIf: {
            questionId: 'q1',
            operator: 'equals',
            value: 'yes'
          }
        }
      });

      expect(engine.shouldSkipQuestion(question, responses)).toBe(false);
    });
  });

  describe('isQuestionRequired', () => {
    it('should return true for questions marked as required', () => {
      const question = TestDataFactory.createValidTextQuestion({ required: true });
      expect(engine.isQuestionRequired(question, responses)).toBe(true);
    });

    it('should return false for questions not marked as required', () => {
      const question = TestDataFactory.createValidTextQuestion({ required: false });
      expect(engine.isQuestionRequired(question, responses)).toBe(false);
    });

    it('should return true when requiredIf condition is met', () => {
      responses.set('q1', 'yes');
      const question = TestDataFactory.createValidTextQuestion({
        required: false,
        conditional: {
          requiredIf: {
            questionId: 'q1',
            operator: 'equals',
            value: 'yes'
          }
        }
      });

      expect(engine.isQuestionRequired(question, responses)).toBe(true);
    });

    it('should return false when requiredIf condition is not met', () => {
      responses.set('q1', 'no');
      const question = TestDataFactory.createValidTextQuestion({
        required: false,
        conditional: {
          requiredIf: {
            questionId: 'q1',
            operator: 'equals',
            value: 'yes'
          }
        }
      });

      expect(engine.isQuestionRequired(question, responses)).toBe(false);
    });

    it('should return true if question is required even if requiredIf is false', () => {
      responses.set('q1', 'no');
      const question = TestDataFactory.createValidTextQuestion({
        required: true,
        conditional: {
          requiredIf: {
            questionId: 'q1',
            operator: 'equals',
            value: 'yes'
          }
        }
      });

      expect(engine.isQuestionRequired(question, responses)).toBe(true);
    });
  });
});
