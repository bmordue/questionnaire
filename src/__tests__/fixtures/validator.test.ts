import { describe, it, expect } from '@jest/globals';
import { FixtureValidator } from '../../fixtures/validator.js';
import { FixtureLoader } from '../../fixtures/loader.js';
import { QuestionType } from '../../core/schemas/question.js';

describe('FixtureValidator', () => {
  describe('validateQuestionnaire', () => {
    it('should validate a valid questionnaire', async () => {
      const fixtures = await FixtureLoader.loadBasicFixtures();
      const result = FixtureValidator.validateQuestionnaire(fixtures[0], fixtures[0]?.id);
      
      expect(result.valid).toBe(true);
      expect(result.errors).toHaveLength(0);
      expect(result.questionnaire).toBeDefined();
    });

    it('should reject invalid questionnaire data', () => {
      const invalidData = {
        id: 'test',
        // missing required fields
      };
      
      const result = FixtureValidator.validateQuestionnaire(invalidData, 'invalid-test');
      
      expect(result.valid).toBe(false);
      expect(result.errors.length).toBeGreaterThan(0);
    });

    it('should reject questionnaire with invalid question type', () => {
      const invalidData = {
        id: 'test',
        title: 'Test',
        version: '1.0.0',
        questions: [
          {
            id: 'q1',
            type: 'invalid_type',
            text: 'Question?'
          }
        ]
      };
      
      const result = FixtureValidator.validateQuestionnaire(invalidData, 'invalid-type-test');
      
      expect(result.valid).toBe(false);
    });
  });

  describe('validateAllFixtures', () => {
    it('should validate all loaded fixtures', async () => {
      const fixtures = await FixtureLoader.loadAllFixtures();
      const results = await FixtureValidator.validateAllFixtures(fixtures);
      
      expect(results).toHaveLength(fixtures.length);
      
      const allValid = results.every(r => r.valid);
      expect(allValid).toBe(true);
    });
  });

  describe('generateSchemaReport', () => {
    it('should generate a comprehensive schema report', async () => {
      const fixtures = await FixtureLoader.loadAllFixtures();
      const report = FixtureValidator.generateSchemaReport(fixtures);
      
      expect(report).toBeDefined();
      expect(report.totalFixtures).toBe(fixtures.length);
      expect(report.validFixtures).toBeGreaterThan(0);
      expect(report.invalidFixtures).toBe(0);
      expect(report.questionTypeCoverage).toBeDefined();
      expect(report.validationRuleCoverage).toBeDefined();
    });

    it('should track all question types', async () => {
      const fixtures = await FixtureLoader.loadAllFixtures();
      const report = FixtureValidator.generateSchemaReport(fixtures);
      
      const coverage = report.questionTypeCoverage;
      
      // Should have coverage for multiple question types
      expect(Object.keys(coverage).length).toBeGreaterThan(0);
      
      // Should include common types
      expect(coverage['text']).toBeGreaterThan(0);
      expect(coverage['boolean']).toBeGreaterThan(0);
    });

    it('should track validation rules', async () => {
      const fixtures = await FixtureLoader.loadAllFixtures();
      const report = FixtureValidator.generateSchemaReport(fixtures);
      
      expect(report.validationRuleCoverage.length).toBeGreaterThan(0);
    });
  });

  describe('testQuestionnaireFlow', () => {
    it('should pass valid questionnaires', async () => {
      const fixtures = await FixtureLoader.loadBasicFixtures();
      
      fixtures.forEach(fixture => {
        const result = FixtureValidator.testQuestionnaireFlow(fixture);
        expect(result.valid).toBe(true);
        expect(result.issues).toHaveLength(0);
      });
    });

    it('should detect duplicate question IDs', () => {
      const invalidQuestionnaire = {
        id: 'test',
        version: '1.0.0',
        metadata: {
          title: 'Test',
          createdAt: '2025-01-01T00:00:00.000Z',
          updatedAt: '2025-01-01T00:00:00.000Z'
        },
        questions: [
          {
            id: 'q1',
            type: QuestionType.TEXT,
            text: 'Question 1?',
            required: false
          },
          {
            id: 'q1', // duplicate
            type: QuestionType.TEXT,
            text: 'Question 2?',
            required: false
          }
        ]
      };
      
      const result = FixtureValidator.testQuestionnaireFlow(invalidQuestionnaire as any);
      
      expect(result.valid).toBe(false);
      expect(result.issues.length).toBeGreaterThan(0);
      expect(result.issues[0]).toContain('Duplicate');
    });

    it('should detect invalid conditional references', () => {
      const invalidQuestionnaire = {
        id: 'test',
        version: '1.0.0',
        metadata: {
          title: 'Test',
          createdAt: '2025-01-01T00:00:00.000Z',
          updatedAt: '2025-01-01T00:00:00.000Z'
        },
        questions: [
          {
            id: 'q1',
            type: QuestionType.TEXT,
            text: 'Question 1?',
            required: false,
            conditional: {
              showIf: {
                questionId: 'nonexistent',
                operator: 'equals' as const,
                value: 'test'
              }
            }
          }
        ]
      };
      
      const result = FixtureValidator.testQuestionnaireFlow(invalidQuestionnaire as any);
      
      expect(result.valid).toBe(false);
      expect(result.issues.length).toBeGreaterThan(0);
      expect(result.issues[0]).toContain('non-existent');
    });

    it('should pass questionnaires with valid conditionals', async () => {
      const fixtures = await FixtureLoader.loadAdvancedFixtures();
      
      // Find fixtures with conditionals
      const fixturesWithConditionals = fixtures.filter(f => 
        f.questions.some(q => q.conditional)
      );
      
      expect(fixturesWithConditionals.length).toBeGreaterThan(0);
      
      fixturesWithConditionals.forEach(fixture => {
        const result = FixtureValidator.testQuestionnaireFlow(fixture);
        expect(result.valid).toBe(true);
      });
    });
  });
});
