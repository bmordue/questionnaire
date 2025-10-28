import {
  ErrorType,
  ValidationError,
  StorageError,
  FlowError,
  NetworkError,
  type RecoveryStrategy,
  type ErrorContext,
  type ErrorHandlingResult
} from './error-types.js';

/**
 * Simple logger interface
 */
interface Logger {
  error(message: string, context?: any): void;
  warn(message: string, context?: any): void;
  info(message: string, context?: any): void;
}

/**
 * Console logger implementation
 */
class ConsoleLogger implements Logger {
  error(message: string, context?: any): void {
    console.error(message, context || '');
  }

  warn(message: string, context?: any): void {
    console.warn(message, context || '');
  }

  info(message: string, context?: any): void {
    console.info(message, context || '');
  }
}

/**
 * Simple error reporter interface
 */
interface ErrorReporter {
  report(error: Error, context?: ErrorContext): void;
}

/**
 * Console error reporter implementation
 */
class ConsoleErrorReporter implements ErrorReporter {
  report(error: Error, context?: ErrorContext): void {
    console.error('Error reported:', error.message, context || '');
  }
}

/**
 * Centralized error handler
 */
export class ErrorHandler {
  private logger: Logger;
  private errorReporter: ErrorReporter;

  constructor(logger?: Logger, errorReporter?: ErrorReporter) {
    this.logger = logger || new ConsoleLogger();
    this.errorReporter = errorReporter || new ConsoleErrorReporter();
  }

  /**
   * Handle an error and determine recovery strategy
   */
  handleError(error: Error, context?: ErrorContext): ErrorHandlingResult {
    // Log the error
    this.logger.error(error.message, { error, context });

    // Classify the error
    const errorType = this.classifyError(error);

    // Determine recovery strategy
    const recovery = this.determineRecovery(errorType, context);

    // Report if necessary
    if (this.shouldReport(errorType)) {
      this.errorReporter.report(error, context);
    }

    return {
      type: errorType,
      recovery,
      userMessage: this.getUserMessage(errorType, error),
      canRecover: recovery.type !== 'fatal'
    };
  }

  /**
   * Classify an error by type
   */
  private classifyError(error: Error): ErrorType {
    if (error instanceof ValidationError) {
      return ErrorType.VALIDATION;
    }
    if (error instanceof StorageError) {
      return ErrorType.STORAGE;
    }
    if (error instanceof FlowError) {
      return ErrorType.FLOW;
    }
    if (error instanceof NetworkError) {
      return ErrorType.NETWORK;
    }

    return ErrorType.UNKNOWN;
  }

  /**
   * Determine recovery strategy based on error type
   */
  private determineRecovery(type: ErrorType, context?: ErrorContext): RecoveryStrategy {
    switch (type) {
      case ErrorType.VALIDATION:
        return { type: 'retry', message: 'Please correct the input and try again' };

      case ErrorType.STORAGE:
        return { type: 'fallback', message: 'Using temporary storage' };

      case ErrorType.NETWORK:
        return { type: 'retry', message: 'Retrying operation...', maxRetries: 3 };

      case ErrorType.FLOW:
        return { type: 'reset', message: 'Resetting to previous state' };

      default:
        return { type: 'fatal', message: 'Application error occurred' };
    }
  }

  /**
   * Get user-friendly error message
   */
  private getUserMessage(type: ErrorType, error: Error): string {
    const userMessages: Record<ErrorType, string> = {
      [ErrorType.VALIDATION]: 'Please check your input and try again.',
      [ErrorType.STORAGE]: 'Unable to save data. Your progress may be lost.',
      [ErrorType.NETWORK]: 'Connection issue. Please check your internet connection.',
      [ErrorType.FLOW]: 'Navigation error. Returning to previous question.',
      [ErrorType.UNKNOWN]: 'An unexpected error occurred. Please try again.'
    };

    // Use error message if it's user-friendly, otherwise use generic message
    if (error instanceof ValidationError) {
      return error.message;
    }

    return userMessages[type] || userMessages[ErrorType.UNKNOWN];
  }

  /**
   * Determine if error should be reported
   */
  private shouldReport(type: ErrorType): boolean {
    // Report everything except validation errors (those are user errors)
    return type !== ErrorType.VALIDATION;
  }
}
