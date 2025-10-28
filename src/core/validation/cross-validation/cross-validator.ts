import type {
  ValidationResult,
  ValidationError,
  CrossValidationRule,
  DependencyRule,
  ConsistencyRule,
  CompletenessRule
} from '../types.js';
import type { Question } from '../../schemas/question.js';

/**
 * Cross-question validator for handling relationships between questions
 */
export class CrossQuestionValidator {
  /**
   * Validate responses against cross-validation rules
   */
  validate(
    responses: Map<string, any>,
    questions: Question[],
    rules: CrossValidationRule[]
  ): ValidationResult {
    const errors: ValidationError[] = [];
    const warnings = [];

    for (const rule of rules) {
      const result = this.evaluateRule(rule, responses, questions);
      if (!result.isValid) {
        errors.push(...result.errors);
        warnings.push(...result.warnings);
      }
    }

    return {
      isValid: errors.length === 0,
      errors,
      warnings
    };
  }

  /**
   * Evaluate a single cross-validation rule
   */
  private evaluateRule(
    rule: CrossValidationRule,
    responses: Map<string, any>,
    questions: Question[]
  ): ValidationResult {
    switch (rule.type) {
      case 'dependency':
        return this.validateDependency(rule as DependencyRule, responses);

      case 'consistency':
        return this.validateConsistency(rule as ConsistencyRule, responses);

      case 'completeness':
        return this.validateCompleteness(rule as CompletenessRule, responses, questions);

      default:
        return { isValid: true, errors: [], warnings: [] };
    }
  }

  /**
   * Validate dependency rules (answer A requires answer B)
   */
  private validateDependency(
    rule: DependencyRule,
    responses: Map<string, any>
  ): ValidationResult {
    const dependentValue = responses.get(rule.dependentQuestion);
    const requiredValue = responses.get(rule.requiredQuestion);

    // If dependent question is answered, required question must also be answered
    if (this.hasValue(dependentValue) && !this.hasValue(requiredValue)) {
      return {
        isValid: false,
        errors: [{
          code: 'DEPENDENCY_VIOLATION',
          message: rule.message ||
            `${rule.requiredQuestion} is required when ${rule.dependentQuestion} is answered`,
          field: rule.requiredQuestion,
          severity: 'error'
        }],
        warnings: []
      };
    }

    return { isValid: true, errors: [], warnings: [] };
  }

  /**
   * Validate consistency rules (multiple fields must match)
   */
  private validateConsistency(
    rule: ConsistencyRule,
    responses: Map<string, any>
  ): ValidationResult {
    const values = rule.questions.map(q => responses.get(q));

    if (rule.mustMatch && values.length > 1) {
      const firstValue = values[0];
      const allMatch = values.every(v => v === firstValue);

      if (!allMatch) {
        return {
          isValid: false,
          errors: [{
            code: 'CONSISTENCY_VIOLATION',
            message: rule.message || 'These fields must match',
            severity: 'error'
          }],
          warnings: []
        };
      }
    }

    return { isValid: true, errors: [], warnings: [] };
  }

  /**
   * Validate completeness rules (all required questions answered)
   */
  private validateCompleteness(
    rule: CompletenessRule,
    responses: Map<string, any>,
    questions: Question[]
  ): ValidationResult {
    const errors: ValidationError[] = [];

    for (const questionId of rule.requiredQuestions) {
      const value = responses.get(questionId);
      if (!this.hasValue(value)) {
        const question = questions.find(q => q.id === questionId);
        const questionText = question?.text || questionId;

        errors.push({
          code: 'INCOMPLETE',
          message: `Required question "${questionText}" must be answered`,
          field: questionId,
          severity: 'error'
        });
      }
    }

    return {
      isValid: errors.length === 0,
      errors,
      warnings: []
    };
  }

  /**
   * Check if a value is considered "answered"
   */
  private hasValue(value: any): boolean {
    if (value === null || value === undefined) return false;
    if (typeof value === 'string' && value.trim().length === 0) return false;
    if (Array.isArray(value) && value.length === 0) return false;
    return true;
  }
}
