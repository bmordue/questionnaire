import { describe, it, expect } from '@jest/globals';
import {
  QuestionnaireResponseSchema,
  ResponseStatus,
  validateResponse,
  safeValidateResponse,
  createResponse
} from '../../core/schemas/response.js';
import { TestDataFactory } from '../helpers/test-data-factory.js';
import { ValidationTestHelpers } from '../helpers/validation-helpers.js';

describe('Response Schema Validation', () => {
  describe('Response Structure', () => {
    describe('Valid Cases', () => {
      it('should accept valid response', () => {
        const validResponse = TestDataFactory.createValidResponse();
        ValidationTestHelpers.expectValidationSuccess(QuestionnaireResponseSchema, validResponse);
      });

      it('should accept response with answers', () => {
        const now = new Date().toISOString();
        const responseWithAnswers = TestDataFactory.createValidResponse({
          answers: [
            { questionId: 'q1', value: 'John Doe', answeredAt: now },
            { questionId: 'q2', value: 25, answeredAt: now }
          ],
          progress: {
            currentQuestionIndex: 2,
            totalQuestions: 2,
            answeredCount: 2
          }
        });
        ValidationTestHelpers.expectValidationSuccess(QuestionnaireResponseSchema, responseWithAnswers);
      });

      it('should accept completed response', () => {
        const now = new Date().toISOString();
        const completedResponse = TestDataFactory.createValidResponse({
          status: ResponseStatus.COMPLETED,
          completedAt: now,
          progress: {
            currentQuestionIndex: 2,
            totalQuestions: 2,
            answeredCount: 2
          }
        });
        ValidationTestHelpers.expectValidationSuccess(QuestionnaireResponseSchema, completedResponse);
      });

      it('should accept abandoned response', () => {
        const abandonedResponse = TestDataFactory.createValidResponse({
          status: ResponseStatus.ABANDONED
        });
        ValidationTestHelpers.expectValidationSuccess(QuestionnaireResponseSchema, abandonedResponse);
      });

      it('should accept response with metadata', () => {
        const responseWithMetadata = TestDataFactory.createValidResponse({
          metadata: {
            device: 'desktop',
            browser: 'Chrome',
            userAgent: 'Mozilla/5.0...'
          }
        });
        ValidationTestHelpers.expectValidationSuccess(QuestionnaireResponseSchema, responseWithMetadata);
      });

      it('should accept response without completedAt when in progress', () => {
        const inProgressResponse = TestDataFactory.createValidResponse({
          status: ResponseStatus.IN_PROGRESS
        });
        ValidationTestHelpers.expectValidationSuccess(QuestionnaireResponseSchema, inProgressResponse);
      });
    });

    describe('Invalid Cases', () => {
      it('should reject response without id', () => {
        const invalidResponse = {
          questionnaireId: 'survey-1',
          questionnaireVersion: '1.0.0',
          sessionId: 'session-123',
          startedAt: new Date().toISOString(),
          status: ResponseStatus.IN_PROGRESS,
          answers: [],
          progress: {
            currentQuestionIndex: 0,
            totalQuestions: 2,
            answeredCount: 0
          }
        };
        ValidationTestHelpers.expectValidationError(QuestionnaireResponseSchema, invalidResponse);
      });

      it('should reject response without questionnaireId', () => {
        const invalidResponse = {
          id: 'response-1',
          questionnaireVersion: '1.0.0',
          sessionId: 'session-123',
          startedAt: new Date().toISOString(),
          status: ResponseStatus.IN_PROGRESS,
          answers: [],
          progress: {
            currentQuestionIndex: 0,
            totalQuestions: 2,
            answeredCount: 0
          }
        };
        ValidationTestHelpers.expectValidationError(QuestionnaireResponseSchema, invalidResponse);
      });

      it('should reject response without sessionId', () => {
        const invalidResponse = {
          id: 'response-1',
          questionnaireId: 'survey-1',
          questionnaireVersion: '1.0.0',
          startedAt: new Date().toISOString(),
          status: ResponseStatus.IN_PROGRESS,
          answers: [],
          progress: {
            currentQuestionIndex: 0,
            totalQuestions: 2,
            answeredCount: 0
          }
        };
        ValidationTestHelpers.expectValidationError(QuestionnaireResponseSchema, invalidResponse);
      });

      it('should reject response without progress', () => {
        const invalidResponse = {
          id: 'response-1',
          questionnaireId: 'survey-1',
          questionnaireVersion: '1.0.0',
          sessionId: 'session-123',
          startedAt: new Date().toISOString(),
          status: ResponseStatus.IN_PROGRESS,
          answers: []
        };
        ValidationTestHelpers.expectValidationError(QuestionnaireResponseSchema, invalidResponse);
      });

      it('should reject response with invalid datetime', () => {
        const invalidResponse = TestDataFactory.createValidResponse({
          startedAt: 'invalid-date'
        });
        ValidationTestHelpers.expectValidationError(QuestionnaireResponseSchema, invalidResponse);
      });
    });
  });

  describe('Answer Validation', () => {
    describe('Valid Cases', () => {
      it('should accept answer with string value', () => {
        const now = new Date().toISOString();
        const responseWithStringAnswer = TestDataFactory.createValidResponse({
          answers: [
            { questionId: 'q1', value: 'text answer', answeredAt: now }
          ]
        });
        ValidationTestHelpers.expectValidationSuccess(QuestionnaireResponseSchema, responseWithStringAnswer);
      });

      it('should accept answer with number value', () => {
        const now = new Date().toISOString();
        const responseWithNumberAnswer = TestDataFactory.createValidResponse({
          answers: [
            { questionId: 'q2', value: 42, answeredAt: now }
          ]
        });
        ValidationTestHelpers.expectValidationSuccess(QuestionnaireResponseSchema, responseWithNumberAnswer);
      });

      it('should accept answer with boolean value', () => {
        const now = new Date().toISOString();
        const responseWithBooleanAnswer = TestDataFactory.createValidResponse({
          answers: [
            { questionId: 'q3', value: true, answeredAt: now }
          ]
        });
        ValidationTestHelpers.expectValidationSuccess(QuestionnaireResponseSchema, responseWithBooleanAnswer);
      });

      it('should accept answer with array value', () => {
        const now = new Date().toISOString();
        const responseWithArrayAnswer = TestDataFactory.createValidResponse({
          answers: [
            { questionId: 'q4', value: ['option1', 'option2'], answeredAt: now }
          ]
        });
        ValidationTestHelpers.expectValidationSuccess(QuestionnaireResponseSchema, responseWithArrayAnswer);
      });

      it('should accept answer with object value', () => {
        const now = new Date().toISOString();
        const responseWithObjectAnswer = TestDataFactory.createValidResponse({
          answers: [
            { questionId: 'q5', value: { rating: 5, comment: 'Great!' }, answeredAt: now }
          ]
        });
        ValidationTestHelpers.expectValidationSuccess(QuestionnaireResponseSchema, responseWithObjectAnswer);
      });
    });

    describe('Invalid Cases', () => {
      it('should reject answer without questionId', () => {
        const now = new Date().toISOString();
        const invalidResponse = TestDataFactory.createValidResponse({
          answers: [
            { value: 'answer', answeredAt: now } as any
          ]
        });
        ValidationTestHelpers.expectValidationError(QuestionnaireResponseSchema, invalidResponse);
      });

      it('should reject answer without answeredAt', () => {
        const invalidResponse = TestDataFactory.createValidResponse({
          answers: [
            { questionId: 'q1', value: 'answer' } as any
          ]
        });
        ValidationTestHelpers.expectValidationError(QuestionnaireResponseSchema, invalidResponse);
      });

      it('should reject answer with invalid datetime', () => {
        const invalidResponse = TestDataFactory.createValidResponse({
          answers: [
            { questionId: 'q1', value: 'answer', answeredAt: 'invalid-date' }
          ]
        });
        ValidationTestHelpers.expectValidationError(QuestionnaireResponseSchema, invalidResponse);
      });
    });
  });

  describe('Progress Validation', () => {
    describe('Valid Cases', () => {
      it('should accept progress at start', () => {
        const responseAtStart = TestDataFactory.createValidResponse({
          progress: {
            currentQuestionIndex: 0,
            totalQuestions: 5,
            answeredCount: 0
          }
        });
        ValidationTestHelpers.expectValidationSuccess(QuestionnaireResponseSchema, responseAtStart);
      });

      it('should accept progress in middle', () => {
        const responseInMiddle = TestDataFactory.createValidResponse({
          progress: {
            currentQuestionIndex: 3,
            totalQuestions: 5,
            answeredCount: 3
          }
        });
        ValidationTestHelpers.expectValidationSuccess(QuestionnaireResponseSchema, responseInMiddle);
      });

      it('should accept progress at end', () => {
        const responseAtEnd = TestDataFactory.createValidResponse({
          progress: {
            currentQuestionIndex: 5,
            totalQuestions: 5,
            answeredCount: 5
          }
        });
        ValidationTestHelpers.expectValidationSuccess(QuestionnaireResponseSchema, responseAtEnd);
      });
    });

    describe('Invalid Cases', () => {
      it('should reject negative currentQuestionIndex', () => {
        const invalidResponse = TestDataFactory.createValidResponse({
          progress: {
            currentQuestionIndex: -1,
            totalQuestions: 5,
            answeredCount: 0
          }
        });
        ValidationTestHelpers.expectValidationError(QuestionnaireResponseSchema, invalidResponse);
      });

      it('should reject zero totalQuestions', () => {
        const invalidResponse = TestDataFactory.createValidResponse({
          progress: {
            currentQuestionIndex: 0,
            totalQuestions: 0,
            answeredCount: 0
          }
        });
        ValidationTestHelpers.expectValidationError(QuestionnaireResponseSchema, invalidResponse);
      });

      it('should reject negative answeredCount', () => {
        const invalidResponse = TestDataFactory.createValidResponse({
          progress: {
            currentQuestionIndex: 0,
            totalQuestions: 5,
            answeredCount: -1
          }
        });
        ValidationTestHelpers.expectValidationError(QuestionnaireResponseSchema, invalidResponse);
      });

      it('should reject non-integer currentQuestionIndex', () => {
        const invalidResponse = TestDataFactory.createValidResponse({
          progress: {
            currentQuestionIndex: 2.5,
            totalQuestions: 5,
            answeredCount: 2
          }
        });
        ValidationTestHelpers.expectValidationError(QuestionnaireResponseSchema, invalidResponse);
      });
    });
  });

  describe('Response Status', () => {
    it('should accept all valid status values', () => {
      const statuses = [
        ResponseStatus.IN_PROGRESS,
        ResponseStatus.COMPLETED,
        ResponseStatus.ABANDONED
      ];

      statuses.forEach((status) => {
        const response = TestDataFactory.createValidResponse({ status });
        ValidationTestHelpers.expectValidationSuccess(QuestionnaireResponseSchema, response);
      });
    });

    it('should reject invalid status value', () => {
      const invalidResponse = TestDataFactory.createValidResponse({
        status: 'invalid_status' as any
      });
      ValidationTestHelpers.expectValidationError(QuestionnaireResponseSchema, invalidResponse);
    });
  });

  describe('Validation Functions', () => {
    describe('validateResponse', () => {
      it('should validate and return valid response', () => {
        const validResponse = TestDataFactory.createValidResponse();
        const result = validateResponse(validResponse);
        
        expect(result).toBeDefined();
        expect(result.id).toBe(validResponse.id);
        expect(result.questionnaireId).toBe(validResponse.questionnaireId);
        expect(result.status).toBe(validResponse.status);
      });

      it('should throw error for invalid response', () => {
        const invalidResponse = {
          id: 'test',
          // missing required fields
        };
        
        expect(() => validateResponse(invalidResponse)).toThrow();
      });
    });

    describe('safeValidateResponse', () => {
      it('should return success result for valid response', () => {
        const validResponse = TestDataFactory.createValidResponse();
        const result = safeValidateResponse(validResponse);
        
        expect(result.success).toBe(true);
        if (result.success) {
          expect(result.data).toBeDefined();
          expect(result.data.id).toBe(validResponse.id);
        }
      });

      it('should return error result for invalid response', () => {
        const invalidResponse = {
          id: 'test',
          // missing required fields
        };
        
        const result = safeValidateResponse(invalidResponse);
        
        expect(result.success).toBe(false);
        if (!result.success) {
          expect(result.error).toBeDefined();
        }
      });
    });

    describe('createResponse', () => {
      it('should create a valid response with minimal parameters', () => {
        const response = createResponse('questionnaire-1', '1.0.0', 'session-123', 5);
        
        expect(response).toBeDefined();
        expect(response.questionnaireId).toBe('questionnaire-1');
        expect(response.questionnaireVersion).toBe('1.0.0');
        expect(response.sessionId).toBe('session-123');
        expect(response.status).toBe(ResponseStatus.IN_PROGRESS);
        expect(response.answers).toEqual([]);
        expect(response.progress.totalQuestions).toBe(5);
        expect(response.progress.currentQuestionIndex).toBe(0);
        expect(response.progress.answeredCount).toBe(0);
      });

      it('should create response with generated IDs', () => {
        const response1 = createResponse('q1', '1.0', 'session-1', 2);
        const response2 = createResponse('q1', '1.0', 'session-2', 2);
        
        expect(response1.id).toBeDefined();
        expect(response1.sessionId).toBe('session-1');
        expect(response2.sessionId).toBe('session-2');
        expect(response1.id).not.toBe(response2.id);
      });

      it('should create response with valid timestamps', () => {
        const before = new Date().toISOString();
        const response = createResponse('q1', '1.0', 'session-1', 2);
        const after = new Date().toISOString();
        
        expect(response.startedAt).toBeDefined();
        expect(response.startedAt >= before).toBe(true);
        expect(response.startedAt <= after).toBe(true);
      });

      it('should create response that passes validation', () => {
        const response = createResponse('questionnaire-1', '1.0.0', 'session-1', 10);
        ValidationTestHelpers.expectValidationSuccess(QuestionnaireResponseSchema, response);
      });
    });
  });

  describe('Metadata Validation', () => {
    it('should accept response with custom metadata', () => {
      const responseWithMetadata = TestDataFactory.createValidResponse({
        metadata: {
          custom1: 'value1',
          custom2: 123,
          custom3: true,
          custom4: { nested: 'object' },
          custom5: ['array', 'values']
        }
      });
      ValidationTestHelpers.expectValidationSuccess(QuestionnaireResponseSchema, responseWithMetadata);
    });

    it('should accept response without metadata', () => {
      const responseWithoutMetadata = TestDataFactory.createValidResponse();
      delete (responseWithoutMetadata as any).metadata;
      ValidationTestHelpers.expectValidationSuccess(QuestionnaireResponseSchema, responseWithoutMetadata);
    });

    it('should accept response with empty metadata', () => {
      const responseWithEmptyMetadata = TestDataFactory.createValidResponse({
        metadata: {}
      });
      ValidationTestHelpers.expectValidationSuccess(QuestionnaireResponseSchema, responseWithEmptyMetadata);
    });
  });
});
