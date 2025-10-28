import inquirer from 'inquirer';
import type { Question } from '../../../core/schema.js';
import { BaseQuestionComponent } from '../base/question-component.js';
import { ValidationHelpers } from '../base/validation-helpers.js';
import { MessageFormatter } from '../display/theme.js';
import type { ValidationResult, InquirerPromptConfig } from '../base/types.js';

/**
 * Number input component for number questions
 */
export class NumberInputComponent extends BaseQuestionComponent<number> {
  async render(question: Question, currentAnswer?: number): Promise<number> {
    const promptConfig = this.getPromptConfig(question);
    if (currentAnswer !== undefined) {
      promptConfig.default = currentAnswer.toString();
    }

    const result = await inquirer.prompt([promptConfig]);
    return result.answer;
  }

  validate(answer: string | number, question: Question): ValidationResult {
    // Convert to number if string
    const num = typeof answer === 'string' ? parseFloat(answer) : answer;

    // Check if it's a valid number
    if (isNaN(num)) {
      return { isValid: false, message: 'Please enter a valid number' };
    }

    // Check required (for empty string input)
    if (typeof answer === 'string' && !answer) {
      const requiredResult = this.validateRequired(answer, question);
      if (!requiredResult.isValid) {
        return requiredResult;
      }
    }

    // Number-specific validation
    if (question.type === 'number' && question.validation) {
      const validation = question.validation;

      // Integer validation
      if (validation.integer) {
        const intResult = ValidationHelpers.validateInteger(num);
        if (!intResult.isValid) {
          return intResult;
        }
      }

      // Range validation
      const rangeResult = ValidationHelpers.validateRange(
        num,
        validation.min,
        validation.max
      );
      if (!rangeResult.isValid) {
        return rangeResult;
      }
    }

    return { isValid: true };
  }

  format(answer: number): string {
    return answer.toString();
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
      },
      filter: (input: string) => {
        const num = parseFloat(input);
        return isNaN(num) ? input : num;
      }
    };
  }
}
