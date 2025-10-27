import type { Question } from '../../../core/schema.js';
import type { ValidationResult, InquirerPromptConfig } from './types.js';

/**
 * Base interface for question components
 * Each question type component must implement this interface
 */
export interface QuestionComponent<T = any> {
  /**
   * Render the question prompt and collect user input
   * @param question - The question to render
   * @param currentAnswer - Optional previous answer to pre-populate
   * @returns The user's answer
   */
  render(question: Question, currentAnswer?: T): Promise<T>;

  /**
   * Validate an answer against question rules
   * @param answer - The answer to validate
   * @param question - The question with validation rules
   * @returns Validation result
   */
  validate(answer: T, question: Question): ValidationResult;

  /**
   * Format an answer for display
   * @param answer - The answer to format
   * @returns Formatted string representation
   */
  format(answer: T): string;

  /**
   * Get the Inquirer prompt configuration for this question
   * @param question - The question to configure
   * @returns Inquirer prompt configuration
   */
  getPromptConfig(question: Question): InquirerPromptConfig;
}

/**
 * Abstract base class for question components
 * Provides common functionality for all component types
 */
export abstract class BaseQuestionComponent<T = any> implements QuestionComponent<T> {
  abstract render(question: Question, currentAnswer?: T): Promise<T>;
  abstract validate(answer: T, question: Question): ValidationResult;
  abstract format(answer: T): string;
  abstract getPromptConfig(question: Question): InquirerPromptConfig;

  /**
   * Check if a question is required
   */
  protected isRequired(question: Question): boolean {
    return question.required ?? false;
  }

  /**
   * Format the question message with description and required indicator
   */
  protected formatMessage(question: Question): string {
    return question.text;
  }

  /**
   * Validate that a required field has a value
   */
  protected validateRequired(answer: any, question: Question): ValidationResult {
    if (this.isRequired(question)) {
      if (answer === undefined || answer === null || answer === '') {
        return { isValid: false, message: 'This field is required' };
      }
      
      // For arrays (multiple choice), check length
      if (Array.isArray(answer) && answer.length === 0) {
        return { isValid: false, message: 'This field is required' };
      }
    }
    
    return { isValid: true };
  }
}
