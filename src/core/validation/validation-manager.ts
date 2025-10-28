import { TextValidator } from './validators/text-validator.js';
import { NumberValidator } from './validators/number-validator.js';
import { ChoiceValidator } from './validators/choice-validator.js';
import { DateValidator } from './validators/date-validator.js';
import { EmailValidator } from './validators/email-validator.js';
import { RatingValidator } from './validators/rating-validator.js';
import { BooleanValidator } from './validators/boolean-validator.js';
import { CrossQuestionValidator } from './cross-validation/cross-validator.js';
import type { ValidationResult } from './types.js';
import type { Question, QuestionType, TextQuestion, NumberQuestion, MultipleChoiceQuestion, DateQuestion, EmailQuestion, RatingQuestion } from '../schemas/question.js';

/**
 * Main validation manager that coordinates all validators
 */
export class ValidationManager {
  private textValidator = new TextValidator();
  private numberValidator = new NumberValidator();
  private choiceValidator = new ChoiceValidator();
  private dateValidator = new DateValidator();
  private emailValidator = new EmailValidator();
  private ratingValidator = new RatingValidator();
  private booleanValidator = new BooleanValidator();
  private crossValidator = new CrossQuestionValidator();

  /**
   * Validate a single answer based on question type
   */
  validateAnswer(question: Question, value: any): ValidationResult {
    const type = question.type;

    switch (type) {
      case 'text': {
        const textQ = question as TextQuestion;
        const validation = textQ.validation || {};
        const rules: import('./types.js').TextValidationRules = {
          required: question.required
        };
        if (validation.minLength !== undefined) rules.minLength = validation.minLength;
        if (validation.maxLength !== undefined) rules.maxLength = validation.maxLength;
        if (validation.pattern !== undefined) rules.pattern = validation.pattern;
        if (validation.patternMessage !== undefined) rules.patternMessage = validation.patternMessage;
        return this.textValidator.validate(value, rules);
      }

      case 'number': {
        const numQ = question as NumberQuestion;
        const validation = numQ.validation || {};
        const rules: import('./types.js').NumberValidationRules = {
          required: question.required
        };
        if (validation.min !== undefined) rules.min = validation.min;
        if (validation.max !== undefined) rules.max = validation.max;
        if (validation.integer !== undefined) rules.integer = validation.integer;
        return this.numberValidator.validate(value, rules);
      }

      case 'single_choice': {
        const singleOptions = question.options?.map(opt => opt.value) || [];
        return this.choiceValidator.validate(value, {
          required: question.required,
          validOptions: singleOptions
        });
      }

      case 'multiple_choice': {
        const multiQ = question as MultipleChoiceQuestion;
        const multiOptions = question.options?.map(opt => opt.value) || [];
        const validation = multiQ.validation || {};
        const rules: import('./types.js').ChoiceValidationRules = {
          required: question.required,
          validOptions: multiOptions
        };
        if (validation.minSelections !== undefined) rules.minSelections = validation.minSelections;
        if (validation.maxSelections !== undefined) rules.maxSelections = validation.maxSelections;
        return this.choiceValidator.validate(value, rules);
      }

      case 'date': {
        const dateQ = question as DateQuestion;
        const validation = dateQ.validation || {};
        const rules: import('./types.js').DateValidationRules = {
          required: question.required
        };
        if (validation.minDate !== undefined) rules.minDate = validation.minDate;
        if (validation.maxDate !== undefined) rules.maxDate = validation.maxDate;
        return this.dateValidator.validate(value, rules);
      }

      case 'email': {
        const emailQ = question as EmailQuestion;
        return this.emailValidator.validate(value, {
          required: question.required
        });
      }

      case 'rating': {
        const ratingQ = question as RatingQuestion;
        const validation = ratingQ.validation;
        const rules: import('./types.js').RatingValidationRules = {
          required: question.required
        };
        if (validation) {
          rules.min = validation.min;
          rules.max = validation.max;
        }
        return this.ratingValidator.validate(value, rules);
      }

      case 'boolean': {
        return this.booleanValidator.validate(value, {
          required: question.required
        });
      }

      default:
        // Unknown question type - return valid by default
        return {
          isValid: true,
          errors: [],
          warnings: []
        };
    }
  }

  /**
   * Validate multiple answers across questions
   */
  validateCrossQuestions(
    responses: Map<string, any>,
    questions: Question[],
    rules: any[]
  ): ValidationResult {
    return this.crossValidator.validate(responses, questions, rules);
  }

  /**
   * Validate all answers in a response
   */
  validateAllAnswers(
    responses: Map<string, any>,
    questions: Question[]
  ): Map<string, ValidationResult> {
    const results = new Map<string, ValidationResult>();

    for (const question of questions) {
      const value = responses.get(question.id);
      const result = this.validateAnswer(question, value);
      results.set(question.id, result);
    }

    return results;
  }

  /**
   * Check if all validations are passing
   */
  isAllValid(validationResults: Map<string, ValidationResult>): boolean {
    for (const result of validationResults.values()) {
      if (!result.isValid) {
        return false;
      }
    }
    return true;
  }

  /**
   * Get all errors from validation results
   */
  getAllErrors(validationResults: Map<string, ValidationResult>): Array<{ questionId: string; result: ValidationResult }> {
    const errors = [];
    for (const [questionId, result] of validationResults.entries()) {
      if (!result.isValid) {
        errors.push({ questionId, result });
      }
    }
    return errors;
  }
}
