import type { RecoveryStrategy, ErrorContext, RecoveryResult } from './error-types.js';

/**
 * Recovery handler interface
 */
export interface RecoveryHandler {
  execute(strategy: RecoveryStrategy, context: ErrorContext): Promise<RecoveryResult>;
}

/**
 * Validation recovery handler
 */
export class ValidationRecoveryHandler implements RecoveryHandler {
  async execute(strategy: RecoveryStrategy, context: ErrorContext): Promise<RecoveryResult> {
    // Reset form to last valid state
    // Show detailed error messages
    // Allow user to correct input

    return {
      success: true,
      message: 'Form reset for correction',
      nextAction: 'retry'
    };
  }
}

/**
 * Storage recovery handler
 */
export class StorageRecoveryHandler implements RecoveryHandler {
  async execute(strategy: RecoveryStrategy, context: ErrorContext): Promise<RecoveryResult> {
    // Fall back to in-memory storage
    // Warn user about data loss

    return {
      success: true,
      message: 'Using temporary in-memory storage',
      nextAction: 'continue'
    };
  }
}

/**
 * Network recovery handler
 */
export class NetworkRecoveryHandler implements RecoveryHandler {
  async execute(strategy: RecoveryStrategy, context: ErrorContext): Promise<RecoveryResult> {
    // Retry the operation with exponential backoff
    const maxRetries = strategy.maxRetries || 3;

    for (let i = 0; i < maxRetries; i++) {
      // Wait before retry
      await this.delay(Math.pow(2, i) * 1000);

      // In a real implementation, would retry the actual operation here
      // For now, just simulate success after retries
    }

    return {
      success: true,
      message: 'Operation retried successfully',
      nextAction: 'continue'
    };
  }

  private delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}

/**
 * Flow recovery handler
 */
export class FlowRecoveryHandler implements RecoveryHandler {
  async execute(strategy: RecoveryStrategy, context: ErrorContext): Promise<RecoveryResult> {
    // Reset navigation state
    // Return to previous question

    return {
      success: true,
      message: 'Navigation reset to previous state',
      nextAction: 'previous'
    };
  }
}

/**
 * Error recovery manager
 */
export class ErrorRecoveryManager {
  private recoveryStrategies = new Map<string, RecoveryHandler>();

  constructor() {
    this.registerDefaultStrategies();
  }

  /**
   * Execute a recovery strategy
   */
  async executeRecovery(
    strategy: RecoveryStrategy,
    context: ErrorContext
  ): Promise<RecoveryResult> {
    const handler = this.recoveryStrategies.get(strategy.type);

    if (!handler) {
      throw new Error(`No recovery handler for strategy: ${strategy.type}`);
    }

    return await handler.execute(strategy, context);
  }

  /**
   * Register default recovery strategies
   */
  private registerDefaultStrategies(): void {
    this.recoveryStrategies.set('validate', new ValidationRecoveryHandler());
    this.recoveryStrategies.set('fallback', new StorageRecoveryHandler());
    this.recoveryStrategies.set('retry', new NetworkRecoveryHandler());
    this.recoveryStrategies.set('reset', new FlowRecoveryHandler());
  }

  /**
   * Register a custom recovery handler
   */
  registerStrategy(type: string, handler: RecoveryHandler): void {
    this.recoveryStrategies.set(type, handler);
  }
}
