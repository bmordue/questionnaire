import { describe, it, expect, beforeEach } from '@jest/globals';
import { ErrorStateManager } from '../../../ui/error/error-state-manager.js';
import type { ValidationError, ValidationWarning } from '../../../core/validation/types.js';

describe('ErrorStateManager', () => {
  let manager: ErrorStateManager;

  beforeEach(() => {
    manager = new ErrorStateManager();
  });

  describe('error management', () => {
    it('should set and get errors for a field', () => {
      const errors: ValidationError[] = [
        { code: 'ERROR1', message: 'Error 1', severity: 'error' }
      ];
      
      manager.setErrors('field1', errors);
      expect(manager.getErrors('field1')).toEqual(errors);
    });

    it('should return empty array for field with no errors', () => {
      expect(manager.getErrors('nonexistent')).toEqual([]);
    });

    it('should clear errors when set to empty array', () => {
      manager.setErrors('field1', [{ code: 'ERROR', message: 'Error', severity: 'error' }]);
      manager.setErrors('field1', []);
      expect(manager.getErrors('field1')).toEqual([]);
    });

    it('should clear errors for a field', () => {
      manager.setErrors('field1', [{ code: 'ERROR', message: 'Error', severity: 'error' }]);
      manager.clearErrors('field1');
      expect(manager.getErrors('field1')).toEqual([]);
    });

    it('should clear all errors', () => {
      manager.setErrors('field1', [{ code: 'ERROR', message: 'Error', severity: 'error' }]);
      manager.setErrors('field2', [{ code: 'ERROR', message: 'Error', severity: 'error' }]);
      manager.clearAllErrors();
      expect(manager.hasAnyErrors()).toBe(false);
    });
  });

  describe('warning management', () => {
    it('should set and get warnings for a field', () => {
      const warnings: ValidationWarning[] = [
        { code: 'WARN1', message: 'Warning 1', severity: 'warning' }
      ];
      
      manager.setWarnings('field1', warnings);
      expect(manager.getWarnings('field1')).toEqual(warnings);
    });

    it('should clear warnings for a field', () => {
      manager.setWarnings('field1', [{ code: 'WARN', message: 'Warning', severity: 'warning' }]);
      manager.clearWarnings('field1');
      expect(manager.getWarnings('field1')).toEqual([]);
    });

    it('should clear all warnings', () => {
      manager.setWarnings('field1', [{ code: 'WARN', message: 'Warning', severity: 'warning' }]);
      manager.setWarnings('field2', [{ code: 'WARN', message: 'Warning', severity: 'warning' }]);
      manager.clearAllWarnings();
      expect(manager.getWarningCount()).toBe(0);
    });
  });

  describe('touched state', () => {
    it('should mark field as touched', () => {
      manager.markTouched('field1');
      expect(manager.isTouched('field1')).toBe(true);
    });

    it('should return false for untouched field', () => {
      expect(manager.isTouched('field1')).toBe(false);
    });
  });

  describe('error checks', () => {
    it('should detect if field has errors', () => {
      manager.setErrors('field1', [{ code: 'ERROR', message: 'Error', severity: 'error' }]);
      expect(manager.hasErrors('field1')).toBe(true);
    });

    it('should detect if field has warnings', () => {
      manager.setWarnings('field1', [{ code: 'WARN', message: 'Warning', severity: 'warning' }]);
      expect(manager.hasWarnings('field1')).toBe(true);
    });

    it('should detect if any errors exist', () => {
      manager.setErrors('field1', [{ code: 'ERROR', message: 'Error', severity: 'error' }]);
      expect(manager.hasAnyErrors()).toBe(true);
    });
  });

  describe('counts', () => {
    it('should count total errors', () => {
      manager.setErrors('field1', [
        { code: 'ERROR1', message: 'Error 1', severity: 'error' },
        { code: 'ERROR2', message: 'Error 2', severity: 'error' }
      ]);
      manager.setErrors('field2', [
        { code: 'ERROR3', message: 'Error 3', severity: 'error' }
      ]);
      expect(manager.getErrorCount()).toBe(3);
    });

    it('should count total warnings', () => {
      manager.setWarnings('field1', [
        { code: 'WARN1', message: 'Warning 1', severity: 'warning' }
      ]);
      manager.setWarnings('field2', [
        { code: 'WARN2', message: 'Warning 2', severity: 'warning' }
      ]);
      expect(manager.getWarningCount()).toBe(2);
    });
  });

  describe('field lists', () => {
    it('should get fields with errors', () => {
      manager.setErrors('field1', [{ code: 'ERROR', message: 'Error', severity: 'error' }]);
      manager.setErrors('field2', [{ code: 'ERROR', message: 'Error', severity: 'error' }]);
      const fields = manager.getFieldsWithErrors();
      expect(fields).toContain('field1');
      expect(fields).toContain('field2');
    });

    it('should get fields with warnings', () => {
      manager.setWarnings('field1', [{ code: 'WARN', message: 'Warning', severity: 'warning' }]);
      const fields = manager.getFieldsWithWarnings();
      expect(fields).toContain('field1');
    });
  });

  describe('summary', () => {
    it('should provide validation state summary', () => {
      manager.setErrors('field1', [{ code: 'ERROR', message: 'Error', severity: 'error' }]);
      manager.setWarnings('field2', [{ code: 'WARN', message: 'Warning', severity: 'warning' }]);
      manager.markTouched('field1');
      manager.markTouched('field2');

      const summary = manager.getSummary();
      expect(summary.errorCount).toBe(1);
      expect(summary.warningCount).toBe(1);
      expect(summary.fieldsWithErrors).toContain('field1');
      expect(summary.fieldsWithWarnings).toContain('field2');
      expect(summary.touchedFields).toHaveLength(2);
    });
  });

  describe('reset', () => {
    it('should reset all state', () => {
      manager.setErrors('field1', [{ code: 'ERROR', message: 'Error', severity: 'error' }]);
      manager.setWarnings('field1', [{ code: 'WARN', message: 'Warning', severity: 'warning' }]);
      manager.markTouched('field1');

      manager.reset();

      expect(manager.getErrorCount()).toBe(0);
      expect(manager.getWarningCount()).toBe(0);
      expect(manager.isTouched('field1')).toBe(false);
    });
  });
});
