/**
 * Logging Framework Tests
 */

import { describe, it, expect, beforeEach, afterEach, jest } from '@jest/globals';
import {
  LogLevel,
  ConsoleLogger,
  getLogger,
  setLogger,
  setLogLevel,
  type Logger
} from '../../core/logging/logger.js';

describe('Logging Framework', () => {
  describe('ConsoleLogger', () => {
    let logger: ConsoleLogger;
    let consoleDebugSpy: jest.SpiedFunction<typeof console.debug>;
    let consoleInfoSpy: jest.SpiedFunction<typeof console.info>;
    let consoleWarnSpy: jest.SpiedFunction<typeof console.warn>;
    let consoleErrorSpy: jest.SpiedFunction<typeof console.error>;

    beforeEach(() => {
      consoleDebugSpy = jest.spyOn(console, 'debug').mockImplementation(() => {});
      consoleInfoSpy = jest.spyOn(console, 'info').mockImplementation(() => {});
      consoleWarnSpy = jest.spyOn(console, 'warn').mockImplementation(() => {});
      consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
    });

    afterEach(() => {
      consoleDebugSpy.mockRestore();
      consoleInfoSpy.mockRestore();
      consoleWarnSpy.mockRestore();
      consoleErrorSpy.mockRestore();
    });

    it('should log debug messages when level is DEBUG', () => {
      logger = new ConsoleLogger(LogLevel.DEBUG);
      logger.debug('test message', { foo: 'bar' });
      
      expect(consoleDebugSpy).toHaveBeenCalledWith('test message', { foo: 'bar' });
    });

    it('should not log debug messages when level is INFO', () => {
      logger = new ConsoleLogger(LogLevel.INFO);
      logger.debug('test message');
      
      expect(consoleDebugSpy).not.toHaveBeenCalled();
    });

    it('should log info messages when level is INFO', () => {
      logger = new ConsoleLogger(LogLevel.INFO);
      logger.info('test message', { foo: 'bar' });
      
      expect(consoleInfoSpy).toHaveBeenCalledWith('test message', { foo: 'bar' });
    });

    it('should not log info messages when level is WARN', () => {
      logger = new ConsoleLogger(LogLevel.WARN);
      logger.info('test message');
      
      expect(consoleInfoSpy).not.toHaveBeenCalled();
    });

    it('should log warn messages when level is WARN', () => {
      logger = new ConsoleLogger(LogLevel.WARN);
      logger.warn('test message', { foo: 'bar' });
      
      expect(consoleWarnSpy).toHaveBeenCalledWith('test message', { foo: 'bar' });
    });

    it('should not log warn messages when level is ERROR', () => {
      logger = new ConsoleLogger(LogLevel.ERROR);
      logger.warn('test message');
      
      expect(consoleWarnSpy).not.toHaveBeenCalled();
    });

    it('should log error messages when level is ERROR', () => {
      logger = new ConsoleLogger(LogLevel.ERROR);
      logger.error('test message', { foo: 'bar' });
      
      expect(consoleErrorSpy).toHaveBeenCalledWith('test message', { foo: 'bar' });
    });

    it('should not log anything when level is SILENT', () => {
      logger = new ConsoleLogger(LogLevel.SILENT);
      logger.debug('debug');
      logger.info('info');
      logger.warn('warn');
      logger.error('error');
      
      expect(consoleDebugSpy).not.toHaveBeenCalled();
      expect(consoleInfoSpy).not.toHaveBeenCalled();
      expect(consoleWarnSpy).not.toHaveBeenCalled();
      expect(consoleErrorSpy).not.toHaveBeenCalled();
    });

    it('should handle undefined context gracefully', () => {
      logger = new ConsoleLogger(LogLevel.INFO);
      logger.info('test message');
      
      expect(consoleInfoSpy).toHaveBeenCalledWith('test message');
    });

    it('should allow changing log level', () => {
      logger = new ConsoleLogger(LogLevel.ERROR);
      logger.info('test message');
      expect(consoleInfoSpy).not.toHaveBeenCalled();
      
      logger.setLevel(LogLevel.INFO);
      logger.info('test message');
      expect(consoleInfoSpy).toHaveBeenCalled();
    });
  });

  describe('Global Logger', () => {
    let consoleInfoSpy: jest.SpiedFunction<typeof console.info>;

    beforeEach(() => {
      consoleInfoSpy = jest.spyOn(console, 'info').mockImplementation(() => {});
    });

    afterEach(() => {
      consoleInfoSpy.mockRestore();
      // Reset to default logger
      setLogger(new ConsoleLogger());
    });

    it('should return default logger', () => {
      const logger = getLogger();
      expect(logger).toBeDefined();
    });

    it('should allow setting custom logger', () => {
      const customLogger: Logger = {
        debug: jest.fn(),
        info: jest.fn(),
        warn: jest.fn(),
        error: jest.fn(),
        setLevel: jest.fn()
      };

      setLogger(customLogger);
      const logger = getLogger();
      
      logger.info('test');
      expect(customLogger.info).toHaveBeenCalledWith('test');
    });

    it('should allow setting log level on default logger', () => {
      setLogLevel(LogLevel.ERROR);
      const logger = getLogger();
      
      logger.info('test');
      expect(consoleInfoSpy).not.toHaveBeenCalled();
    });
  });
});
