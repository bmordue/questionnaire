/**
 * Conditional Functions Tests
 */

import { describe, it, expect, beforeEach } from '@jest/globals';
import { ConditionalFunctionRegistry, type EvaluationContext } from '../../core/flow/conditional-functions.js';

describe('ConditionalFunctionRegistry', () => {
  let registry: ConditionalFunctionRegistry;
  let context: EvaluationContext;

  beforeEach(() => {
    registry = new ConditionalFunctionRegistry();
    context = {
      responses: new Map()
    };
  });

  describe('count function', () => {
    it('should count occurrences of a value in an array', () => {
      context.responses.set('q1', ['a', 'b', 'a', 'c', 'a']);
      
      const result = registry.execute('count', ['q1', 'a'], context);
      expect(result).toBe(3);
    });

    it('should return 0 for non-array values', () => {
      context.responses.set('q1', 'text');
      
      const result = registry.execute('count', ['q1', 'a'], context);
      expect(result).toBe(0);
    });

    it('should return 0 when value not found', () => {
      context.responses.set('q1', ['a', 'b', 'c']);
      
      const result = registry.execute('count', ['q1', 'd'], context);
      expect(result).toBe(0);
    });

    it('should throw error with insufficient arguments', () => {
      expect(() => registry.execute('count', ['q1'], context)).toThrow();
    });
  });

  describe('sum function', () => {
    it('should sum numeric values from multiple questions', () => {
      context.responses.set('q1', 10);
      context.responses.set('q2', 20);
      context.responses.set('q3', 30);
      
      const result = registry.execute('sum', ['q1', 'q2', 'q3'], context);
      expect(result).toBe(60);
    });

    it('should ignore non-numeric values', () => {
      context.responses.set('q1', 10);
      context.responses.set('q2', 'text');
      context.responses.set('q3', 30);
      
      const result = registry.execute('sum', ['q1', 'q2', 'q3'], context);
      expect(result).toBe(40);
    });

    it('should return 0 for all non-numeric values', () => {
      context.responses.set('q1', 'text');
      context.responses.set('q2', null);
      
      const result = registry.execute('sum', ['q1', 'q2'], context);
      expect(result).toBe(0);
    });

    it('should throw error with no arguments', () => {
      expect(() => registry.execute('sum', [], context)).toThrow();
    });
  });

  describe('avg function', () => {
    it('should calculate average of numeric values', () => {
      context.responses.set('q1', 10);
      context.responses.set('q2', 20);
      context.responses.set('q3', 30);
      
      const result = registry.execute('avg', ['q1', 'q2', 'q3'], context);
      expect(result).toBe(20);
    });

    it('should ignore non-numeric values', () => {
      context.responses.set('q1', 10);
      context.responses.set('q2', 'text');
      context.responses.set('q3', 20);
      
      const result = registry.execute('avg', ['q1', 'q2', 'q3'], context);
      expect(result).toBe(15);
    });

    it('should return 0 when no numeric values', () => {
      context.responses.set('q1', 'text');
      context.responses.set('q2', null);
      
      const result = registry.execute('avg', ['q1', 'q2'], context);
      expect(result).toBe(0);
    });
  });

  describe('length function', () => {
    it('should return string length', () => {
      context.responses.set('q1', 'hello world');
      
      const result = registry.execute('length', ['q1'], context);
      expect(result).toBe(11);
    });

    it('should return array length', () => {
      context.responses.set('q1', ['a', 'b', 'c']);
      
      const result = registry.execute('length', ['q1'], context);
      expect(result).toBe(3);
    });

    it('should return 0 for non-string/array values', () => {
      context.responses.set('q1', 123);
      
      const result = registry.execute('length', ['q1'], context);
      expect(result).toBe(0);
    });

    it('should throw error with no arguments', () => {
      expect(() => registry.execute('length', [], context)).toThrow();
    });
  });

  describe('answeredCount function', () => {
    it('should count answered questions', () => {
      context.responses.set('q1', 'answer');
      context.responses.set('q2', 42);
      context.responses.set('q3', '');
      context.responses.set('q4', null);
      
      const result = registry.execute('answeredCount', ['q1', 'q2', 'q3', 'q4'], context);
      expect(result).toBe(2);
    });

    it('should return 0 when all questions unanswered', () => {
      context.responses.set('q1', '');
      context.responses.set('q2', null);
      context.responses.set('q3', undefined);
      
      const result = registry.execute('answeredCount', ['q1', 'q2', 'q3'], context);
      expect(result).toBe(0);
    });

    it('should throw error with no arguments', () => {
      expect(() => registry.execute('answeredCount', [], context)).toThrow();
    });
  });

  describe('min function', () => {
    it('should return minimum value', () => {
      context.responses.set('q1', 30);
      context.responses.set('q2', 10);
      context.responses.set('q3', 20);
      
      const result = registry.execute('min', ['q1', 'q2', 'q3'], context);
      expect(result).toBe(10);
    });

    it('should ignore non-numeric values', () => {
      context.responses.set('q1', 30);
      context.responses.set('q2', 'text');
      context.responses.set('q3', 20);
      
      const result = registry.execute('min', ['q1', 'q2', 'q3'], context);
      expect(result).toBe(20);
    });

    it('should return null when no numeric values', () => {
      context.responses.set('q1', 'text');
      
      const result = registry.execute('min', ['q1'], context);
      expect(result).toBeNull();
    });
  });

  describe('max function', () => {
    it('should return maximum value', () => {
      context.responses.set('q1', 30);
      context.responses.set('q2', 10);
      context.responses.set('q3', 20);
      
      const result = registry.execute('max', ['q1', 'q2', 'q3'], context);
      expect(result).toBe(30);
    });

    it('should ignore non-numeric values', () => {
      context.responses.set('q1', 30);
      context.responses.set('q2', 'text');
      context.responses.set('q3', 20);
      
      const result = registry.execute('max', ['q1', 'q2', 'q3'], context);
      expect(result).toBe(30);
    });

    it('should return null when no numeric values', () => {
      context.responses.set('q1', 'text');
      
      const result = registry.execute('max', ['q1'], context);
      expect(result).toBeNull();
    });
  });

  describe('daysAgo function', () => {
    it('should calculate days ago from a date', () => {
      const threeDaysAgo = new Date();
      threeDaysAgo.setDate(threeDaysAgo.getDate() - 3);
      
      context.responses.set('q1', threeDaysAgo.toISOString());
      
      const result = registry.execute('daysAgo', ['q1'], context);
      expect(result).toBeGreaterThanOrEqual(2);
      expect(result).toBeLessThanOrEqual(4);
    });

    it('should return null for missing date', () => {
      const result = registry.execute('daysAgo', ['q1'], context);
      expect(result).toBeNull();
    });

    it('should throw error with no arguments', () => {
      expect(() => registry.execute('daysAgo', [], context)).toThrow();
    });
  });

  describe('custom functions', () => {
    it('should allow registering custom functions', () => {
      registry.register('double', {
        execute: (args: any[], context: EvaluationContext) => {
          const value = context.responses.get(args[0]);
          return typeof value === 'number' ? value * 2 : 0;
        }
      });

      context.responses.set('q1', 21);
      const result = registry.execute('double', ['q1'], context);
      expect(result).toBe(42);
    });

    it('should check if function exists', () => {
      expect(registry.has('sum')).toBe(true);
      expect(registry.has('nonexistent')).toBe(false);
    });
  });

  describe('error handling', () => {
    it('should throw error for unknown function', () => {
      expect(() => registry.execute('unknown', [], context)).toThrow('Unknown function: unknown');
    });
  });
});
