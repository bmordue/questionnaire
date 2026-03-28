import inquirer from 'inquirer';
import type { Question } from '../../../core/schema.js';
import { BaseQuestionComponent } from '../base/question-component.js';
import { MessageFormatter, theme } from '../display/theme.js';
import type { ValidationResult, InquirerPromptConfig } from '../base/types.js';

/**
 * Multiple choice component for multiple_choice questions
 */
export class MultipleChoiceComponent extends BaseQuestionComponent<string[]> {
  async render(question: Question, currentAnswer?: string[]): Promise<string[]> {
    const promptConfig = this.getPromptConfig(question);
    
    // Set default checked state based on current answer
    if (currentAnswer !== undefined && Array.isArray(currentAnswer)) {
      const choices = promptConfig.choices as any[];
      choices.forEach(choice => {
        if (currentAnswer.includes(choice.value)) {
          choice.checked = true;
        }
      });
    }

    const result = await inquirer.prompt([promptConfig]);
    return result.answer;
  }

  validate(answer: string[], question: Question): ValidationResult {
    // Check required
    const requiredResult = this.validateRequired(answer, question);
    if (!requiredResult.isValid) {
      return requiredResult;
    }

    // Multiple choice specific validation
    if (question.type === 'multiple_choice' && question.validation) {
      const validation = question.validation;

      if (validation.minSelections !== undefined && answer.length < validation.minSelections) {
        return {
          isValid: false,
          message: `Please select at least ${validation.minSelections} option${validation.minSelections > 1 ? 's' : ''}`
        };
      }

      if (validation.maxSelections !== undefined && answer.length > validation.maxSelections) {
        return {
          isValid: false,
          message: `Please select no more than ${validation.maxSelections} option${validation.maxSelections > 1 ? 's' : ''}`
        };
      }
    }

    return { isValid: true };
  }

  format(answer: string[]): string {
    return answer.join(', ');
  }

  getPromptConfig(question: Question): InquirerPromptConfig {
    if (question.type !== 'multiple_choice') {
      throw new Error('MultipleChoiceComponent can only be used with multiple_choice questions');
    }

    const choices = question.options.map(option => ({
      name: option.label,
      value: option.value,
      checked: false
    }));

    const validation = question.validation;
    let hint = '';
    if (validation) {
      if (validation.minSelections !== undefined && validation.maxSelections !== undefined) {
        if (validation.minSelections === validation.maxSelections) {
          hint = `(Select exactly ${validation.minSelections})`;
        } else {
          hint = `(Select ${validation.minSelections} to ${validation.maxSelections})`;
        }
      } else if (validation.minSelections !== undefined) {
        hint = `(Select at least ${validation.minSelections})`;
      } else if (validation.maxSelections !== undefined) {
        hint = `(Select up to ${validation.maxSelections})`;
      }
    }

    const description = question.description
      ? hint
        ? `${question.description} ${theme.info(hint)}`
        : question.description
      : hint
        ? theme.info(hint)
        : undefined;

    return {
      type: 'checkbox',
      name: 'answer',
      message: MessageFormatter.formatQuestion(
        question.text,
        description,
        question.required
      ),
      choices,
      validate: (input: string[]) => {
        const result = this.validate(input, question);
        return result.isValid ? true : MessageFormatter.formatError(result.message || 'Invalid selection');
      }
    };
  }
}
