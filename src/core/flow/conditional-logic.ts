/**
 * Conditional Logic Engine
 * 
 * Evaluates conditions to determine question visibility, requirements, and skipping logic
 */

import type { Question, Condition } from '../schema.js';

/**
 * Condition operator type
 */
type ConditionOperator = 
  | 'equals'
  | 'notEquals'
  | 'greaterThan'
  | 'lessThan'
  | 'greaterThanOrEqual'
  | 'lessThanOrEqual'
  | 'contains'
  | 'notContains'
  | 'in'
  | 'notIn'
  | 'matches'
  | 'notMatches'
  | 'isEmpty'
  | 'isNotEmpty'
  | 'hasLength'
  | 'hasMinLength'
  | 'hasMaxLength';

/**
 * Error thrown when condition evaluation fails
 */
export class ConditionEvaluationError extends Error {
  constructor(message: string, public readonly condition?: Condition) {
    super(message);
    this.name = 'ConditionEvaluationError';
  }
}

/**
 * Engine for evaluating conditional logic
 */
export class ConditionalLogicEngine {
  /**
   * Evaluate a single condition against responses
   */
  evaluateCondition(condition: Condition, responses: Map<string, any>): boolean {
    const response = responses.get(condition.questionId);
    
    try {
      switch (condition.operator) {
        case 'equals':
          return response === condition.value;
        
        case 'notEquals':
          return response !== condition.value;
        
        case 'greaterThan':
          return typeof response === 'number' && typeof condition.value === 'number' 
            && response > condition.value;
        
        case 'lessThan':
          return typeof response === 'number' && typeof condition.value === 'number'
            && response < condition.value;
        
        case 'greaterThanOrEqual':
          return typeof response === 'number' && typeof condition.value === 'number'
            && response >= condition.value;
        
        case 'lessThanOrEqual':
          return typeof response === 'number' && typeof condition.value === 'number'
            && response <= condition.value;
        
        case 'contains':
          return Array.isArray(response) && response.includes(condition.value);
        
        case 'notContains':
          return !Array.isArray(response) || !response.includes(condition.value);
        
        case 'in':
          return Array.isArray(condition.values) && condition.values.includes(response);
        
        case 'notIn':
          return !Array.isArray(condition.values) || !condition.values.includes(response);
        
        case 'matches':
          return typeof response === 'string' 
            && typeof condition.value === 'string'
            && new RegExp(condition.value).test(response);
        
        case 'notMatches':
          return typeof response !== 'string'
            || typeof condition.value !== 'string'
            || !new RegExp(condition.value).test(response);
        
        case 'isEmpty':
          return response === null 
            || response === undefined 
            || response === '' 
            || (Array.isArray(response) && response.length === 0);
        
        case 'isNotEmpty':
          return response !== null 
            && response !== undefined 
            && response !== '' 
            && (!Array.isArray(response) || response.length > 0);
        
        case 'hasLength':
          return (typeof response === 'string' || Array.isArray(response))
            && typeof condition.value === 'number'
            && response.length === condition.value;
        
        case 'hasMinLength':
          return (typeof response === 'string' || Array.isArray(response))
            && typeof condition.value === 'number'
            && response.length >= condition.value;
        
        case 'hasMaxLength':
          return (typeof response === 'string' || Array.isArray(response))
            && typeof condition.value === 'number'
            && response.length <= condition.value;
        
        default: {
          const exhaustiveCheck: never = condition.operator;
          throw new ConditionEvaluationError(
            `Unknown condition operator: ${exhaustiveCheck}`,
            condition
          );
        }
      }
    } catch (error) {
      if (error instanceof ConditionEvaluationError) {
        throw error;
      }
      throw new ConditionEvaluationError(
        `Failed to evaluate condition: ${error instanceof Error ? error.message : String(error)}`,
        condition
      );
    }
  }

  /**
   * Evaluate a condition group (single condition or array of conditions)
   * Multiple conditions are AND-ed together
   */
  evaluateConditionGroup(conditions: Condition | Condition[], responses: Map<string, any>): boolean {
    if (!Array.isArray(conditions)) {
      return this.evaluateCondition(conditions, responses);
    }

    // Multiple conditions are AND-ed together
    return conditions.every(condition => this.evaluateCondition(condition, responses));
  }

  /**
   * Determine if a question should be shown based on its conditional logic
   */
  shouldShowQuestion(question: Question, responses: Map<string, any>): boolean {
    const logic = question.conditional;
    if (!logic) return true;

    // Check showIf condition
    if (logic.showIf) {
      const shouldShow = this.evaluateConditionGroup(logic.showIf, responses);
      if (!shouldShow) return false;
    }

    // Check hideIf condition
    if (logic.hideIf) {
      const shouldHide = this.evaluateConditionGroup(logic.hideIf, responses);
      if (shouldHide) return false;
    }

    return true;
  }

  /**
   * Determine if a question should be skipped based on its conditional logic
   */
  shouldSkipQuestion(question: Question, responses: Map<string, any>): boolean {
    const logic = question.conditional;
    if (!logic || !logic.skipIf) return false;

    return this.evaluateConditionGroup(logic.skipIf, responses);
  }

  /**
   * Determine if a question is required based on its conditional logic
   */
  isQuestionRequired(question: Question, responses: Map<string, any>): boolean {
    // Base required flag
    if (question.required) return true;

    // Check conditional required
    const logic = question.conditional;
    if (logic?.requiredIf) {
      return this.evaluateConditionGroup(logic.requiredIf, responses);
    }

    return false;
  }
}
