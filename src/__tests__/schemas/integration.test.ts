import { describe, it, expect } from '@jest/globals';
import {
  QuestionnaireSchema,
  QuestionnaireResponseSchema,
  createResponse
} from '../../core/schema.js';
import { TestDataFactory } from '../helpers/test-data-factory.js';
import { ValidationTestHelpers } from '../helpers/validation-helpers.js';

describe('Schema Integration Tests', () => {
  describe('Questionnaire and Response Integration', () => {
    it('should create matching questionnaire and response', () => {
      const questionnaire = TestDataFactory.createValidQuestionnaire();
      const response = createResponse(
        questionnaire.id,
        questionnaire.version,
        'session-123',
        questionnaire.questions.length
      );

      ValidationTestHelpers.expectValidationSuccess(QuestionnaireSchema, questionnaire);
      ValidationTestHelpers.expectValidationSuccess(QuestionnaireResponseSchema, response);

      expect(response.questionnaireId).toBe(questionnaire.id);
      expect(response.questionnaireVersion).toBe(questionnaire.version);
      expect(response.progress.totalQuestions).toBe(questionnaire.questions.length);
    });

    it('should handle complex questionnaire with response', () => {
      const questionnaire = TestDataFactory.createValidQuestionnaire({
        questions: [
          TestDataFactory.createValidTextQuestion({ id: 'q1', required: true }),
          TestDataFactory.createValidEmailQuestion({ id: 'q2', required: true }),
          TestDataFactory.createValidNumberQuestion({ id: 'q3', required: false }),
          TestDataFactory.createValidSingleChoiceQuestion({ id: 'q4', required: true }),
          TestDataFactory.createValidMultipleChoiceQuestion({ id: 'q5', required: false })
        ]
      });

      const now = new Date().toISOString();
      const response = createResponse(
        questionnaire.id,
        questionnaire.version,
        'session-456',
        questionnaire.questions.length
      );

      // Simulate filling out the questionnaire
      response.answers = [
        { questionId: 'q1', value: 'John Doe', answeredAt: now },
        { questionId: 'q2', value: 'john@example.com', answeredAt: now },
        { questionId: 'q3', value: 25, answeredAt: now },
        { questionId: 'q4', value: 'a', answeredAt: now },
        { questionId: 'q5', value: ['a', 'b'], answeredAt: now }
      ];
      response.progress.answeredCount = 5;
      response.progress.currentQuestionIndex = 5;

      ValidationTestHelpers.expectValidationSuccess(QuestionnaireSchema, questionnaire);
      ValidationTestHelpers.expectValidationSuccess(QuestionnaireResponseSchema, response);
    });
  });

  describe('Large Data Structure Tests', () => {
    it('should validate large questionnaire', () => {
      const largeQuestionnaire = TestDataFactory.createLargeQuestionnaire(100);
      ValidationTestHelpers.expectValidationSuccess(QuestionnaireSchema, largeQuestionnaire);
      
      expect(largeQuestionnaire.questions.length).toBe(100);
    });

    it('should validate questionnaire with maximum reasonable size', () => {
      const maxQuestionnaire = TestDataFactory.createLargeQuestionnaire(1000);
      ValidationTestHelpers.expectValidationSuccess(QuestionnaireSchema, maxQuestionnaire);
      
      expect(maxQuestionnaire.questions.length).toBe(1000);
    });

    it('should handle response with many answers', () => {
      const now = new Date().toISOString();
      const answers = [];
      for (let i = 0; i < 100; i++) {
        answers.push({
          questionId: `q${i}`,
          value: `answer-${i}`,
          answeredAt: now
        });
      }

      const response = TestDataFactory.createValidResponse({
        answers,
        progress: {
          currentQuestionIndex: 100,
          totalQuestions: 100,
          answeredCount: 100
        }
      });

      ValidationTestHelpers.expectValidationSuccess(QuestionnaireResponseSchema, response);
    });
  });

  describe('Complex Conditional Logic', () => {
    it('should validate questionnaire with conditional questions', () => {
      const questionnaire = TestDataFactory.createValidQuestionnaire({
        questions: [
          TestDataFactory.createValidBooleanQuestion({ id: 'q1' }),
          TestDataFactory.createValidTextQuestion({
            id: 'q2',
            conditional: {
              showIf: {
                questionId: 'q1',
                operator: 'equals',
                value: true
              }
            }
          }),
          TestDataFactory.createValidNumberQuestion({
            id: 'q3',
            conditional: {
              hideIf: {
                questionId: 'q1',
                operator: 'equals',
                value: false
              }
            }
          })
        ]
      });

      ValidationTestHelpers.expectValidationSuccess(QuestionnaireSchema, questionnaire);
    });

    it('should validate questionnaire with chained conditionals', () => {
      const questionnaire = TestDataFactory.createValidQuestionnaire({
        questions: [
          TestDataFactory.createValidSingleChoiceQuestion({ id: 'q1' }),
          TestDataFactory.createValidTextQuestion({
            id: 'q2',
            conditional: {
              showIf: {
                questionId: 'q1',
                operator: 'equals',
                value: 'a'
              }
            }
          }),
          TestDataFactory.createValidNumberQuestion({
            id: 'q3',
            conditional: {
              requiredIf: {
                questionId: 'q2',
                operator: 'isNotEmpty'
              }
            }
          })
        ]
      });

      ValidationTestHelpers.expectValidationSuccess(QuestionnaireSchema, questionnaire);
    });

    it('should validate complex conditional operators', () => {
      const operators: Array<'equals' | 'notEquals' | 'contains' | 'greaterThan' | 'lessThan'> = [
        'equals',
        'notEquals',
        'contains',
        'greaterThan',
        'lessThan'
      ];

      operators.forEach((operator, index) => {
        const questionnaire = TestDataFactory.createValidQuestionnaire({
          questions: [
            TestDataFactory.createValidNumberQuestion({ id: 'q0' }),
            TestDataFactory.createValidTextQuestion({
              id: `q${index + 1}`,
              conditional: {
                showIf: {
                  questionId: 'q0',
                  operator: operator as any,
                  value: 50
                }
              }
            })
          ]
        });

        ValidationTestHelpers.expectValidationSuccess(QuestionnaireSchema, questionnaire);
      });
    });
  });

  describe('Schema Composition', () => {
    it('should compose questionnaire with all question types', () => {
      const questionnaire = TestDataFactory.createValidQuestionnaire({
        questions: [
          TestDataFactory.createValidTextQuestion({ id: 'q1' }),
          TestDataFactory.createValidEmailQuestion({ id: 'q2' }),
          TestDataFactory.createValidNumberQuestion({ id: 'q3' }),
          TestDataFactory.createValidSingleChoiceQuestion({ id: 'q4' }),
          TestDataFactory.createValidMultipleChoiceQuestion({ id: 'q5' }),
          TestDataFactory.createValidBooleanQuestion({ id: 'q6' }),
          TestDataFactory.createValidDateQuestion({ id: 'q7' }),
          TestDataFactory.createValidRatingQuestion({ id: 'q8' })
        ]
      });

      ValidationTestHelpers.expectValidationSuccess(QuestionnaireSchema, questionnaire);
      expect(questionnaire.questions.length).toBe(8);
    });

    it('should compose questionnaire with all validation types', () => {
      const questionnaire = TestDataFactory.createValidQuestionnaire({
        questions: [
          TestDataFactory.createValidTextQuestion({
            id: 'q1',
            validation: { minLength: 5, maxLength: 100, pattern: '^[A-Za-z]+$' }
          }),
          TestDataFactory.createValidNumberQuestion({
            id: 'q2',
            validation: { min: 0, max: 100, integer: true }
          }),
          TestDataFactory.createValidDateQuestion({
            id: 'q3',
            validation: { minDate: '2000-01-01', maxDate: '2025-12-31', allowPast: true }
          }),
          TestDataFactory.createValidRatingQuestion({
            id: 'q4',
            validation: { min: 1, max: 10, step: 0.5 }
          })
        ]
      });

      ValidationTestHelpers.expectValidationSuccess(QuestionnaireSchema, questionnaire);
    });

    it('should compose response with different answer types', () => {
      const now = new Date().toISOString();
      const response = TestDataFactory.createValidResponse({
        answers: [
          { questionId: 'q1', value: 'text answer', answeredAt: now },
          { questionId: 'q2', value: 42, answeredAt: now },
          { questionId: 'q3', value: true, answeredAt: now },
          { questionId: 'q4', value: ['a', 'b', 'c'], answeredAt: now },
          { questionId: 'q5', value: { rating: 5, comment: 'Great' }, answeredAt: now },
          { questionId: 'q6', value: null, answeredAt: now }
        ],
        progress: {
          currentQuestionIndex: 6,
          totalQuestions: 6,
          answeredCount: 6
        }
      });

      ValidationTestHelpers.expectValidationSuccess(QuestionnaireResponseSchema, response);
    });
  });

  describe('Performance Tests', () => {
    it('should validate large questionnaire quickly', () => {
      const largeQuestionnaire = TestDataFactory.createLargeQuestionnaire(1000);
      
      const start = performance.now();
      ValidationTestHelpers.expectValidationSuccess(QuestionnaireSchema, largeQuestionnaire);
      const duration = performance.now() - start;
      
      // Should complete in reasonable time (under 1 second)
      expect(duration).toBeLessThan(1000);
    });

    it('should validate multiple questionnaires efficiently', () => {
      const questionnaires = [];
      for (let i = 0; i < 100; i++) {
        questionnaires.push(TestDataFactory.createValidQuestionnaire({
          id: `questionnaire-${i}`,
          questions: [
            TestDataFactory.createValidTextQuestion({ id: `q${i}-1` }),
            TestDataFactory.createValidNumberQuestion({ id: `q${i}-2` }),
            TestDataFactory.createValidBooleanQuestion({ id: `q${i}-3` })
          ]
        }));
      }

      const start = performance.now();
      questionnaires.forEach((questionnaire) => {
        ValidationTestHelpers.expectValidationSuccess(QuestionnaireSchema, questionnaire);
      });
      const duration = performance.now() - start;
      
      // Should validate 100 questionnaires quickly (under 1 second)
      expect(duration).toBeLessThan(1000);
    });

    it('should handle validation of complex nested structures', () => {
      const questionnaire = TestDataFactory.createValidQuestionnaire({
        metadata: {
          title: 'Complex Survey',
          description: 'A' + 'very '.repeat(100) + 'long description',
          author: 'Test Author',
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
          tags: Array(50).fill('tag').map((t, i) => `${t}-${i}`)
        },
        questions: [
          TestDataFactory.createValidSingleChoiceQuestion({
            id: 'q1',
            options: Array(100).fill(null).map((_, i) => ({
              value: `opt-${i}`,
              label: `Option ${i}`,
              description: `Description for option ${i}`
            }))
          }),
          TestDataFactory.createValidMultipleChoiceQuestion({
            id: 'q2',
            options: Array(50).fill(null).map((_, i) => ({
              value: `opt-${i}`,
              label: `Option ${i}`
            }))
          })
        ]
      });

      const start = performance.now();
      ValidationTestHelpers.expectValidationSuccess(QuestionnaireSchema, questionnaire);
      const duration = performance.now() - start;
      
      // Should handle complex structures efficiently (under 500ms)
      expect(duration).toBeLessThan(500);
    });
  });

  describe('Edge Cases', () => {
    it('should handle questionnaire with metadata containing special characters', () => {
      const questionnaire = TestDataFactory.createValidQuestionnaire({
        metadata: {
          title: 'Survey with "quotes" and \'apostrophes\'',
          description: 'Description with <tags> and & symbols',
          author: 'Author (with parentheses)',
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
          tags: ['tag-with-dashes', 'tag_with_underscores', 'tag.with.dots']
        }
      });

      ValidationTestHelpers.expectValidationSuccess(QuestionnaireSchema, questionnaire);
    });

    it('should handle response with empty string values', () => {
      const now = new Date().toISOString();
      const response = TestDataFactory.createValidResponse({
        answers: [
          { questionId: 'q1', value: '', answeredAt: now },
          { questionId: 'q2', value: ' ', answeredAt: now }
        ],
        progress: {
          currentQuestionIndex: 2,
          totalQuestions: 2,
          answeredCount: 2
        }
      });

      ValidationTestHelpers.expectValidationSuccess(QuestionnaireResponseSchema, response);
    });

    it('should handle questionnaire with minimum valid configuration', () => {
      const now = new Date().toISOString();
      const minimalQuestionnaire = {
        id: 'min',
        version: '1',
        metadata: {
          title: 'T',
          createdAt: now,
          updatedAt: now
        },
        questions: [
          TestDataFactory.createValidTextQuestion({ id: 'q' })
        ]
      };

      ValidationTestHelpers.expectValidationSuccess(QuestionnaireSchema, minimalQuestionnaire);
    });

    it('should handle response at exact boundary values', () => {
      const response = TestDataFactory.createValidResponse({
        progress: {
          currentQuestionIndex: 0,
          totalQuestions: 1,
          answeredCount: 0
        }
      });

      ValidationTestHelpers.expectValidationSuccess(QuestionnaireResponseSchema, response);
    });
  });
});
