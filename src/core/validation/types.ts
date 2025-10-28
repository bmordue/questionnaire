/**
 * Validation types and interfaces
 */

/**
 * Validation error details
 */
export interface ValidationError {
  code: string;
  message: string;
  field?: string;
  severity: 'error';
  context?: any;
}

/**
 * Validation warning details
 */
export interface ValidationWarning {
  code: string;
  message: string;
  field?: string;
  severity: 'warning';
  context?: any;
}

/**
 * Result of a validation operation
 */
export interface ValidationResult {
  isValid: boolean;
  errors: ValidationError[];
  warnings: ValidationWarning[];
}

/**
 * Validation rules for text inputs
 */
export interface TextValidationRules {
  required?: boolean;
  minLength?: number;
  maxLength?: number;
  pattern?: string;
  patternMessage?: string;
  customValidator?: (value: string) => { isValid: boolean; message: string };
}

/**
 * Validation rules for number inputs
 */
export interface NumberValidationRules {
  required?: boolean;
  min?: number;
  max?: number;
  integer?: boolean;
  precision?: number;
}

/**
 * Validation rules for choice inputs
 */
export interface ChoiceValidationRules {
  required?: boolean;
  validOptions?: string[];
  minSelections?: number;
  maxSelections?: number;
}

/**
 * Validation rules for date inputs
 */
export interface DateValidationRules {
  required?: boolean;
  minDate?: string | Date;
  maxDate?: string | Date;
}

/**
 * Validation rules for email inputs
 */
export interface EmailValidationRules {
  required?: boolean;
  customDomains?: string[];
}

/**
 * Validation rules for rating inputs
 */
export interface RatingValidationRules {
  required?: boolean;
  min?: number;
  max?: number;
}

/**
 * Validation rules for boolean inputs
 */
export interface BooleanValidationRules {
  required?: boolean;
  mustBeTrue?: boolean;
}

/**
 * Cross-validation rule types
 */
export type CrossValidationRuleType = 'dependency' | 'consistency' | 'completeness';

/**
 * Base cross-validation rule
 */
export interface CrossValidationRule {
  type: CrossValidationRuleType;
  message?: string;
}

/**
 * Dependency validation rule
 */
export interface DependencyRule extends CrossValidationRule {
  type: 'dependency';
  dependentQuestion: string;
  requiredQuestion: string;
}

/**
 * Consistency validation rule
 */
export interface ConsistencyRule extends CrossValidationRule {
  type: 'consistency';
  questions: string[];
  mustMatch?: boolean;
}

/**
 * Completeness validation rule
 */
export interface CompletenessRule extends CrossValidationRule {
  type: 'completeness';
  requiredQuestions: string[];
}
