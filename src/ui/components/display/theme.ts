import chalk from 'chalk';

/**
 * UI theme configuration for terminal output
 */
export const theme = {
  primary: chalk.blue,
  success: chalk.green,
  warning: chalk.yellow,
  error: chalk.red,
  info: chalk.cyan,
  muted: chalk.gray
};

/**
 * Message formatter for consistent UI messaging
 */
export class MessageFormatter {
  /**
   * Format a question with optional description and required indicator
   */
  static formatQuestion(text: string, description?: string, required?: boolean): string {
    let message = theme.primary(text);
    
    if (description) {
      message += `\n${theme.muted(description)}`;
    }
    
    if (required) {
      message += theme.error(' *');
    }
    
    return message;
  }

  /**
   * Format an error message
   */
  static formatError(message: string): string {
    return theme.error(`✗ ${message}`);
  }

  /**
   * Format a success message
   */
  static formatSuccess(message: string): string {
    return theme.success(`✓ ${message}`);
  }

  /**
   * Format an info message
   */
  static formatInfo(message: string): string {
    return theme.info(message);
  }

  /**
   * Format a muted/secondary message
   */
  static formatMuted(message: string): string {
    return theme.muted(message);
  }

  /**
   * Format a warning message
   */
  static formatWarning(message: string): string {
    return theme.warning(`⚠ ${message}`);
  }
}
