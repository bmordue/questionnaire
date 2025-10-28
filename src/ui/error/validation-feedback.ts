import inquirer from 'inquirer';
import type { ValidationResult } from '../../core/validation/types.js';
import type { Question } from '../../core/schemas/question.js';
import { ErrorDisplayComponent } from './error-display.js';

/**
 * Manager for providing validation feedback to users
 */
export class ValidationFeedbackManager {
  private errorDisplay: ErrorDisplayComponent;

  constructor() {
    this.errorDisplay = new ErrorDisplayComponent();
  }

  /**
   * Show validation feedback for a question
   */
  async showValidationFeedback(
    result: ValidationResult,
    question: Question,
    options?: {
      allowRetry?: boolean;
      showWarnings?: boolean;
    }
  ): Promise<boolean> {
    const { allowRetry = true, showWarnings = true } = options || {};

    // Show errors and warnings
    if (!result.isValid || (showWarnings && result.warnings.length > 0)) {
      const feedback = this.errorDisplay.render(
        result.errors,
        showWarnings ? result.warnings : []
      );
      console.log(feedback);

      // If invalid and retry is allowed, ask user if they want to retry
      if (!result.isValid && allowRetry) {
        const answer = await inquirer.prompt([{
          type: 'confirm',
          name: 'retry',
          message: 'Would you like to correct your answer?',
          default: true
        }]);

        return answer.retry;
      }
    }

    return false;
  }

  /**
   * Show validation results for multiple questions
   */
  showBatchValidation(
    results: Map<string, ValidationResult>,
    questions: Map<string, Question>
  ): void {
    let totalErrors = 0;
    let totalWarnings = 0;

    // Count totals
    for (const [questionId, result] of results.entries()) {
      totalErrors += result.errors.length;
      totalWarnings += result.warnings.length;
    }

    // Show summary
    console.log(this.errorDisplay.renderSummary(totalErrors, totalWarnings));

    // Show details for each failed question
    for (const [questionId, result] of results.entries()) {
      if (!result.isValid) {
        const question = questions.get(questionId);
        const questionText = question?.text || questionId;
        
        console.log(`\nQuestion: ${questionText}`);
        console.log(this.errorDisplay.render(result.errors, []));
      }
    }
  }

  /**
   * Show inline validation hint
   */
  showInlineHint(result: ValidationResult): string {
    if (!result.isValid && result.errors.length > 0) {
      return this.errorDisplay.renderInline(result.errors[0]!);
    }
    
    if (result.warnings.length > 0) {
      return this.errorDisplay.renderInlineWarning(result.warnings[0]!);
    }
    
    return '';
  }

  /**
   * Show detailed error information
   */
  showDetailedErrors(errors: import('../../core/validation/types.js').ValidationError[]): void {
    if (errors.length === 0) {
      console.log(this.errorDisplay.renderSummary(0, 0));
      return;
    }

    console.log(this.errorDisplay.renderNumbered(errors));
    
    // Show detailed view for each error
    errors.forEach(error => {
      console.log(this.errorDisplay.renderDetailed(error));
    });
  }

  /**
   * Show progress indicator with validation status
   */
  showProgress(
    validatedCount: number,
    totalCount: number,
    errorCount: number
  ): void {
    const percentage = Math.round((validatedCount / totalCount) * 100);
    const status = errorCount === 0 ? '✓' : '✗';
    
    console.log(`\n${status} Progress: ${validatedCount}/${totalCount} (${percentage}%)`);
    
    if (errorCount > 0) {
      console.log(this.errorDisplay.renderSummary(errorCount, 0));
    }
  }
}
