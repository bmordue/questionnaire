import inquirer from 'inquirer';
import type { Question } from '../../../core/schema.js';
import { BaseQuestionComponent } from '../base/question-component.js';
import { MessageFormatter, theme } from '../display/theme.js';
import type { ValidationResult, InquirerPromptConfig } from '../base/types.js';

/**
 * Rating component for rating questions
 */
export class RatingComponent extends BaseQuestionComponent<number> {
  async render(question: Question, currentAnswer?: number): Promise<number> {
    const promptConfig = this.getPromptConfig(question);
    if (currentAnswer !== undefined) {
      promptConfig.default = currentAnswer;
    }

    const result = await inquirer.prompt([promptConfig]);
    return result.answer;
  }

  validate(answer: number, question: Question): ValidationResult {
    // Check required
    if (answer === undefined || answer === null) {
      const requiredResult = this.validateRequired(answer, question);
      if (!requiredResult.isValid) {
        return requiredResult;
      }
    }

    return { isValid: true };
  }

  format(answer: number): string {
    return answer.toString();
  }

  /**
   * Get rating label for a value
   */
  private getRatingLabel(value: number, min: number, max: number): string {
    if (value === min) return theme.error('(Poor)');
    if (value === max) return theme.success('(Excellent)');
    if (value === Math.floor((min + max) / 2)) return theme.muted('(Average)');
    return '';
  }

  getPromptConfig(question: Question): InquirerPromptConfig {
    if (question.type !== 'rating') {
      throw new Error('RatingComponent can only be used with rating questions');
    }

    const min = question.validation?.min ?? 1;
    const max = question.validation?.max ?? 5;

    const choices = [];
    for (let i = min; i <= max; i++) {
      const filledStars = theme.warning('★'.repeat(i));
      const emptyStars = theme.muted('☆'.repeat(max - i));
      const label = this.getRatingLabel(i, min, max);

      choices.push({
        name: `${filledStars}${emptyStars} ${i}${label ? ` ${label}` : ''}`,
        value: i
      });
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
