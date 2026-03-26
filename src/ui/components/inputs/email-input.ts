import inquirer from 'inquirer';
import type { Question } from '../../../core/schema.js';
import { BaseQuestionComponent } from '../base/question-component.js';
import { ValidationHelpers } from '../base/validation-helpers.js';
import { MessageFormatter, theme } from '../display/theme.js';
import type { ValidationResult, InquirerPromptConfig } from '../base/types.js';

/**
 * Email input component for email questions
 */
export class EmailInputComponent extends BaseQuestionComponent<string> {
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

    // Length validation (consistent with text input)
    if (question.type === 'email' && question.validation) {
      const lengthResult = ValidationHelpers.validateLength(
        answer,
        question.validation.minLength,
        question.validation.maxLength
      );
      if (!lengthResult.isValid) {
        return lengthResult;
      }
    }

    // Email format validation
    return ValidationHelpers.validateEmail(answer);
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
      },
      transformer: (input: string) => {
        let feedback = '';

        // Character counter (consistent with text input)
        if (question.type === 'email' && question.validation?.maxLength !== undefined) {
          const count = input.length;
          const max = question.validation.maxLength;
          const counterText = `[${count}/${max}]`;
          const counter = count > max ? theme.error(counterText) : theme.muted(counterText);
          feedback += ` ${counter}`;
        }

        // Live email format indicator
        if (input) {
          const isValidFormat = ValidationHelpers.validateEmail(input).isValid;
          const status = isValidFormat
            ? theme.success(' (Valid email format)')
            : theme.warning(' (Incomplete email)');
          feedback += status;
        }

        return `${input}${feedback}`;
      }
    };
  }
}
