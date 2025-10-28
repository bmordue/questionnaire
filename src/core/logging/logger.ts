/**
 * Logging Framework
 * 
 * Structured logging with configurable levels and outputs
 */

/**
 * Log levels
 */
export enum LogLevel {
  DEBUG = 0,
  INFO = 1,
  WARN = 2,
  ERROR = 3,
  SILENT = 4
}

/**
 * Logger interface
 */
export interface Logger {
  debug(message: string, context?: any): void;
  info(message: string, context?: any): void;
  warn(message: string, context?: any): void;
  error(message: string, context?: any): void;
  setLevel(level: LogLevel): void;
}

/**
 * Console logger implementation
 */
export class ConsoleLogger implements Logger {
  private level: LogLevel;

  constructor(level: LogLevel = LogLevel.INFO) {
    this.level = level;
  }

  setLevel(level: LogLevel): void {
    this.level = level;
  }

  debug(message: string, context?: any): void {
    if (this.level <= LogLevel.DEBUG) {
      this.logToConsole(console.debug, message, context);
    }
  }

  info(message: string, context?: any): void {
    if (this.level <= LogLevel.INFO) {
      this.logToConsole(console.info, message, context);
    }
  }

  warn(message: string, context?: any): void {
    if (this.level <= LogLevel.WARN) {
      this.logToConsole(console.warn, message, context);
    }
  }

  error(message: string, context?: any): void {
    if (this.level <= LogLevel.ERROR) {
      this.logToConsole(console.error, message, context);
    }
  }

  /**
   * Helper method to log to console with optional context
   */
  private logToConsole(logFn: (...args: any[]) => void, message: string, context?: any): void {
    if (context !== undefined) {
      logFn(message, context);
    } else {
      logFn(message);
    }
  }
}

/**
 * Default logger instance
 */
let defaultLogger: Logger = new ConsoleLogger();

/**
 * Get the default logger instance
 */
export function getLogger(): Logger {
  return defaultLogger;
}

/**
 * Set the default logger instance
 * @param logger - Logger instance to use as default
 */
export function setLogger(logger: Logger): void {
  defaultLogger = logger;
}

/**
 * Configure the default logger level
 * @param level - Log level to set
 */
export function setLogLevel(level: LogLevel): void {
  defaultLogger.setLevel(level);
}
