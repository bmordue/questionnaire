import { describe, it, expect } from '@jest/globals';
import fc from 'fast-check';
import {
  resolvePermission,
  permissionSatisfies,
  type PermissionLevel
} from '../../core/schemas/questionnaire.js';
import { TestDataFactory } from '../helpers/test-data-factory.js';

describe('Property-Based Tests: Permissions', () => {
  const allLevels: PermissionLevel[] = ['manage', 'view_responses', 'respond'];

  describe('resolvePermission', () => {
    it('admin group should always grant manage permission', () => {
      fc.assert(
        fc.property(
          fc.string({ minLength: 1 }),
          (userId) => {
            const adminGroup = process.env.ADMIN_GROUP ?? 'admins';
            const questionnaire = TestDataFactory.createValidQuestionnaire();
            const result = resolvePermission(questionnaire, userId, [adminGroup]);
            expect(result).toBe('manage');
          }
        )
      );
    });

    it('owner should always get manage permission', () => {
      fc.assert(
        fc.property(
          fc.string({ minLength: 1 }),
          (userId) => {
            const questionnaire = TestDataFactory.createValidQuestionnaire({
              ownerId: userId
            });
            const result = resolvePermission(questionnaire, userId);
            expect(result).toBe('manage');
          }
        )
      );
    });

    it('user with explicit permission should get that level', () => {
      fc.assert(
        fc.property(
          fc.string({ minLength: 1 }),
          fc.constantFrom(...allLevels),
          (userId, level) => {
            const questionnaire = TestDataFactory.createValidQuestionnaire({
              ownerId: 'someone-else',
              permissions: [{ userId, level }]
            });
            const result = resolvePermission(questionnaire, userId);
            expect(result).toBe(level);
          }
        )
      );
    });

    it('unknown user with no permissions should get null', () => {
      fc.assert(
        fc.property(
          fc.string({ minLength: 1 }),
          (userId) => {
            const questionnaire = TestDataFactory.createValidQuestionnaire({
              ownerId: 'someone-else',
              permissions: []
            });
            const result = resolvePermission(questionnaire, userId);
            expect(result).toBeNull();
          }
        )
      );
    });
  });

  describe('permissionSatisfies', () => {
    it('null permission should never satisfy any requirement', () => {
      fc.assert(
        fc.property(
          fc.constantFrom(...allLevels),
          (required) => {
            expect(permissionSatisfies(null, required)).toBe(false);
          }
        )
      );
    });

    it('manage should satisfy all permission levels', () => {
      fc.assert(
        fc.property(
          fc.constantFrom(...allLevels),
          (required) => {
            expect(permissionSatisfies('manage', required)).toBe(true);
          }
        )
      );
    });

    it('same permission level should always satisfy itself', () => {
      fc.assert(
        fc.property(
          fc.constantFrom(...allLevels),
          (level) => {
            expect(permissionSatisfies(level, level)).toBe(true);
          }
        )
      );
    });

    it('respond should not satisfy manage or view_responses', () => {
      expect(permissionSatisfies('respond', 'manage')).toBe(false);
      expect(permissionSatisfies('respond', 'view_responses')).toBe(false);
    });

    it('view_responses should not satisfy manage', () => {
      expect(permissionSatisfies('view_responses', 'manage')).toBe(false);
    });

    it('hierarchy should be transitive: if a >= b and b >= c then a >= c', () => {
      fc.assert(
        fc.property(
          fc.constantFrom(...allLevels),
          fc.constantFrom(...allLevels),
          fc.constantFrom(...allLevels),
          (a, b, c) => {
            if (permissionSatisfies(a, b) && permissionSatisfies(b, c)) {
              expect(permissionSatisfies(a, c)).toBe(true);
            }
          }
        )
      );
    });
  });
});
