/**
 * Logging Framework Example
 * 
 * Demonstrates the usage of the structured logging framework
 */

import { getLogger, setLogLevel, LogLevel } from './core/logging/index.js';

const logger = getLogger();

console.log('=== Logging Framework Example ===\n');

// Example 1: Default log level (INFO)
console.log('--- Example 1: Default log level (INFO) ---');
logger.debug('This debug message will NOT be shown');
logger.info('This info message WILL be shown');
logger.warn('This warning message WILL be shown');
logger.error('This error message WILL be shown');

console.log('\n--- Example 2: Change to DEBUG level ---');
setLogLevel(LogLevel.DEBUG);
logger.debug('Now debug messages are visible', { module: 'example', timestamp: new Date().toISOString() });
logger.info('Info messages are still visible');

console.log('\n--- Example 3: Change to ERROR level ---');
setLogLevel(LogLevel.ERROR);
logger.debug('Debug messages are hidden');
logger.info('Info messages are hidden');
logger.warn('Warning messages are hidden');
logger.error('Only error messages are shown', { errorCode: 'ERR_001' });

console.log('\n--- Example 4: Using with context ---');
setLogLevel(LogLevel.INFO);
logger.info('User login attempt', {
  userId: 'user123',
  timestamp: new Date().toISOString(),
  ip: '192.168.1.1'
});

logger.warn('Failed login attempt', {
  userId: 'user456',
  attempts: 3,
  reason: 'invalid_password'
});

console.log('\n--- Example 5: Storage module logging simulation ---');
logger.warn('Failed to read session file session-123.json:', new Error('File not found'));

console.log('\n✓ Logging framework demonstration complete!');
