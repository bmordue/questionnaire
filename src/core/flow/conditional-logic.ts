/**
 * Conditional Logic Engine
 * 
 * Evaluates conditions to determine question visibility, requirements, and skipping logic
 */

import type { Question, Condition, Questionnaire } from '../schema.js';
import { DependencyGraph } from './dependency-graph.js';
import { ConditionalFunctionRegistry, type EvaluationContext } from './conditional-functions.js';

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
 * Validation result for conditional logic
 */
export interface ValidationResult {
  isValid: boolean;
  errors: string[];
  warnings: string[];
}

/**
 * Engine for evaluating conditional logic
 */
export class ConditionalLogicEngine {
  private functionRegistry: ConditionalFunctionRegistry;
  private evaluationCache = new Map<string, boolean>();

  constructor() {
    this.functionRegistry = new ConditionalFunctionRegistry();
  }

  /**
   * Clear the evaluation cache
   */
  clearCache(): void {
    this.evaluationCache.clear();
  }

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

  /**
   * Build a dependency graph for a questionnaire
   */
  buildDependencyGraph(questionnaire: Questionnaire): DependencyGraph {
    const graph = new DependencyGraph();

    for (const question of questionnaire.questions) {
      if (question.conditional) {
        const dependencies = this.extractDependencies(question.conditional);
        
        for (const dependency of dependencies) {
          graph.addDependency(question.id, dependency);
        }
      }
    }

    return graph;
  }

  /**
   * Extract all question IDs that a conditional logic depends on
   */
  private extractDependencies(conditional: Conditional): string[] {
    const dependencies = new Set<string>();

    const extractFromCondition = (condition: Condition | Condition[]) => {
      if (Array.isArray(condition)) {
        condition.forEach(c => dependencies.add(c.questionId));
      } else {
        dependencies.add(condition.questionId);
      }
    };

    if (conditional.showIf) {
      extractFromCondition(conditional.showIf);
    }
    if (conditional.hideIf) {
      extractFromCondition(conditional.hideIf);
    }
    if (conditional.skipIf) {
      extractFromCondition(conditional.skipIf);
    }
    if (conditional.requiredIf) {
      extractFromCondition(conditional.requiredIf);
    }

    return Array.from(dependencies);
  }

  /**
   * Validate conditional logic in a questionnaire
   */
  validateConditionalLogic(questionnaire: Questionnaire): ValidationResult {
    const errors: string[] = [];
    const warnings: string[] = [];

    // Build dependency graph
    const dependencyGraph = this.buildDependencyGraph(questionnaire);

    // Check for circular dependencies
    const cycles = dependencyGraph.findCycles();
    if (cycles.length > 0) {
      cycles.forEach(cycle => {
        errors.push(`Circular dependency detected: ${cycle.join(' -> ')}`);
      });
    }

    // Validate all conditional expressions
    const questionIds = new Set(questionnaire.questions.map(q => q.id));
    
    for (const question of questionnaire.questions) {
      if (question.conditional) {
        const deps = this.extractDependencies(question.conditional);
        
        // Check for references to non-existent questions
        for (const dep of deps) {
          if (!questionIds.has(dep)) {
            errors.push(
              `Question "${question.id}" references non-existent question "${dep}" in conditional logic`
            );
          }
        }

        // Check for self-reference
        if (deps.includes(question.id)) {
          errors.push(
            `Question "${question.id}" references itself in conditional logic`
          );
        }
      }
    }

    // Check for potentially unreachable questions
    const unreachableQuestions = this.findUnreachableQuestions(questionnaire);
    if (unreachableQuestions.length > 0) {
      warnings.push(
        `Potentially unreachable questions: ${unreachableQuestions.join(', ')}`
      );
    }

    return {
      isValid: errors.length === 0,
      errors,
      warnings
    };
  }

  /**
   * Find questions that may be unreachable due to conditional logic
   */
  private findUnreachableQuestions(questionnaire: Questionnaire): string[] {
    const unreachable: string[] = [];

    // This is a simplified heuristic - a question is potentially unreachable if:
    // 1. It has a showIf condition that depends on a question that comes after it
    // 2. All paths to show it are blocked
    
    const questionOrder = new Map<string, number>();
    questionnaire.questions.forEach((q, index) => {
      questionOrder.set(q.id, index);
    });

    for (const question of questionnaire.questions) {
      if (question.conditional?.showIf) {
        const deps = this.extractDependencies({ showIf: question.conditional.showIf });
        
        // Check if any dependency comes after this question
        const currentIndex = questionOrder.get(question.id)!;
        const hasForwardDependency = deps.some(dep => {
          const depIndex = questionOrder.get(dep);
          return depIndex !== undefined && depIndex > currentIndex;
        });

        if (hasForwardDependency) {
          unreachable.push(question.id);
        }
      }
    }

    return unreachable;
  }

  /**
   * Get the function registry for custom function registration
   */
  getFunctionRegistry(): ConditionalFunctionRegistry {
    return this.functionRegistry;
  }
}
