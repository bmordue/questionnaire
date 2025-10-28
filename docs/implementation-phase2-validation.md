# Phase 2 Task 3: Add Validation and Error Handling

## Overview
Implement comprehensive validation and error handling systems to ensure data integrity, provide clear user feedback, and maintain application stability throughout the questionnaire execution process.

## Goals
- Implement real-time validation for all question types
- Provide clear, actionable error messages
- Handle application errors gracefully
- Support validation rule customization
- Ensure consistent error handling patterns

## Technical Approach

### 1. Validation System Architecture

#### Validation Layers
```typescript
interface ValidationSystem {
  // Schema validation (compile-time and runtime)
  schemaValidation: SchemaValidator
  
  // Business rule validation
  businessValidation: BusinessRuleValidator
  
  // User input validation  
  inputValidation: InputValidator
  
  // Cross-question validation
  crossValidation: CrossQuestionValidator
}
```

#### Validation Result Types
```typescript
interface ValidationResult {
  isValid: boolean
  errors: ValidationError[]
  warnings: ValidationWarning[]
}

interface ValidationError {
  code: string
  message: string
  field?: string
  severity: 'error' | 'warning' | 'info'
  context?: any
}
```

### 2. Error Classification

#### Error Categories
- **Validation Errors**: User input validation failures
- **System Errors**: Application/infrastructure failures  
- **Data Errors**: Schema or data integrity issues
- **Network Errors**: Storage or external service failures
- **User Errors**: Invalid user actions or navigation

## Implementation Tasks

### Task 3.1: Input Validation System (5 hours)
- [x] Implement real-time input validation
- [x] Create validation rules for each question type
- [x] Add custom validation rule support
- [x] Build validation error formatting

### Task 3.2: Cross-Question Validation (4 hours)
- [x] Implement dependency validation
- [x] Add consistency checking between answers
- [x] Create validation rules for conditional logic
- [x] Handle validation in complex flows

### Task 3.3: Error Handling Framework (4 hours)
- [x] Create centralized error handling system
- [x] Implement error recovery strategies
- [x] Add error logging and reporting
- [x] Build user-friendly error display

### Task 3.4: Error UI Components (3 hours)
- [x] Design error message display components
- [x] Create validation feedback UI
- [x] Implement error state management
- [x] Add accessibility features for errors

## Input Validation Implementation

### 1. Base Validation Framework

```typescript
abstract class BaseValidator<T> {
  abstract validate(value: T, rules: ValidationRules): ValidationResult
  
  protected createError(code: string, message: string, field?: string): ValidationError {
    return {
      code,
      message,
      field,
      severity: 'error'
    }
  }
  
  protected createWarning(code: string, message: string, field?: string): ValidationWarning {
    return {
      code,
      message, 
      field,
      severity: 'warning'
    }
  }
}
```

### 2. Question Type Validators

#### Text Input Validator
```typescript
class TextValidator extends BaseValidator<string> {
  validate(value: string, rules: TextValidationRules): ValidationResult {
    const errors: ValidationError[] = []
    const warnings: ValidationWarning[] = []

    // Required validation
    if (rules.required && (!value || value.trim().length === 0)) {
      errors.push(this.createError(
        'REQUIRED_FIELD',
        'This field is required'
      ))
    }

    if (value && value.trim().length > 0) {
      // Length validation
      if (rules.minLength && value.length < rules.minLength) {
        errors.push(this.createError(
          'MIN_LENGTH',
          `Minimum length is ${rules.minLength} characters (current: ${value.length})`
        ))
      }

      if (rules.maxLength && value.length > rules.maxLength) {
        errors.push(this.createError(
          'MAX_LENGTH',
          `Maximum length is ${rules.maxLength} characters (current: ${value.length})`
        ))
      }

      // Pattern validation
      if (rules.pattern) {
        const regex = new RegExp(rules.pattern)
        if (!regex.test(value)) {
          errors.push(this.createError(
            'INVALID_PATTERN',
            rules.patternMessage || 'Invalid format'
          ))
        }
      }

      // Custom validation functions
      if (rules.customValidator) {
        const customResult = rules.customValidator(value)
        if (!customResult.isValid) {
          errors.push(this.createError(
            'CUSTOM_VALIDATION',
            customResult.message
          ))
        }
      }

      // Warnings for approaching limits
      if (rules.maxLength && value.length > rules.maxLength * 0.9) {
        warnings.push(this.createWarning(
          'APPROACHING_LIMIT',
          `Approaching character limit (${value.length}/${rules.maxLength})`
        ))
      }
    }

    return {
      isValid: errors.length === 0,
      errors,
      warnings
    }
  }
}
```

#### Number Validator
```typescript
class NumberValidator extends BaseValidator<number> {
  validate(value: number, rules: NumberValidationRules): ValidationResult {
    const errors: ValidationError[] = []
    const warnings: ValidationWarning[] = []

    // Required validation
    if (rules.required && (value === null || value === undefined)) {
      errors.push(this.createError(
        'REQUIRED_FIELD',
        'This field is required'
      ))
      return { isValid: false, errors, warnings }
    }

    if (value !== null && value !== undefined) {
      // Type validation
      if (typeof value !== 'number' || isNaN(value)) {
        errors.push(this.createError(
          'INVALID_NUMBER',
          'Please enter a valid number'
        ))
        return { isValid: false, errors, warnings }
      }

      // Integer validation
      if (rules.integer && !Number.isInteger(value)) {
        errors.push(this.createError(
          'MUST_BE_INTEGER',
          'Please enter a whole number'
        ))
      }

      // Range validation
      if (rules.min !== undefined && value < rules.min) {
        errors.push(this.createError(
          'BELOW_MINIMUM',
          `Value must be at least ${rules.min}`
        ))
      }

      if (rules.max !== undefined && value > rules.max) {
        errors.push(this.createError(
          'ABOVE_MAXIMUM',
          `Value must be no more than ${rules.max}`
        ))
      }

      // Precision validation
      if (rules.precision !== undefined) {
        const decimalPlaces = this.getDecimalPlaces(value)
        if (decimalPlaces > rules.precision) {
          errors.push(this.createError(
            'TOO_MANY_DECIMALS',
            `Maximum ${rules.precision} decimal places allowed`
          ))
        }
      }

      // Range warnings
      if (rules.min !== undefined && rules.max !== undefined) {
        const range = rules.max - rules.min
        if (value < rules.min + range * 0.1) {
          warnings.push(this.createWarning(
            'NEAR_MINIMUM',
            'Value is near the minimum allowed'
          ))
        }
        if (value > rules.max - range * 0.1) {
          warnings.push(this.createWarning(
            'NEAR_MAXIMUM', 
            'Value is near the maximum allowed'
          ))
        }
      }
    }

    return {
      isValid: errors.length === 0,
      errors,
      warnings
    }
  }

  private getDecimalPlaces(value: number): number {
    const str = value.toString()
    const decimalIndex = str.indexOf('.')
    return decimalIndex === -1 ? 0 : str.length - decimalIndex - 1
  }
}
```

#### Choice Validator
```typescript
class ChoiceValidator extends BaseValidator<string | string[]> {
  validate(value: string | string[], rules: ChoiceValidationRules): ValidationResult {
    const errors: ValidationError[] = []
    const warnings: ValidationWarning[] = []

    // Required validation
    if (rules.required) {
      if (Array.isArray(value) && value.length === 0) {
        errors.push(this.createError(
          'REQUIRED_SELECTION',
          'Please select at least one option'
        ))
      } else if (!Array.isArray(value) && (!value || value.trim().length === 0)) {
        errors.push(this.createError(
          'REQUIRED_SELECTION', 
          'Please make a selection'
        ))
      }
    }

    if (Array.isArray(value)) {
      // Multiple choice validation
      if (rules.minSelections && value.length < rules.minSelections) {
        errors.push(this.createError(
          'INSUFFICIENT_SELECTIONS',
          `Please select at least ${rules.minSelections} options`
        ))
      }

      if (rules.maxSelections && value.length > rules.maxSelections) {
        errors.push(this.createError(
          'TOO_MANY_SELECTIONS',
          `Please select no more than ${rules.maxSelections} options`
        ))
      }

      // Valid option validation
      if (rules.validOptions) {
        const invalidOptions = value.filter(v => !rules.validOptions!.includes(v))
        if (invalidOptions.length > 0) {
          errors.push(this.createError(
            'INVALID_OPTIONS',
            `Invalid selections: ${invalidOptions.join(', ')}`
          ))
        }
      }
    } else if (value) {
      // Single choice validation
      if (rules.validOptions && !rules.validOptions.includes(value)) {
        errors.push(this.createError(
          'INVALID_OPTION',
          'Please select a valid option'
        ))
      }
    }

    return {
      isValid: errors.length === 0,
      errors,
      warnings
    }
  }
}
```

### 3. Cross-Question Validation

```typescript
class CrossQuestionValidator {
  validate(
    responses: Map<string, any>, 
    questions: Question[], 
    rules: CrossValidationRule[]
  ): ValidationResult {
    const errors: ValidationError[] = []
    const warnings: ValidationWarning[] = []

    for (const rule of rules) {
      const result = this.evaluateRule(rule, responses, questions)
      if (!result.isValid) {
        errors.push(...result.errors)
        warnings.push(...result.warnings)
      }
    }

    return {
      isValid: errors.length === 0,
      errors,
      warnings
    }
  }

  private evaluateRule(
    rule: CrossValidationRule, 
    responses: Map<string, any>, 
    questions: Question[]
  ): ValidationResult {
    switch (rule.type) {
      case 'dependency':
        return this.validateDependency(rule, responses)
      
      case 'consistency':
        return this.validateConsistency(rule, responses)
      
      case 'completeness':
        return this.validateCompleteness(rule, responses, questions)
      
      default:
        return { isValid: true, errors: [], warnings: [] }
    }
  }

  private validateDependency(
    rule: DependencyRule, 
    responses: Map<string, any>
  ): ValidationResult {
    const dependentValue = responses.get(rule.dependentQuestion)
    const requiredValue = responses.get(rule.requiredQuestion)

    if (dependentValue && !requiredValue) {
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
      }
    }

    return { isValid: true, errors: [], warnings: [] }
  }

  private validateConsistency(
    rule: ConsistencyRule, 
    responses: Map<string, any>
  ): ValidationResult {
    const values = rule.questions.map(q => responses.get(q))
    
    if (rule.mustMatch && values.length > 1) {
      const firstValue = values[0]
      const allMatch = values.every(v => v === firstValue)
      
      if (!allMatch) {
        return {
          isValid: false,
          errors: [{
            code: 'CONSISTENCY_VIOLATION',
            message: rule.message || 'These fields must match',
            severity: 'error'
          }],
          warnings: []
        }
      }
    }

    return { isValid: true, errors: [], warnings: [] }
  }
}
```

## Error Handling Framework

### 1. Centralized Error Handler

```typescript
class ErrorHandler {
  private logger: Logger
  private errorReporter: ErrorReporter

  constructor(logger: Logger, errorReporter: ErrorReporter) {
    this.logger = logger
    this.errorReporter = errorReporter
  }

  handleError(error: Error, context?: ErrorContext): ErrorHandlingResult {
    // Log the error
    this.logger.error(error.message, { error, context })

    // Classify the error
    const errorType = this.classifyError(error)

    // Determine recovery strategy
    const recovery = this.determineRecovery(errorType, context)

    // Report if necessary
    if (this.shouldReport(errorType)) {
      this.errorReporter.report(error, context)
    }

    return {
      type: errorType,
      recovery,
      userMessage: this.getUserMessage(errorType, error),
      canRecover: recovery.type !== 'fatal'
    }
  }

  private classifyError(error: Error): ErrorType {
    if (error instanceof ValidationError) {
      return ErrorType.VALIDATION
    }
    if (error instanceof StorageError) {
      return ErrorType.STORAGE
    }
    if (error instanceof FlowError) {
      return ErrorType.FLOW
    }
    if (error instanceof NetworkError) {
      return ErrorType.NETWORK
    }
    
    return ErrorType.UNKNOWN
  }

  private determineRecovery(type: ErrorType, context?: ErrorContext): RecoveryStrategy {
    switch (type) {
      case ErrorType.VALIDATION:
        return { type: 'retry', message: 'Please correct the input and try again' }
      
      case ErrorType.STORAGE:
        return { type: 'fallback', message: 'Using temporary storage' }
      
      case ErrorType.NETWORK:
        return { type: 'retry', message: 'Retrying operation...', maxRetries: 3 }
      
      case ErrorType.FLOW:
        return { type: 'reset', message: 'Resetting to previous state' }
      
      default:
        return { type: 'fatal', message: 'Application error occurred' }
    }
  }

  private getUserMessage(type: ErrorType, error: Error): string {
    const userMessages = {
      [ErrorType.VALIDATION]: 'Please check your input and try again.',
      [ErrorType.STORAGE]: 'Unable to save data. Your progress may be lost.',
      [ErrorType.NETWORK]: 'Connection issue. Please check your internet connection.',
      [ErrorType.FLOW]: 'Navigation error. Returning to previous question.',
      [ErrorType.UNKNOWN]: 'An unexpected error occurred. Please try again.'
    }

    return userMessages[type] || userMessages[ErrorType.UNKNOWN]
  }
}
```

### 2. Error Recovery System

```typescript
class ErrorRecoveryManager {
  private recoveryStrategies = new Map<ErrorType, RecoveryHandler>()

  constructor() {
    this.registerDefaultStrategies()
  }

  async executeRecovery(
    strategy: RecoveryStrategy, 
    context: ErrorContext
  ): Promise<RecoveryResult> {
    const handler = this.recoveryStrategies.get(strategy.type)
    
    if (!handler) {
      throw new Error(`No recovery handler for strategy: ${strategy.type}`)
    }

    return await handler.execute(strategy, context)
  }

  private registerDefaultStrategies(): void {
    this.recoveryStrategies.set(ErrorType.VALIDATION, new ValidationRecoveryHandler())
    this.recoveryStrategies.set(ErrorType.STORAGE, new StorageRecoveryHandler())
    this.recoveryStrategies.set(ErrorType.NETWORK, new NetworkRecoveryHandler())
    this.recoveryStrategies.set(ErrorType.FLOW, new FlowRecoveryHandler())
  }
}

class ValidationRecoveryHandler implements RecoveryHandler {
  async execute(strategy: RecoveryStrategy, context: ErrorContext): Promise<RecoveryResult> {
    // Reset form to last valid state
    // Show detailed error messages
    // Allow user to correct input
    
    return {
      success: true,
      message: 'Form reset for correction',
      nextAction: 'retry'
    }
  }
}
```

## Error UI Components

### 1. Error Display Component

```typescript
class ErrorDisplayComponent {
  render(errors: ValidationError[], warnings: ValidationWarning[]): string {
    let output = ''

    if (errors.length > 0) {
      output += chalk.red('\n✗ Errors:\n')
      errors.forEach(error => {
        output += chalk.red(`  • ${error.message}\n`)
      })
    }

    if (warnings.length > 0) {
      output += chalk.yellow('\n⚠ Warnings:\n')
      warnings.forEach(warning => {
        output += chalk.yellow(`  • ${warning.message}\n`)
      })
    }

    return output
  }

  renderInline(error: ValidationError): string {
    const icon = error.severity === 'error' ? '✗' : '⚠'
    const color = error.severity === 'error' ? chalk.red : chalk.yellow
    
    return color(`${icon} ${error.message}`)
  }
}
```

### 2. Validation Feedback Integration

```typescript
class ValidationFeedbackManager {
  private errorDisplay: ErrorDisplayComponent

  constructor() {
    this.errorDisplay = new ErrorDisplayComponent()
  }

  async showValidationFeedback(
    result: ValidationResult, 
    question: Question
  ): Promise<void> {
    if (!result.isValid || result.warnings.length > 0) {
      const feedback = this.errorDisplay.render(result.errors, result.warnings)
      console.log(feedback)

      if (!result.isValid) {
        // Show retry prompt
        const retry = await inquirer.prompt([{
          type: 'confirm',
          name: 'retry',
          message: 'Would you like to correct your answer?',
          default: true
        }])

        if (!retry.retry) {
          throw new UserCancelledError('User chose not to correct input')
        }
      }
    }
  }
}
```

## File Structure
```
src/core/
├── validation/
│   ├── validators/
│   │   ├── base-validator.ts       # Base validation framework
│   │   ├── text-validator.ts       # Text input validation
│   │   ├── number-validator.ts     # Number validation
│   │   ├── choice-validator.ts     # Choice validation
│   │   ├── date-validator.ts       # Date validation
│   │   └── email-validator.ts      # Email validation
│   ├── cross-validation/
│   │   ├── cross-validator.ts      # Cross-question validation
│   │   ├── dependency-rules.ts     # Dependency validation
│   │   └── consistency-rules.ts    # Consistency validation
│   └── validation-manager.ts       # Main validation coordinator
├── errors/
│   ├── error-handler.ts           # Centralized error handling
│   ├── error-recovery.ts          # Error recovery system
│   ├── error-types.ts             # Error type definitions
│   └── recovery-strategies.ts     # Recovery strategy implementations
└── ui/
    ├── error-display.ts           # Error UI components
    ├── validation-feedback.ts     # Validation feedback manager
    └── error-formatting.ts        # Error message formatting
```

## Testing Requirements

### Validation Testing
- Unit tests for each validator
- Edge case validation scenarios
- Performance testing with large inputs
- Cross-validation rule testing

### Error Handling Testing
- Error classification accuracy
- Recovery strategy effectiveness
- User experience testing
- Error message clarity

## Performance Considerations

### Optimization Strategies
- Debounced real-time validation
- Efficient error state management
- Minimal UI updates for errors
- Cached validation results

### Memory Management
- Cleanup of validation state
- Efficient error message storage
- Garbage collection of old errors

## Acceptance Criteria
- [x] All question types have comprehensive validation
- [x] Real-time validation provides immediate feedback
- [x] Error messages are clear and actionable
- [x] Cross-question validation works correctly
- [x] Error recovery strategies are effective
- [x] UI provides excellent error experience
- [x] Performance is acceptable for complex validation
- [x] All error scenarios are handled gracefully
- [x] Validation is accessible and user-friendly
- [x] Error logging and reporting works correctly

## Dependencies
- Zod (schema validation)
- Chalk (error message styling)
- Inquirer.js (UI integration)
- Validator.js (input validation utilities)

