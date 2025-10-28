import inquirer from 'inquirer';
import type { Question } from '../../../core/schema.js';
import { BaseQuestionComponent } from '../base/question-component.js';
import { ValidationHelpers } from '../base/validation-helpers.js';
import { MessageFormatter } from '../display/theme.js';
import type { ValidationResult, InquirerPromptConfig } from '../base/types.js';

/**
 * Text input component for text questions
 */
export class TextInputComponent extends BaseQuestionComponent<string> {
  async render(question: Question, currentAnswer?: string): Promise<string> {
    const promptConfig = this.getPromptConfig(question);
    if (currentAnswer !== undefined) {
      promptConfig.default = currentAnswer;
    }

    const result = await inquirer.prompt([promptConfig]);
    return result.answer;
  }

  validate(answer: string, question: Question): ValidationResult {
    // Check required
    const requiredResult = this.validateRequired(answer, question);
    if (!requiredResult.isValid) {
      return requiredResult;
    }

    // If not required and empty, skip other validations
    if (!answer && !this.isRequired(question)) {
      return { isValid: true };
    }

    // Text-specific validation
    if (question.type === 'text' && question.validation) {
      const validation = question.validation;

      // Length validation
      const lengthResult = ValidationHelpers.validateLength(
        answer,
        validation.minLength,
        validation.maxLength
      );
      if (!lengthResult.isValid) {
        return lengthResult;
      }

      // Pattern validation
      if (validation.pattern) {
        const patternResult = ValidationHelpers.validatePattern(
          answer,
          validation.pattern,
          validation.patternMessage
        );
        if (!patternResult.isValid) {
          return patternResult;
        }
      }
    }

    return { isValid: true };
  }

  format(answer: string): string {
    return answer;
  }

  getPromptConfig(question: Question): InquirerPromptConfig {
    return {
      type: 'input',
      name: 'answer',
      message: MessageFormatter.formatQuestion(
        question.text,
        question.description,
        question.required
      ),
      validate: (input: string) => {
        const result = this.validate(input, question);
        return result.isValid ? true : MessageFormatter.formatError(result.message || 'Invalid input');
      }
    };
  }
}
