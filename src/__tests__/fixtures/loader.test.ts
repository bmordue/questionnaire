import { describe, it, expect } from '@jest/globals';
import { FixtureLoader } from '../../fixtures/loader.js';

describe('FixtureLoader', () => {
  describe('loadBasicFixtures', () => {
    it('should load all basic fixtures', async () => {
      const fixtures = await FixtureLoader.loadBasicFixtures();
      
      expect(fixtures).toBeDefined();
      expect(fixtures.length).toBeGreaterThan(0);
      expect(fixtures.length).toBe(3); // simple-text-survey, choice-based-quiz, boolean-preferences
    });

    it('should validate basic fixtures against schema', async () => {
      const fixtures = await FixtureLoader.loadBasicFixtures();
      
      fixtures.forEach(fixture => {
        expect(fixture).toHaveProperty('id');
        expect(fixture).toHaveProperty('metadata');
        expect(fixture.metadata).toHaveProperty('title');
        expect(fixture).toHaveProperty('questions');
        expect(Array.isArray(fixture.questions)).toBe(true);
      });
    });
  });

  describe('loadAdvancedFixtures', () => {
    it('should load all advanced fixtures', async () => {
      const fixtures = await FixtureLoader.loadAdvancedFixtures();
      
      expect(fixtures).toBeDefined();
      expect(fixtures.length).toBeGreaterThan(0);
      expect(fixtures.length).toBe(5); // customer-feedback, employee-onboarding, product-research, demographic-survey, holiday-destination
    });

    it('should include fixtures with conditional logic', async () => {
      const fixtures = await FixtureLoader.loadAdvancedFixtures();
      
      const hasConditionals = fixtures.some(fixture => 
        fixture.questions.some(q => q.conditional)
      );
      
      expect(hasConditionals).toBe(true);
    });
  });

  describe('loadEdgeCaseFixtures', () => {
    it('should load all edge case fixtures', async () => {
      const fixtures = await FixtureLoader.loadEdgeCaseFixtures();
      
      expect(fixtures).toBeDefined();
      expect(fixtures.length).toBeGreaterThan(0);
      expect(fixtures.length).toBe(4); // complex-conditionals, validation-stress, maximum-length, error-scenarios
    });

    it('should include maximum length fixture', async () => {
      const fixtures = await FixtureLoader.loadEdgeCaseFixtures();
      
      const maxLengthFixture = fixtures.find(f => f.id === 'maximum-length-v1');
      expect(maxLengthFixture).toBeDefined();
      expect(maxLengthFixture?.questions.length).toBeGreaterThanOrEqual(50);
    });
  });

  describe('loadAllFixtures', () => {
    it('should load all fixtures from all categories', async () => {
      const fixtures = await FixtureLoader.loadAllFixtures();
      
      expect(fixtures).toBeDefined();
      expect(fixtures.length).toBe(12); // 3 basic + 5 advanced + 4 edge cases
    });

    it('should have unique IDs across all fixtures', async () => {
      const fixtures = await FixtureLoader.loadAllFixtures();
      
      const ids = fixtures.map(f => f.id);
      const uniqueIds = new Set(ids);
      
      expect(uniqueIds.size).toBe(ids.length);
    });
  });

  describe('loadFixture', () => {
    it('should load a specific fixture by path', async () => {
      const fixture = await FixtureLoader.loadFixture('basic/simple-text-survey.json');
      
      expect(fixture).toBeDefined();
      expect(fixture.id).toBe('simple-text-survey-v1');
    });

    it('should throw error for non-existent fixture', async () => {
      await expect(
        FixtureLoader.loadFixture('nonexistent/fixture.json')
      ).rejects.toThrow();
    });
  });
});
