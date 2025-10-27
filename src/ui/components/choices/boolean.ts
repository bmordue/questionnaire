import inquirer from 'inquirer';
import type { Question } from '../../../core/schema.js';
import { BaseQuestionComponent } from '../base/question-component.js';
import { MessageFormatter } from '../display/theme.js';
import type { ValidationResult, InquirerPromptConfig } from '../base/types.js';

/**
 * Boolean component for boolean questions (Yes/No)
 */
export class BooleanComponent extends BaseQuestionComponent<boolean> {
  async render(question: Question, currentAnswer?: boolean): Promise<boolean> {
    const promptConfig = this.getPromptConfig(question);
    if (currentAnswer !== undefined) {
      promptConfig.default = currentAnswer;
    }

    const result = await inquirer.prompt([promptConfig]);
    return result.answer;
  }

  validate(answer: boolean, question: Question): ValidationResult {
    // Boolean values are always valid once selected
    // Required validation is handled by inquirer for confirm prompts
    return { isValid: true };
  }

  format(answer: boolean): string {
    return answer ? 'Yes' : 'No';
  }

  getPromptConfig(question: Question): InquirerPromptConfig {
    return {
      type: 'confirm',
      name: 'answer',
      message: MessageFormatter.formatQuestion(
        question.text,
        question.description,
        question.required
      ),
      default: false
    };
  }
}
