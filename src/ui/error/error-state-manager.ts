import type { ValidationError, ValidationWarning } from '../../core/validation/types.js';

/**
 * State manager for tracking validation errors
 */
export class ErrorStateManager {
  private errors: Map<string, ValidationError[]> = new Map();
  private warnings: Map<string, ValidationWarning[]> = new Map();
  private touched: Set<string> = new Set();

  /**
   * Set errors for a field
   */
  setErrors(field: string, errors: ValidationError[]): void {
    if (errors.length === 0) {
      this.errors.delete(field);
    } else {
      this.errors.set(field, errors);
    }
  }

  /**
   * Set warnings for a field
   */
  setWarnings(field: string, warnings: ValidationWarning[]): void {
    if (warnings.length === 0) {
      this.warnings.delete(field);
    } else {
      this.warnings.set(field, warnings);
    }
  }

  /**
   * Get errors for a field
   */
  getErrors(field: string): ValidationError[] {
    return this.errors.get(field) || [];
  }

  /**
   * Get warnings for a field
   */
  getWarnings(field: string): ValidationWarning[] {
    return this.warnings.get(field) || [];
  }

  /**
   * Get all errors
   */
  getAllErrors(): Map<string, ValidationError[]> {
    return new Map(this.errors);
  }

  /**
   * Get all warnings
   */
  getAllWarnings(): Map<string, ValidationWarning[]> {
    return new Map(this.warnings);
  }

  /**
   * Mark a field as touched
   */
  markTouched(field: string): void {
    this.touched.add(field);
  }

  /**
   * Check if a field is touched
   */
  isTouched(field: string): boolean {
    return this.touched.has(field);
  }

  /**
   * Check if a field has errors
   */
  hasErrors(field: string): boolean {
    const fieldErrors = this.errors.get(field);
    return fieldErrors !== undefined && fieldErrors.length > 0;
  }

  /**
   * Check if a field has warnings
   */
  hasWarnings(field: string): boolean {
    const fieldWarnings = this.warnings.get(field);
    return fieldWarnings !== undefined && fieldWarnings.length > 0;
  }

  /**
   * Check if any field has errors
   */
  hasAnyErrors(): boolean {
    return this.errors.size > 0;
  }

  /**
   * Get total error count
   */
  getErrorCount(): number {
    let count = 0;
    for (const errors of this.errors.values()) {
      count += errors.length;
    }
    return count;
  }

  /**
   * Get total warning count
   */
  getWarningCount(): number {
    let count = 0;
    for (const warnings of this.warnings.values()) {
      count += warnings.length;
    }
    return count;
  }

  /**
   * Clear errors for a field
   */
  clearErrors(field: string): void {
    this.errors.delete(field);
  }

  /**
   * Clear warnings for a field
   */
  clearWarnings(field: string): void {
    this.warnings.delete(field);
  }

  /**
   * Clear all errors
   */
  clearAllErrors(): void {
    this.errors.clear();
  }

  /**
   * Clear all warnings
   */
  clearAllWarnings(): void {
    this.warnings.clear();
  }

  /**
   * Clear all state
   */
  reset(): void {
    this.errors.clear();
    this.warnings.clear();
    this.touched.clear();
  }

  /**
   * Get fields with errors
   */
  getFieldsWithErrors(): string[] {
    return Array.from(this.errors.keys());
  }

  /**
   * Get fields with warnings
   */
  getFieldsWithWarnings(): string[] {
    return Array.from(this.warnings.keys());
  }

  /**
   * Get validation state summary
   */
  getSummary(): {
    errorCount: number;
    warningCount: number;
    fieldsWithErrors: string[];
    fieldsWithWarnings: string[];
    touchedFields: string[];
  } {
    return {
      errorCount: this.getErrorCount(),
      warningCount: this.getWarningCount(),
      fieldsWithErrors: this.getFieldsWithErrors(),
      fieldsWithWarnings: this.getFieldsWithWarnings(),
      touchedFields: Array.from(this.touched)
    };
  }
}
