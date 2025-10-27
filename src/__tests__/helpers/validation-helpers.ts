import { z } from 'zod';
import { expect } from '@jest/globals';

/**
 * Validation test helpers for schema testing
 */
export class ValidationTestHelpers {
  /**
   * Expect a validation error when parsing data with a schema
   */
  static expectValidationError(
    schema: z.ZodSchema,
    data: unknown,
    expectedMessage?: string
  ): void {
    expect(() => schema.parse(data)).toThrow();
    
    if (expectedMessage) {
      try {
        schema.parse(data);
        throw new Error('Expected validation to fail but it succeeded');
      } catch (error) {
        if (error instanceof z.ZodError) {
          const errorMessage = error.errors.map(e => e.message).join(', ');
          expect(errorMessage).toContain(expectedMessage);
        }
      }
    }
  }

  /**
   * Expect validation to succeed
   */
  static expectValidationSuccess(schema: z.ZodSchema, data: unknown): void {
    expect(() => schema.parse(data)).not.toThrow();
  }

  /**
   * Test boundary values for a numeric field
   */
  static testBoundaryValues(
    createData: (value: number) => unknown,
    schema: z.ZodSchema,
    min: number,
    max: number
  ): void {
    // Test minimum boundary
    expect(() => schema.parse(createData(min))).not.toThrow();
    expect(() => schema.parse(createData(min - 1))).toThrow();
    
    // Test maximum boundary
    expect(() => schema.parse(createData(max))).not.toThrow();
    expect(() => schema.parse(createData(max + 1))).toThrow();
  }

  /**
   * Format Zod errors into a readable string
   */
  static formatZodError(error: z.ZodError): string {
    return error.errors
      .map(e => `${e.path.join('.')}: ${e.message}`)
      .join('\n');
  }

  /**
   * Safely parse and return result
   */
  static safeParse<T>(schema: z.ZodSchema<T>, data: unknown): {
    success: boolean;
    data?: T;
    error?: z.ZodError;
  } {
    const result = schema.safeParse(data);
    if (result.success) {
      return { success: true, data: result.data };
    }
    return { success: false, error: result.error };
  }
}
