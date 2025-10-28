/**
 * Validation result returned by component validators
 */
export interface ValidationResult {
  isValid: boolean;
  message?: string;
}

/**
 * Inquirer prompt configuration type
 * Using a flexible type to accommodate various prompt configurations
 */
export type InquirerPromptConfig = any;
