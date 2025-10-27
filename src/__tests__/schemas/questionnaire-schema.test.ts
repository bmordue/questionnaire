import { describe, it, expect } from '@jest/globals';
import {
  QuestionnaireSchema,
  QuestionnaireMetadataSchema,
  QuestionnaireConfigSchema,
  validateQuestionnaire,
  safeValidateQuestionnaire
} from '../../core/schemas/questionnaire.js';
import { TestDataFactory } from '../helpers/test-data-factory.js';
import { ValidationTestHelpers } from '../helpers/validation-helpers.js';

describe('Questionnaire Schema Validation', () => {
  describe('Questionnaire Metadata', () => {
    describe('Valid Cases', () => {
      it('should accept valid metadata', () => {
        const now = new Date().toISOString();
        const validMetadata = {
          title: 'Customer Survey',
          description: 'Please provide feedback',
          author: 'Test Author',
          createdAt: now,
          updatedAt: now,
          tags: ['customer', 'feedback']
        };
        ValidationTestHelpers.expectValidationSuccess(QuestionnaireMetadataSchema, validMetadata);
      });

      it('should accept metadata without optional fields', () => {
        const now = new Date().toISOString();
        const minimalMetadata = {
          title: 'Survey',
          createdAt: now,
          updatedAt: now
        };
        ValidationTestHelpers.expectValidationSuccess(QuestionnaireMetadataSchema, minimalMetadata);
      });

      it('should accept metadata with empty tags array', () => {
        const now = new Date().toISOString();
        const metadataWithEmptyTags = {
          title: 'Survey',
          createdAt: now,
          updatedAt: now,
          tags: []
        };
        ValidationTestHelpers.expectValidationSuccess(QuestionnaireMetadataSchema, metadataWithEmptyTags);
      });
    });

    describe('Invalid Cases', () => {
      it('should reject metadata without title', () => {
        const now = new Date().toISOString();
        const invalidMetadata = {
          createdAt: now,
          updatedAt: now
        };
        ValidationTestHelpers.expectValidationError(QuestionnaireMetadataSchema, invalidMetadata);
      });

      it('should reject metadata with invalid datetime', () => {
        const invalidMetadata = {
          title: 'Survey',
          createdAt: 'invalid-date',
          updatedAt: new Date().toISOString()
        };
        ValidationTestHelpers.expectValidationError(QuestionnaireMetadataSchema, invalidMetadata);
      });

      it('should reject metadata without createdAt', () => {
        const invalidMetadata = {
          title: 'Survey',
          updatedAt: new Date().toISOString()
        };
        ValidationTestHelpers.expectValidationError(QuestionnaireMetadataSchema, invalidMetadata);
      });

      it('should reject metadata without updatedAt', () => {
        const invalidMetadata = {
          title: 'Survey',
          createdAt: new Date().toISOString()
        };
        ValidationTestHelpers.expectValidationError(QuestionnaireMetadataSchema, invalidMetadata);
      });
    });
  });

  describe('Questionnaire Config', () => {
    describe('Valid Cases', () => {
      it('should accept valid config', () => {
        const validConfig = {
          allowBack: true,
          allowSkip: false,
          shuffleQuestions: false,
          showProgress: true
        };
        ValidationTestHelpers.expectValidationSuccess(QuestionnaireConfigSchema, validConfig);
      });

      it('should accept empty config (uses defaults)', () => {
        const emptyConfig = {};
        ValidationTestHelpers.expectValidationSuccess(QuestionnaireConfigSchema, emptyConfig);
      });

      it('should accept partial config', () => {
        const partialConfig = {
          allowBack: false,
          showProgress: true
        };
        ValidationTestHelpers.expectValidationSuccess(QuestionnaireConfigSchema, partialConfig);
      });
    });

    describe('Invalid Cases', () => {
      it('should reject config with invalid boolean values', () => {
        const invalidConfig = {
          allowBack: 'true' // should be boolean, not string
        };
        ValidationTestHelpers.expectValidationError(QuestionnaireConfigSchema, invalidConfig);
      });
    });
  });

  describe('Complete Questionnaire', () => {
    describe('Valid Cases', () => {
      it('should accept complete valid questionnaire', () => {
        const validQuestionnaire = TestDataFactory.createValidQuestionnaire();
        ValidationTestHelpers.expectValidationSuccess(QuestionnaireSchema, validQuestionnaire);
      });

      it('should accept questionnaire with single question', () => {
        const singleQuestionQuestionnaire = TestDataFactory.createValidQuestionnaire({
          questions: [TestDataFactory.createValidTextQuestion({ id: 'q1' })]
        });
        ValidationTestHelpers.expectValidationSuccess(QuestionnaireSchema, singleQuestionQuestionnaire);
      });

      it('should accept questionnaire with multiple question types', () => {
        const multiTypeQuestionnaire = TestDataFactory.createValidQuestionnaire({
          questions: [
            TestDataFactory.createValidTextQuestion({ id: 'q1' }),
            TestDataFactory.createValidNumberQuestion({ id: 'q2' }),
            TestDataFactory.createValidEmailQuestion({ id: 'q3' }),
            TestDataFactory.createValidSingleChoiceQuestion({ id: 'q4' }),
            TestDataFactory.createValidBooleanQuestion({ id: 'q5' })
          ]
        });
        ValidationTestHelpers.expectValidationSuccess(QuestionnaireSchema, multiTypeQuestionnaire);
      });

      it('should accept questionnaire with config', () => {
        const questionnaireWithConfig = TestDataFactory.createValidQuestionnaire({
          config: {
            allowBack: false,
            allowSkip: true,
            shuffleQuestions: true,
            showProgress: false
          }
        });
        ValidationTestHelpers.expectValidationSuccess(QuestionnaireSchema, questionnaireWithConfig);
      });

      it('should accept questionnaire without config', () => {
        const questionnaireWithoutConfig = TestDataFactory.createValidQuestionnaire();
        delete (questionnaireWithoutConfig as any).config;
        ValidationTestHelpers.expectValidationSuccess(QuestionnaireSchema, questionnaireWithoutConfig);
      });
    });

    describe('Invalid Cases', () => {
      it('should reject questionnaire without id', () => {
        const invalidQuestionnaire = {
          version: '1.0.0',
          metadata: {
            title: 'Survey',
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString()
          },
          questions: [TestDataFactory.createValidTextQuestion()]
        };
        ValidationTestHelpers.expectValidationError(QuestionnaireSchema, invalidQuestionnaire);
      });

      it('should reject questionnaire without version', () => {
        const invalidQuestionnaire = {
          id: 'survey-1',
          metadata: {
            title: 'Survey',
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString()
          },
          questions: [TestDataFactory.createValidTextQuestion()]
        };
        ValidationTestHelpers.expectValidationError(QuestionnaireSchema, invalidQuestionnaire);
      });

      it('should reject questionnaire without metadata', () => {
        const invalidQuestionnaire = {
          id: 'survey-1',
          version: '1.0.0',
          questions: [TestDataFactory.createValidTextQuestion()]
        };
        ValidationTestHelpers.expectValidationError(QuestionnaireSchema, invalidQuestionnaire);
      });

      it('should reject questionnaire without questions', () => {
        const now = new Date().toISOString();
        const invalidQuestionnaire = {
          id: 'survey-1',
          version: '1.0.0',
          metadata: {
            title: 'Survey',
            createdAt: now,
            updatedAt: now
          }
        };
        ValidationTestHelpers.expectValidationError(QuestionnaireSchema, invalidQuestionnaire);
      });

      it('should reject questionnaire with empty questions array', () => {
        const now = new Date().toISOString();
        const invalidQuestionnaire = {
          id: 'survey-1',
          version: '1.0.0',
          metadata: {
            title: 'Survey',
            createdAt: now,
            updatedAt: now
          },
          questions: []
        };
        ValidationTestHelpers.expectValidationError(QuestionnaireSchema, invalidQuestionnaire);
      });

      it('should reject questionnaire with invalid question', () => {
        const now = new Date().toISOString();
        const invalidQuestionnaire = {
          id: 'survey-1',
          version: '1.0.0',
          metadata: {
            title: 'Survey',
            createdAt: now,
            updatedAt: now
          },
          questions: [
            {
              id: 'q1',
              type: 'invalid_type',
              text: 'Invalid question'
            }
          ]
        };
        ValidationTestHelpers.expectValidationError(QuestionnaireSchema, invalidQuestionnaire);
      });
    });
  });

  describe('Validation Functions', () => {
    describe('validateQuestionnaire', () => {
      it('should validate and return valid questionnaire', () => {
        const validQuestionnaire = TestDataFactory.createValidQuestionnaire();
        const result = validateQuestionnaire(validQuestionnaire);
        
        expect(result).toBeDefined();
        expect(result.id).toBe(validQuestionnaire.id);
        expect(result.version).toBe(validQuestionnaire.version);
        expect(result.questions.length).toBe(validQuestionnaire.questions.length);
      });

      it('should throw error for invalid questionnaire', () => {
        const invalidQuestionnaire = {
          id: 'test',
          // missing required fields
        };
        
        expect(() => validateQuestionnaire(invalidQuestionnaire)).toThrow();
      });
    });

    describe('safeValidateQuestionnaire', () => {
      it('should return success result for valid questionnaire', () => {
        const validQuestionnaire = TestDataFactory.createValidQuestionnaire();
        const result = safeValidateQuestionnaire(validQuestionnaire);
        
        expect(result.success).toBe(true);
        if (result.success) {
          expect(result.data).toBeDefined();
          expect(result.data.id).toBe(validQuestionnaire.id);
        }
      });

      it('should return error result for invalid questionnaire', () => {
        const invalidQuestionnaire = {
          id: 'test',
          // missing required fields
        };
        
        const result = safeValidateQuestionnaire(invalidQuestionnaire);
        
        expect(result.success).toBe(false);
        if (!result.success) {
          expect(result.error).toBeDefined();
        }
      });
    });
  });

  describe('Question ID Uniqueness', () => {
    it('should accept questionnaire with unique question IDs', () => {
      const questionnaire = TestDataFactory.createValidQuestionnaire({
        questions: [
          TestDataFactory.createValidTextQuestion({ id: 'q1' }),
          TestDataFactory.createValidTextQuestion({ id: 'q2' }),
          TestDataFactory.createValidTextQuestion({ id: 'q3' })
        ]
      });
      
      ValidationTestHelpers.expectValidationSuccess(QuestionnaireSchema, questionnaire);
    });

    // Note: The current schema doesn't enforce unique IDs at the schema level
    // This would need to be enforced at a higher level or with a custom refinement
    it('should note that duplicate IDs are not caught by schema validation', () => {
      const questionnaireWithDuplicateIds = TestDataFactory.createValidQuestionnaire({
        questions: [
          TestDataFactory.createValidTextQuestion({ id: 'q1' }),
          TestDataFactory.createValidTextQuestion({ id: 'q1' }) // Duplicate ID
        ]
      });
      
      // Currently passes schema validation - duplicate checking would need to be added
      ValidationTestHelpers.expectValidationSuccess(QuestionnaireSchema, questionnaireWithDuplicateIds);
    });
  });

  describe('Version Format', () => {
    it('should accept various version formats', () => {
      const versions = ['1.0.0', '2.1.3', 'v1.0', '1.0', '1', 'alpha', 'beta-1'];
      
      versions.forEach((version) => {
        const questionnaire = TestDataFactory.createValidQuestionnaire({ version });
        ValidationTestHelpers.expectValidationSuccess(QuestionnaireSchema, questionnaire);
      });
    });

    it('should accept empty version string', () => {
      // Note: The current schema doesn't enforce a minimum length for version
      const questionnaire = TestDataFactory.createValidQuestionnaire({ version: '' });
      ValidationTestHelpers.expectValidationSuccess(QuestionnaireSchema, questionnaire);
    });
  });
});
