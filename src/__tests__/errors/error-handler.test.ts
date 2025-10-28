import { describe, it, expect } from '@jest/globals';
import {
  ErrorHandler,
  ValidationError,
  StorageError,
  FlowError,
  NetworkError,
  UserCancelledError,
  ErrorType
} from '../../core/errors/index.js';

describe('Error Handling', () => {
  describe('Custom Error Types', () => {
    it('should create ValidationError correctly', () => {
      const error = new ValidationError('Invalid input', 'INVALID', 'field1');
      expect(error.name).toBe('ValidationError');
      expect(error.message).toBe('Invalid input');
      expect(error.code).toBe('INVALID');
      expect(error.field).toBe('field1');
    });

    it('should create StorageError correctly', () => {
      const error = new StorageError('Cannot save', 'SAVE_FAILED');
      expect(error.name).toBe('StorageError');
      expect(error.message).toBe('Cannot save');
      expect(error.code).toBe('SAVE_FAILED');
    });

    it('should create FlowError correctly', () => {
      const error = new FlowError('Navigation failed', 'NAV_ERROR');
      expect(error.name).toBe('FlowError');
      expect(error.message).toBe('Navigation failed');
    });

    it('should create NetworkError correctly', () => {
      const error = new NetworkError('Connection lost', 'CONN_ERROR');
      expect(error.name).toBe('NetworkError');
      expect(error.message).toBe('Connection lost');
    });

    it('should create UserCancelledError correctly', () => {
      const error = new UserCancelledError();
      expect(error.name).toBe('UserCancelledError');
      expect(error.message).toBe('User cancelled operation');
    });
  });

  describe('ErrorHandler', () => {
    const handler = new ErrorHandler();

    describe('classifyError', () => {
      it('should classify ValidationError correctly', () => {
        const error = new ValidationError('Invalid');
        const result = handler.handleError(error);
        expect(result.type).toBe(ErrorType.VALIDATION);
        expect(result.recovery.type).toBe('retry');
      });

      it('should classify StorageError correctly', () => {
        const error = new StorageError('Cannot save');
        const result = handler.handleError(error);
        expect(result.type).toBe(ErrorType.STORAGE);
        expect(result.recovery.type).toBe('fallback');
      });

      it('should classify FlowError correctly', () => {
        const error = new FlowError('Navigation failed');
        const result = handler.handleError(error);
        expect(result.type).toBe(ErrorType.FLOW);
        expect(result.recovery.type).toBe('reset');
      });

      it('should classify NetworkError correctly', () => {
        const error = new NetworkError('Connection lost');
        const result = handler.handleError(error);
        expect(result.type).toBe(ErrorType.NETWORK);
        expect(result.recovery.type).toBe('retry');
        expect(result.recovery.maxRetries).toBe(3);
      });

      it('should classify unknown errors', () => {
        const error = new Error('Unknown error');
        const result = handler.handleError(error);
        expect(result.type).toBe(ErrorType.UNKNOWN);
        expect(result.recovery.type).toBe('fatal');
      });
    });

    describe('recovery strategies', () => {
      it('should allow recovery for validation errors', () => {
        const error = new ValidationError('Invalid');
        const result = handler.handleError(error);
        expect(result.canRecover).toBe(true);
      });

      it('should allow recovery for storage errors', () => {
        const error = new StorageError('Cannot save');
        const result = handler.handleError(error);
        expect(result.canRecover).toBe(true);
      });

      it('should not allow recovery for unknown errors', () => {
        const error = new Error('Unknown');
        const result = handler.handleError(error);
        expect(result.canRecover).toBe(false);
      });
    });

    describe('user messages', () => {
      it('should provide user-friendly message for validation errors', () => {
        const error = new ValidationError('Field is required');
        const result = handler.handleError(error);
        expect(result.userMessage).toBe('Field is required');
      });

      it('should provide user-friendly message for storage errors', () => {
        const error = new StorageError('Cannot save');
        const result = handler.handleError(error);
        expect(result.userMessage).toContain('save data');
      });

      it('should provide user-friendly message for network errors', () => {
        const error = new NetworkError('Connection lost');
        const result = handler.handleError(error);
        expect(result.userMessage).toContain('Connection');
      });
    });

    describe('error context', () => {
      it('should handle error with context', () => {
        const error = new ValidationError('Invalid');
        const context = {
          operation: 'validateAnswer',
          questionId: 'q1',
          responseId: 'r1'
        };
        const result = handler.handleError(error, context);
        expect(result).toBeDefined();
        expect(result.type).toBe(ErrorType.VALIDATION);
      });
    });
  });
});
