# Logging Framework

A structured logging framework with configurable log levels and extensible logger implementations.

## Overview

The logging framework provides a standardized way to log messages throughout the application with support for different log levels and custom logger implementations.

## Features

- **Log Levels**: DEBUG, INFO, WARN, ERROR, SILENT
- **Structured Logging**: Support for contextual data alongside log messages
- **Configurable**: Change log levels at runtime
- **Extensible**: Easy to implement custom logger backends
- **Type-Safe**: Full TypeScript support with interfaces

## Basic Usage

```typescript
import { getLogger } from './core/logging/index.js';

const logger = getLogger();

// Log messages at different levels
logger.debug('Debug message');
logger.info('Info message');
logger.warn('Warning message');
logger.error('Error message');

// Log with context
logger.info('User logged in', { 
  userId: 'user123', 
  timestamp: new Date().toISOString() 
});
```

## Configuring Log Level

```typescript
import { setLogLevel, LogLevel } from './core/logging/index.js';

// Set to DEBUG to see all messages
setLogLevel(LogLevel.DEBUG);

// Set to ERROR to only see errors
setLogLevel(LogLevel.ERROR);

// Set to SILENT to suppress all logging
setLogLevel(LogLevel.SILENT);
```

## Log Levels

| Level | Value | Description |
|-------|-------|-------------|
| DEBUG | 0 | Detailed information for debugging |
| INFO  | 1 | General informational messages |
| WARN  | 2 | Warning messages for potentially problematic situations |
| ERROR | 3 | Error messages for serious problems |
| SILENT| 4 | Suppress all logging |

Messages are logged if their level is greater than or equal to the configured level.

## Custom Logger Implementation

You can implement a custom logger by implementing the `Logger` interface:

```typescript
import { Logger, setLogger } from './core/logging/index.js';

class MyCustomLogger implements Logger {
  debug(message: string, context?: any): void {
    // Your custom debug implementation
  }
  
  info(message: string, context?: any): void {
    // Your custom info implementation
  }
  
  warn(message: string, context?: any): void {
    // Your custom warn implementation
  }
  
  error(message: string, context?: any): void {
    // Your custom error implementation
  }
  
  setLevel(level: LogLevel): void {
    // Your custom level configuration
  }
}

// Use your custom logger
setLogger(new MyCustomLogger());
```

## Usage in Modules

Import the logger at the module level for consistent logging:

```typescript
import { getLogger } from '../logging/index.js';

const logger = getLogger();

export class MyClass {
  async doSomething(): Promise<void> {
    try {
      // ... operation
      logger.info('Operation completed successfully');
    } catch (error) {
      logger.error('Operation failed', error);
      throw error;
    }
  }
}
```

## Example

Run the logging example to see the framework in action:

```bash
npm run logging-example
```

This will demonstrate:
- Different log levels (DEBUG, INFO, WARN, ERROR)
- Changing log levels at runtime
- Logging with context objects
- How the framework filters messages based on current log level

## Migration from console.warn

The logging framework replaces direct `console.warn` calls throughout the codebase:

**Before:**
```typescript
console.warn(`Failed to read file ${file}:`, error);
```

**After:**
```typescript
import { getLogger } from '../logging/index.js';
const logger = getLogger();

logger.warn(`Failed to read file ${file}:`, error);
```

## Benefits

1. **Consistency**: Standardized logging interface across the application
2. **Flexibility**: Easy to change logging behavior without modifying code
3. **Testing**: Mock loggers for unit tests
4. **Production**: Different log levels for development vs. production
5. **Extensibility**: Add file logging, remote logging, etc. by implementing custom loggers
