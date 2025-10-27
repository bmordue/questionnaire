import inquirer from 'inquirer';
import type { Question } from '../../../core/schema.js';
import { BaseQuestionComponent } from '../base/question-component.js';
import { MessageFormatter } from '../display/theme.js';
import type { ValidationResult, InquirerPromptConfig } from '../base/types.js';

/**
 * Single choice component for single_choice questions
 */
export class SingleChoiceComponent extends BaseQuestionComponent<string> {
  async render(question: Question, currentAnswer?: string): Promise<string> {
    const promptConfig = this.getPromptConfig(question);
    if (currentAnswer !== undefined) {
      promptConfig.default = currentAnswer;
    }

    const result = await inquirer.prompt([promptConfig]);
    
    // Handle "Other" option
    if (result.answer === '__other__' && question.type === 'single_choice') {
      const otherPrompt: any = {
        type: 'input',
        name: 'otherValue',
        message: 'Please specify:'
      };
      const otherResult = await inquirer.prompt([otherPrompt]);
      return otherResult.otherValue;
    }

    return result.answer;
  }

  validate(answer: string, question: Question): ValidationResult {
    // Check required
    const requiredResult = this.validateRequired(answer, question);
    if (!requiredResult.isValid) {
      return requiredResult;
    }

    return { isValid: true };
  }

  format(answer: string): string {
    return answer;
  }

  getPromptConfig(question: Question): InquirerPromptConfig {
    if (question.type !== 'single_choice') {
      throw new Error('SingleChoiceComponent can only be used with single_choice questions');
    }

    const choices = question.options.map(option => ({
      name: option.label,
      value: option.value
    }));

    // Add "Other" option if allowed
    if (question.type === 'single_choice' && question.validation?.allowOther) {
      choices.push({ name: 'Other (specify)', value: '__other__' });
    }

    return {
      type: 'list',
      name: 'answer',
      message: MessageFormatter.formatQuestion(
        question.text,
        question.description,
        question.required
      ),
      choices,
      pageSize: 10
    };
  }
}
