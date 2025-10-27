import { QuestionnaireSchema, type Questionnaire, type Question } from '../core/schema.js';
import { ZodError } from 'zod';

export interface ValidationResult {
  valid: boolean;
  errors: string[];
  questionnaire?: Questionnaire;
}

export interface SchemaReport {
  totalFixtures: number;
  validFixtures: number;
  invalidFixtures: number;
  questionTypeCoverage: Record<string, number>;
  validationRuleCoverage: string[];
  errors: Array<{ fixture: string; errors: string[] }>;
}

/**
 * Fixture validator for validating questionnaires against schemas
 */
export class FixtureValidator {
  /**
   * Validate a single questionnaire
   */
  static validateQuestionnaire(data: unknown, name: string = 'unknown'): ValidationResult {
    try {
      const questionnaire = QuestionnaireSchema.parse(data);
      return {
        valid: true,
        errors: [],
        questionnaire
      };
    } catch (error) {
      if (error instanceof ZodError) {
        return {
          valid: false,
          errors: error.issues.map(e => `${name}: ${e.path.join('.')}: ${e.message}`)
        };
      }
      return {
        valid: false,
        errors: [`${name}: Unknown validation error`]
      };
    }
  }

  /**
   * Validate multiple questionnaires
   */
  static validateMultiple(
    questionnaires: Array<{ name: string; data: unknown }>
  ): ValidationResult[] {
    return questionnaires.map(({ name, data }) => 
      this.validateQuestionnaire(data, name)
    );
  }

  /**
   * Validate all fixtures and generate a comprehensive report
   */
  static async validateAllFixtures(fixtures: Questionnaire[]): Promise<ValidationResult[]> {
    return fixtures.map((fixture, index) => 
      this.validateQuestionnaire(fixture, fixture.id || `fixture-${index}`)
    );
  }

  /**
   * Generate a schema coverage report
   */
  static generateSchemaReport(questionnaires: Questionnaire[]): SchemaReport {
    const questionTypeCoverage: Record<string, number> = {};
    const validationRulesSet = new Set<string>();
    const errors: Array<{ fixture: string; errors: string[] }> = [];
    let validFixtures = 0;

    questionnaires.forEach(questionnaire => {
      const result = this.validateQuestionnaire(questionnaire, questionnaire.id);
      
      if (result.valid && result.questionnaire) {
        validFixtures++;
        
        // Count question types
        result.questionnaire.questions.forEach((question: Question) => {
          questionTypeCoverage[question.type] = (questionTypeCoverage[question.type] || 0) + 1;
          
          // Track validation rules
          if ('validation' in question && question.validation) {
            Object.keys(question.validation).forEach(rule => {
              validationRulesSet.add(`${question.type}.${rule}`);
            });
          }
          
          // Track conditional logic
          if (question.conditional) {
            validationRulesSet.add('conditional.showIf');
          }
        });
      } else {
        errors.push({
          fixture: questionnaire.id,
          errors: result.errors
        });
      }
    });

    return {
      totalFixtures: questionnaires.length,
      validFixtures,
      invalidFixtures: questionnaires.length - validFixtures,
      questionTypeCoverage,
      validationRuleCoverage: Array.from(validationRulesSet).sort(),
      errors
    };
  }

  /**
   * Test if a questionnaire can be executed (all questions are valid)
   */
  static testQuestionnaireFlow(questionnaire: Questionnaire): { 
    valid: boolean; 
    issues: string[] 
  } {
    const issues: string[] = [];
    
    // Check for duplicate question IDs
    const questionIds = new Set<string>();
    questionnaire.questions.forEach(question => {
      if (questionIds.has(question.id)) {
        issues.push(`Duplicate question ID: ${question.id}`);
      }
      questionIds.add(question.id);
    });
    
    // Check conditional references
    questionnaire.questions.forEach(question => {
      if (question.conditional) {
        const refId = question.conditional.dependsOn;
        if (!questionIds.has(refId)) {
          issues.push(`Question ${question.id} references non-existent question: ${refId}`);
        }
      }
    });
    
    return {
      valid: issues.length === 0,
      issues
    };
  }
}
