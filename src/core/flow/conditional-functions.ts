/**
 * Conditional Functions Registry
 * 
 * Provides built-in functions for advanced conditional logic
 */

/**
 * Context for evaluating conditional functions
 */
export interface EvaluationContext {
  responses: Map<string, any>;
  currentQuestionId?: string;
}

/**
 * Function that can be used in conditional expressions
 */
export interface ConditionalFunction {
  execute(args: any[], context: EvaluationContext): any;
}

/**
 * Registry for conditional functions
 */
export class ConditionalFunctionRegistry {
  private functions = new Map<string, ConditionalFunction>();

  constructor() {
    this.registerBuiltinFunctions();
  }

  /**
   * Register a custom function
   */
  register(name: string, func: ConditionalFunction): void {
    this.functions.set(name, func);
  }

  /**
   * Execute a function by name
   */
  execute(name: string, args: any[], context: EvaluationContext): any {
    const func = this.functions.get(name);
    if (!func) {
      throw new Error(`Unknown function: ${name}`);
    }

    return func.execute(args, context);
  }

  /**
   * Check if a function exists
   */
  has(name: string): boolean {
    return this.functions.has(name);
  }

  /**
   * Register all built-in functions
   */
  private registerBuiltinFunctions(): void {
    // Count function: count(questionId, value)
    this.register('count', {
      execute: (args: any[], context: EvaluationContext) => {
        if (args.length < 2) {
          throw new Error('count() requires 2 arguments: questionId and value');
        }

        const [questionId, value] = args;
        const questionValue = context.responses.get(questionId);
        
        if (!Array.isArray(questionValue)) {
          return 0;
        }

        return questionValue.filter(v => v === value).length;
      }
    });

    // Sum function: sum(questionId1, questionId2, ...)
    this.register('sum', {
      execute: (args: any[], context: EvaluationContext) => {
        if (args.length === 0) {
          throw new Error('sum() requires at least 1 argument');
        }

        return args.reduce((total, questionId) => {
          const value = context.responses.get(questionId);
          return total + (typeof value === 'number' ? value : 0);
        }, 0);
      }
    });

    // Average function: avg(questionId1, questionId2, ...)
    this.register('avg', {
      execute: (args: any[], context: EvaluationContext) => {
        if (args.length === 0) {
          throw new Error('avg() requires at least 1 argument');
        }

        const validValues = args
          .map(questionId => context.responses.get(questionId))
          .filter(value => typeof value === 'number');
        
        if (validValues.length === 0) return 0;
        
        const sum = validValues.reduce((a, b) => a + b, 0);
        return sum / validValues.length;
      }
    });

    // Date comparison: daysAgo(questionId)
    this.register('daysAgo', {
      execute: (args: any[], context: EvaluationContext) => {
        if (args.length === 0) {
          throw new Error('daysAgo() requires 1 argument: questionId');
        }

        const [questionId] = args;
        const dateValue = context.responses.get(questionId);
        
        if (!dateValue) return null;
        
        const date = new Date(dateValue);
        const now = new Date();
        const diffTime = Math.abs(now.getTime() - date.getTime());
        const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
        
        return diffDays;
      }
    });

    // Text length: length(questionId)
    this.register('length', {
      execute: (args: any[], context: EvaluationContext) => {
        if (args.length === 0) {
          throw new Error('length() requires 1 argument: questionId');
        }

        const [questionId] = args;
        const value = context.responses.get(questionId);
        
        if (typeof value === 'string' || Array.isArray(value)) {
          return value.length;
        }
        
        return 0;
      }
    });

    // Answered count: answeredCount(questionId1, questionId2, ...)
    this.register('answeredCount', {
      execute: (args: any[], context: EvaluationContext) => {
        if (args.length === 0) {
          throw new Error('answeredCount() requires at least 1 argument');
        }

        return args.filter(questionId => {
          const value = context.responses.get(questionId);
          return value !== null && value !== undefined && value !== '';
        }).length;
      }
    });

    // Min function: min(questionId1, questionId2, ...)
    this.register('min', {
      execute: (args: any[], context: EvaluationContext) => {
        if (args.length === 0) {
          throw new Error('min() requires at least 1 argument');
        }

        const values = args
          .map(questionId => context.responses.get(questionId))
          .filter(value => typeof value === 'number');
        
        if (values.length === 0) return null;
        
        return Math.min(...values);
      }
    });

    // Max function: max(questionId1, questionId2, ...)
    this.register('max', {
      execute: (args: any[], context: EvaluationContext) => {
        if (args.length === 0) {
          throw new Error('max() requires at least 1 argument');
        }

        const values = args
          .map(questionId => context.responses.get(questionId))
          .filter(value => typeof value === 'number');
        
        if (values.length === 0) return null;
        
        return Math.max(...values);
      }
    });
  }
}
