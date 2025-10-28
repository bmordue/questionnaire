import chalk from 'chalk';
import type { ValidationError, ValidationWarning } from '../../core/validation/types.js';

/**
 * Component for displaying validation errors and warnings in the terminal
 */
export class ErrorDisplayComponent {
  /**
   * Render errors and warnings as formatted text
   */
  render(errors: ValidationError[], warnings: ValidationWarning[]): string {
    let output = '';

    if (errors.length > 0) {
      output += chalk.red('\n✗ Errors:\n');
      errors.forEach(error => {
        const prefix = error.field ? `  • [${error.field}] ` : '  • ';
        output += chalk.red(`${prefix}${error.message}\n`);
      });
    }

    if (warnings.length > 0) {
      output += chalk.yellow('\n⚠ Warnings:\n');
      warnings.forEach(warning => {
        const prefix = warning.field ? `  • [${warning.field}] ` : '  • ';
        output += chalk.yellow(`${prefix}${warning.message}\n`);
      });
    }

    return output;
  }

  /**
   * Render a single error inline
   */
  renderInline(error: ValidationError): string {
    const icon = '✗';
    return chalk.red(`${icon} ${error.message}`);
  }

  /**
   * Render a single warning inline
   */
  renderInlineWarning(warning: ValidationWarning): string {
    const icon = '⚠';
    return chalk.yellow(`${icon} ${warning.message}`);
  }

  /**
   * Render error summary
   */
  renderSummary(errorCount: number, warningCount: number): string {
    let output = '\n';
    
    if (errorCount > 0) {
      output += chalk.red(`✗ ${errorCount} error${errorCount > 1 ? 's' : ''} found`);
    }
    
    if (warningCount > 0) {
      if (errorCount > 0) output += ', ';
      output += chalk.yellow(`⚠ ${warningCount} warning${warningCount > 1 ? 's' : ''}`);
    }
    
    if (errorCount === 0 && warningCount === 0) {
      output += chalk.green('✓ No errors or warnings');
    }
    
    return output + '\n';
  }

  /**
   * Render detailed error with context
   */
  renderDetailed(error: ValidationError): string {
    let output = chalk.red(`\n✗ ${error.message}\n`);
    
    if (error.code) {
      output += chalk.gray(`  Code: ${error.code}\n`);
    }
    
    if (error.field) {
      output += chalk.gray(`  Field: ${error.field}\n`);
    }
    
    if (error.context) {
      output += chalk.gray(`  Context: ${JSON.stringify(error.context, null, 2)}\n`);
    }
    
    return output;
  }

  /**
   * Render error list with numbering
   */
  renderNumbered(errors: ValidationError[]): string {
    if (errors.length === 0) {
      return chalk.green('\n✓ No errors\n');
    }

    let output = chalk.red('\n✗ Validation Errors:\n');
    errors.forEach((error, index) => {
      const prefix = error.field ? `[${error.field}] ` : '';
      output += chalk.red(`  ${index + 1}. ${prefix}${error.message}\n`);
    });
    
    return output;
  }
}
