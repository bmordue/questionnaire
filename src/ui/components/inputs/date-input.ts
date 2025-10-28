import inquirer from 'inquirer';
import type { Question } from '../../../core/schema.js';
import { BaseQuestionComponent } from '../base/question-component.js';
import { ValidationHelpers } from '../base/validation-helpers.js';
import { MessageFormatter } from '../display/theme.js';
import type { ValidationResult, InquirerPromptConfig } from '../base/types.js';

/**
 * Date input component for date questions
 */
export class DateInputComponent extends BaseQuestionComponent<string> {
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

    // If not required and empty, skip date validation
    if (!answer && !this.isRequired(question)) {
      return { isValid: true };
    }

    // Date format validation
    const formatResult = ValidationHelpers.validateDateFormat(answer);
    if (!formatResult.isValid) {
      return formatResult;
    }

    // Date-specific validation
    if (question.type === 'date' && question.validation) {
      const validation = question.validation;
      const date = new Date(answer);

      // Handle 'today' as minDate
      let minDate = validation.minDate;
      if (minDate === 'today') {
        minDate = new Date().toISOString().split('T')[0];
      }

      // Date range validation
      const rangeResult = ValidationHelpers.validateDateRange(
        date,
        minDate,
        validation.maxDate
      );
      if (!rangeResult.isValid) {
        return rangeResult;
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
        `${question.text} (YYYY-MM-DD)`,
        question.description,
        question.required
      ),
      validate: (input: string) => {
        const result = this.validate(input, question);
        return result.isValid ? true : MessageFormatter.formatError(result.message || 'Invalid input');
      },
      transformer: (input: string) => {
        // Show formatted date if valid
        if (input && /^\d{4}-\d{2}-\d{2}$/.test(input)) {
          const date = new Date(input);
          if (!isNaN(date.getTime())) {
            return `${input} (${date.toLocaleDateString()})`;
          }
        }
        return input;
      }
    };
  }
}
