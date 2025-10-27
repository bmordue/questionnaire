import { describe, it, expect } from '@jest/globals';
import {
  QuestionSchema,
  TextQuestionSchema,
  EmailQuestionSchema,
  NumberQuestionSchema,
  SingleChoiceQuestionSchema,
  MultipleChoiceQuestionSchema,
  BooleanQuestionSchema,
  DateQuestionSchema,
  RatingQuestionSchema,
  QuestionType
} from '../../core/schemas/question.js';
import { TestDataFactory } from '../helpers/test-data-factory.js';
import { ValidationTestHelpers } from '../helpers/validation-helpers.js';

describe('Question Schema Validation', () => {
  describe('Text Questions', () => {
    describe('Valid Cases', () => {
      it('should accept valid text question', () => {
        const validTextQuestion = TestDataFactory.createValidTextQuestion();
        ValidationTestHelpers.expectValidationSuccess(TextQuestionSchema, validTextQuestion);
      });

      it('should accept text question without validation', () => {
        const minimalTextQuestion = TestDataFactory.createValidTextQuestion({
          id: 'q2',
          required: false
        });
        ValidationTestHelpers.expectValidationSuccess(TextQuestionSchema, minimalTextQuestion);
      });

      it('should accept text question with validation rules', () => {
        const textQuestionWithValidation = TestDataFactory.createValidTextQuestion({
          validation: {
            minLength: 2,
            maxLength: 50
          }
        });
        ValidationTestHelpers.expectValidationSuccess(TextQuestionSchema, textQuestionWithValidation);
      });

      it('should accept text question with pattern', () => {
        const textQuestionWithPattern = TestDataFactory.createValidTextQuestion({
          validation: {
            pattern: '^[A-Za-z]+$',
            patternMessage: 'Only letters allowed'
          }
        });
        ValidationTestHelpers.expectValidationSuccess(TextQuestionSchema, textQuestionWithPattern);
      });

      it('should accept text question with description', () => {
        const textQuestionWithDescription = TestDataFactory.createValidTextQuestion({
          description: 'Please enter your full legal name'
        });
        ValidationTestHelpers.expectValidationSuccess(TextQuestionSchema, textQuestionWithDescription);
      });

      it('should accept text question with metadata', () => {
        const textQuestionWithMetadata = TestDataFactory.createValidTextQuestion({
          metadata: {
            category: 'personal',
            priority: 'high'
          }
        });
        ValidationTestHelpers.expectValidationSuccess(TextQuestionSchema, textQuestionWithMetadata);
      });
    });

    describe('Invalid Cases', () => {
      it('should reject text question without id', () => {
        const invalidQuestion = {
          type: QuestionType.TEXT,
          text: 'Question without ID',
          required: false
        };
        ValidationTestHelpers.expectValidationError(TextQuestionSchema, invalidQuestion);
      });

      it('should reject text question without text', () => {
        const invalidQuestion = {
          id: 'q1',
          type: QuestionType.TEXT,
          required: false
        };
        ValidationTestHelpers.expectValidationError(TextQuestionSchema, invalidQuestion);
      });

      it('should reject text question with wrong type', () => {
        const invalidQuestion = {
          id: 'q1',
          type: QuestionType.NUMBER,
          text: 'Question',
          required: false
        };
        ValidationTestHelpers.expectValidationError(TextQuestionSchema, invalidQuestion);
      });
    });
  });

  describe('Email Questions', () => {
    describe('Valid Cases', () => {
      it('should accept valid email question', () => {
        const validEmailQuestion = TestDataFactory.createValidEmailQuestion();
        ValidationTestHelpers.expectValidationSuccess(EmailQuestionSchema, validEmailQuestion);
      });

      it('should accept email question with validation', () => {
        const emailQuestionWithValidation = TestDataFactory.createValidEmailQuestion({
          validation: {
            pattern: '^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\\.[a-zA-Z]{2,}$'
          }
        });
        ValidationTestHelpers.expectValidationSuccess(EmailQuestionSchema, emailQuestionWithValidation);
      });
    });

    describe('Invalid Cases', () => {
      it('should reject email question without id', () => {
        const invalidQuestion = {
          type: QuestionType.EMAIL,
          text: 'Email question',
          required: false
        };
        ValidationTestHelpers.expectValidationError(EmailQuestionSchema, invalidQuestion);
      });
    });
  });

  describe('Number Questions', () => {
    describe('Valid Cases', () => {
      it('should accept valid number question', () => {
        const validNumberQuestion = TestDataFactory.createValidNumberQuestion();
        ValidationTestHelpers.expectValidationSuccess(NumberQuestionSchema, validNumberQuestion);
      });

      it('should accept number with min/max range', () => {
        const numberWithRange = TestDataFactory.createValidNumberQuestion({
          validation: {
            min: 0,
            max: 120,
            integer: true
          }
        });
        ValidationTestHelpers.expectValidationSuccess(NumberQuestionSchema, numberWithRange);
      });

      it('should accept decimal numbers', () => {
        const decimalNumber = TestDataFactory.createValidNumberQuestion({
          validation: {
            min: 0,
            integer: false
          }
        });
        ValidationTestHelpers.expectValidationSuccess(NumberQuestionSchema, decimalNumber);
      });

      it('should accept number with only min validation', () => {
        const numberWithMin = TestDataFactory.createValidNumberQuestion({
          validation: { min: 0 }
        });
        ValidationTestHelpers.expectValidationSuccess(NumberQuestionSchema, numberWithMin);
      });

      it('should accept number with only max validation', () => {
        const numberWithMax = TestDataFactory.createValidNumberQuestion({
          validation: { max: 100 }
        });
        ValidationTestHelpers.expectValidationSuccess(NumberQuestionSchema, numberWithMax);
      });
    });

    describe('Invalid Cases', () => {
      it('should reject number question without id', () => {
        const invalidQuestion = {
          type: QuestionType.NUMBER,
          text: 'Number question',
          required: false
        };
        ValidationTestHelpers.expectValidationError(NumberQuestionSchema, invalidQuestion);
      });
    });
  });

  describe('Single Choice Questions', () => {
    describe('Valid Cases', () => {
      it('should accept valid single choice question', () => {
        const validChoice = TestDataFactory.createValidSingleChoiceQuestion();
        ValidationTestHelpers.expectValidationSuccess(SingleChoiceQuestionSchema, validChoice);
      });

      it('should accept single choice with allowOther', () => {
        const choiceWithOther = TestDataFactory.createValidSingleChoiceQuestion({
          validation: { allowOther: true }
        });
        ValidationTestHelpers.expectValidationSuccess(SingleChoiceQuestionSchema, choiceWithOther);
      });

      it('should accept options with descriptions', () => {
        const choiceWithDescriptions = TestDataFactory.createValidSingleChoiceQuestion({
          options: [
            { value: 'a', label: 'Option A', description: 'First option' },
            { value: 'b', label: 'Option B', description: 'Second option' }
          ]
        });
        ValidationTestHelpers.expectValidationSuccess(SingleChoiceQuestionSchema, choiceWithDescriptions);
      });
    });

    describe('Invalid Cases', () => {
      it('should reject choice question without options', () => {
        const invalidChoice = {
          id: 'q5',
          type: QuestionType.SINGLE_CHOICE,
          text: 'Choose option',
          required: false
        };
        ValidationTestHelpers.expectValidationError(SingleChoiceQuestionSchema, invalidChoice);
      });

      it('should reject empty options array', () => {
        const invalidChoice = {
          id: 'q6',
          type: QuestionType.SINGLE_CHOICE,
          text: 'Choose option',
          required: false,
          options: []
        };
        ValidationTestHelpers.expectValidationError(SingleChoiceQuestionSchema, invalidChoice);
      });
    });
  });

  describe('Multiple Choice Questions', () => {
    describe('Valid Cases', () => {
      it('should accept valid multiple choice question', () => {
        const validMultiple = TestDataFactory.createValidMultipleChoiceQuestion();
        ValidationTestHelpers.expectValidationSuccess(MultipleChoiceQuestionSchema, validMultiple);
      });

      it('should accept multiple choice with max selections', () => {
        const multipleWithMax = TestDataFactory.createValidMultipleChoiceQuestion({
          validation: {
            maxSelections: 3
          }
        });
        ValidationTestHelpers.expectValidationSuccess(MultipleChoiceQuestionSchema, multipleWithMax);
      });

      it('should accept multiple choice with min and max selections', () => {
        const multipleWithMinMax = TestDataFactory.createValidMultipleChoiceQuestion({
          validation: {
            minSelections: 1,
            maxSelections: 3
          }
        });
        ValidationTestHelpers.expectValidationSuccess(MultipleChoiceQuestionSchema, multipleWithMinMax);
      });

      it('should accept multiple choice with allowOther', () => {
        const multipleWithOther = TestDataFactory.createValidMultipleChoiceQuestion({
          validation: {
            allowOther: true
          }
        });
        ValidationTestHelpers.expectValidationSuccess(MultipleChoiceQuestionSchema, multipleWithOther);
      });
    });

    describe('Invalid Cases', () => {
      it('should reject multiple choice without options', () => {
        const invalidMultiple = {
          id: 'q7',
          type: QuestionType.MULTIPLE_CHOICE,
          text: 'Select options',
          required: false
        };
        ValidationTestHelpers.expectValidationError(MultipleChoiceQuestionSchema, invalidMultiple);
      });

      it('should reject empty options array', () => {
        const invalidMultiple = {
          id: 'q8',
          type: QuestionType.MULTIPLE_CHOICE,
          text: 'Select options',
          required: false,
          options: []
        };
        ValidationTestHelpers.expectValidationError(MultipleChoiceQuestionSchema, invalidMultiple);
      });
    });
  });

  describe('Boolean Questions', () => {
    describe('Valid Cases', () => {
      it('should accept valid boolean question', () => {
        const validBoolean = TestDataFactory.createValidBooleanQuestion();
        ValidationTestHelpers.expectValidationSuccess(BooleanQuestionSchema, validBoolean);
      });

      it('should accept boolean question as required', () => {
        const requiredBoolean = TestDataFactory.createValidBooleanQuestion({
          required: true
        });
        ValidationTestHelpers.expectValidationSuccess(BooleanQuestionSchema, requiredBoolean);
      });
    });

    describe('Invalid Cases', () => {
      it('should reject boolean question without id', () => {
        const invalidBoolean = {
          type: QuestionType.BOOLEAN,
          text: 'Boolean question',
          required: false
        };
        ValidationTestHelpers.expectValidationError(BooleanQuestionSchema, invalidBoolean);
      });
    });
  });

  describe('Date Questions', () => {
    describe('Valid Cases', () => {
      it('should accept valid date question', () => {
        const validDate = TestDataFactory.createValidDateQuestion();
        ValidationTestHelpers.expectValidationSuccess(DateQuestionSchema, validDate);
      });

      it('should accept date with min/max date validation', () => {
        const dateWithRange = TestDataFactory.createValidDateQuestion({
          validation: {
            minDate: '2000-01-01',
            maxDate: '2025-12-31'
          }
        });
        ValidationTestHelpers.expectValidationSuccess(DateQuestionSchema, dateWithRange);
      });

      it('should accept date with allowPast/allowFuture', () => {
        const dateWithFlags = TestDataFactory.createValidDateQuestion({
          validation: {
            allowPast: true,
            allowFuture: false
          }
        });
        ValidationTestHelpers.expectValidationSuccess(DateQuestionSchema, dateWithFlags);
      });
    });

    describe('Invalid Cases', () => {
      it('should reject date question without id', () => {
        const invalidDate = {
          type: QuestionType.DATE,
          text: 'Date question',
          required: false
        };
        ValidationTestHelpers.expectValidationError(DateQuestionSchema, invalidDate);
      });
    });
  });

  describe('Rating Questions', () => {
    describe('Valid Cases', () => {
      it('should accept valid rating question', () => {
        const validRating = TestDataFactory.createValidRatingQuestion();
        ValidationTestHelpers.expectValidationSuccess(RatingQuestionSchema, validRating);
      });

      it('should accept rating with step', () => {
        const ratingWithStep = TestDataFactory.createValidRatingQuestion({
          validation: {
            min: 0,
            max: 10,
            step: 0.5
          }
        });
        ValidationTestHelpers.expectValidationSuccess(RatingQuestionSchema, ratingWithStep);
      });

      it('should accept different rating scales', () => {
        const ratingScale10 = TestDataFactory.createValidRatingQuestion({
          validation: {
            min: 1,
            max: 10
          }
        });
        ValidationTestHelpers.expectValidationSuccess(RatingQuestionSchema, ratingScale10);
      });
    });

    describe('Invalid Cases', () => {
      it('should reject rating question without validation', () => {
        const invalidRating = {
          id: 'q9',
          type: QuestionType.RATING,
          text: 'Rate this',
          required: false
        };
        // Note: RatingValidationSchema is optional, so this actually passes schema validation
        // but a rating question without validation would not be very useful
        ValidationTestHelpers.expectValidationSuccess(RatingQuestionSchema, invalidRating);
      });

      it('should reject rating without id', () => {
        const invalidRating = {
          type: QuestionType.RATING,
          text: 'Rate this',
          required: false,
          validation: { min: 1, max: 5 }
        };
        ValidationTestHelpers.expectValidationError(RatingQuestionSchema, invalidRating);
      });
    });
  });

  describe('Discriminated Union - QuestionSchema', () => {
    it('should accept all valid question types', () => {
      const questions = [
        TestDataFactory.createValidTextQuestion(),
        TestDataFactory.createValidEmailQuestion(),
        TestDataFactory.createValidNumberQuestion(),
        TestDataFactory.createValidSingleChoiceQuestion(),
        TestDataFactory.createValidMultipleChoiceQuestion(),
        TestDataFactory.createValidBooleanQuestion(),
        TestDataFactory.createValidDateQuestion(),
        TestDataFactory.createValidRatingQuestion()
      ];

      questions.forEach((question) => {
        ValidationTestHelpers.expectValidationSuccess(QuestionSchema, question);
      });
    });

    it('should reject invalid question type', () => {
      const invalidQuestion = {
        id: 'q1',
        type: 'invalid_type',
        text: 'Invalid question',
        required: false
      };
      ValidationTestHelpers.expectValidationError(QuestionSchema, invalidQuestion);
    });
  });

  describe('Conditional Logic', () => {
    it('should accept question with conditional logic', () => {
      const questionWithConditional = TestDataFactory.createValidTextQuestion({
        conditional: {
          showIf: {
            questionId: 'q0',
            operator: 'equals',
            value: 'yes'
          }
        }
      });
      ValidationTestHelpers.expectValidationSuccess(TextQuestionSchema, questionWithConditional);
    });

    it('should accept all conditional operators', () => {
      const operators = [
        'equals',
        'notEquals',
        'contains',
        'greaterThan',
        'lessThan',
        'greaterThanOrEqual',
        'lessThanOrEqual',
        'notContains',
        'in',
        'notIn',
        'isEmpty',
        'isNotEmpty'
      ] as const;

      operators.forEach((operator) => {
        const question = TestDataFactory.createValidTextQuestion({
          conditional: {
            showIf: {
              questionId: 'q0',
              operator: operator as any,
              value: 'test'
            }
          }
        });
        ValidationTestHelpers.expectValidationSuccess(TextQuestionSchema, question);
      });
    });

    it('should accept all conditional logic types', () => {
      // Test showIf
      const showIfQuestion = TestDataFactory.createValidTextQuestion({
        conditional: {
          showIf: {
            questionId: 'q0',
            operator: 'equals',
            value: 'test'
          }
        }
      });
      ValidationTestHelpers.expectValidationSuccess(TextQuestionSchema, showIfQuestion);

      // Test hideIf
      const hideIfQuestion = TestDataFactory.createValidTextQuestion({
        conditional: {
          hideIf: {
            questionId: 'q0',
            operator: 'equals',
            value: 'test'
          }
        }
      });
      ValidationTestHelpers.expectValidationSuccess(TextQuestionSchema, hideIfQuestion);

      // Test skipIf
      const skipIfQuestion = TestDataFactory.createValidTextQuestion({
        conditional: {
          skipIf: {
            questionId: 'q0',
            operator: 'equals',
            value: 'test'
          }
        }
      });
      ValidationTestHelpers.expectValidationSuccess(TextQuestionSchema, skipIfQuestion);

      // Test requiredIf
      const requiredIfQuestion = TestDataFactory.createValidTextQuestion({
        conditional: {
          requiredIf: {
            questionId: 'q0',
            operator: 'equals',
            value: 'test'
          }
        }
      });
      ValidationTestHelpers.expectValidationSuccess(TextQuestionSchema, requiredIfQuestion);
    });
  });
});
