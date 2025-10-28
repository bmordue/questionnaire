/**
 * Error types for classification
 */
export enum ErrorType {
  VALIDATION = 'validation',
  STORAGE = 'storage',
  FLOW = 'flow',
  NETWORK = 'network',
  UNKNOWN = 'unknown'
}

/**
 * Custom error class for validation errors
 */
export class ValidationError extends Error {
  constructor(message: string, public code?: string, public field?: string) {
    super(message);
    this.name = 'ValidationError';
  }
}

/**
 * Custom error class for storage errors
 */
export class StorageError extends Error {
  constructor(message: string, public code?: string) {
    super(message);
    this.name = 'StorageError';
  }
}

/**
 * Custom error class for flow/navigation errors
 */
export class FlowError extends Error {
  constructor(message: string, public code?: string) {
    super(message);
    this.name = 'FlowError';
  }
}

/**
 * Custom error class for network errors
 */
export class NetworkError extends Error {
  constructor(message: string, public code?: string) {
    super(message);
    this.name = 'NetworkError';
  }
}

/**
 * Custom error class for user cancellation
 */
export class UserCancelledError extends Error {
  constructor(message: string = 'User cancelled operation') {
    super(message);
    this.name = 'UserCancelledError';
  }
}

/**
 * Recovery strategy type
 */
export type RecoveryType = 'retry' | 'fallback' | 'reset' | 'fatal';

/**
 * Recovery strategy
 */
export interface RecoveryStrategy {
  type: RecoveryType;
  message: string;
  maxRetries?: number;
}

/**
 * Error context for debugging
 */
export interface ErrorContext {
  operation?: string;
  questionId?: string;
  responseId?: string;
  data?: any;
}

/**
 * Error handling result
 */
export interface ErrorHandlingResult {
  type: ErrorType;
  recovery: RecoveryStrategy;
  userMessage: string;
  canRecover: boolean;
}

/**
 * Recovery result
 */
export interface RecoveryResult {
  success: boolean;
  message: string;
  nextAction?: string;
}
