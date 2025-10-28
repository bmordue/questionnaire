import { describe, it, expect } from '@jest/globals';
import { RatingComponent } from '../../../../ui/components/choices/rating.js';
import type { RatingQuestion } from '../../../../core/schema.js';
import { QuestionType } from '../../../../core/schema.js';

describe('RatingComponent', () => {
  const component = new RatingComponent();

  describe('validate', () => {
    it('should validate rating value', () => {
      const question: RatingQuestion = {
        id: 'q1',
        type: QuestionType.RATING,
        text: 'Rate our service',
        required: false,
        validation: {
          min: 1,
          max: 5
        }
      };

      expect(component.validate(3, question).isValid).toBe(true);
      expect(component.validate(1, question).isValid).toBe(true);
      expect(component.validate(5, question).isValid).toBe(true);
    });

    it('should handle required field', () => {
      const question: RatingQuestion = {
        id: 'q1',
        type: QuestionType.RATING,
        text: 'Rate our service',
        required: true,
        validation: {
          min: 1,
          max: 5
        }
      };

      const undefinedResult = component.validate(undefined as any, question);
      expect(undefinedResult.isValid).toBe(false);
      
      const nullResult = component.validate(null as any, question);
      expect(nullResult.isValid).toBe(false);
      
      expect(component.validate(3, question).isValid).toBe(true);
    });
  });

  describe('format', () => {
    it('should format rating as string', () => {
      expect(component.format(1)).toBe('1');
      expect(component.format(5)).toBe('5');
      expect(component.format(3)).toBe('3');
    });
  });

  describe('getPromptConfig', () => {
    it('should return valid prompt configuration with default range', () => {
      const question: RatingQuestion = {
        id: 'q1',
        type: QuestionType.RATING,
        text: 'Rate our service',
        required: true
      };

      const config = component.getPromptConfig(question);
      expect(config.type).toBe('list');
      expect(config.name).toBe('answer');
      expect(config.message).toBeDefined();
      expect(config.choices).toBeDefined();
      expect(config.choices.length).toBe(5); // Default 1-5
    });

    it('should return configuration with custom range', () => {
      const question: RatingQuestion = {
        id: 'q1',
        type: QuestionType.RATING,
        text: 'Rate on scale of 1-10',
        required: true,
        validation: {
          min: 1,
          max: 10
        }
      };

      const config = component.getPromptConfig(question);
      expect(config.choices).toBeDefined();
      expect(config.choices.length).toBe(10);
    });

    it('should include rating labels', () => {
      const question: RatingQuestion = {
        id: 'q1',
        type: QuestionType.RATING,
        text: 'Rate our service',
        required: true,
        validation: {
          min: 1,
          max: 5
        }
      };

      const config = component.getPromptConfig(question);
      const choiceNames = config.choices.map((c: any) => c.name);
      
      expect(choiceNames[0]).toContain('Poor');
      expect(choiceNames[4]).toContain('Excellent');
      expect(choiceNames[2]).toContain('Average');
    });

    it('should throw error for non-rating question', () => {
      const question: any = {
        id: 'q1',
        type: QuestionType.TEXT,
        text: 'Name',
        required: false
      };

      expect(() => component.getPromptConfig(question)).toThrow(
        'RatingComponent can only be used with rating questions'
      );
    });
  });
});
