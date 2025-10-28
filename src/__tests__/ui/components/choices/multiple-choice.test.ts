import { describe, it, expect } from '@jest/globals';
import { MultipleChoiceComponent } from '../../../../ui/components/choices/multiple-choice.js';
import type { MultipleChoiceQuestion } from '../../../../core/schema.js';
import { QuestionType } from '../../../../core/schema.js';

describe('MultipleChoiceComponent', () => {
  const component = new MultipleChoiceComponent();

  describe('validate', () => {
    it('should validate selected options', () => {
      const question: MultipleChoiceQuestion = {
        id: 'q1',
        type: QuestionType.MULTIPLE_CHOICE,
        text: 'Select colors',
        required: false,
        options: [
          { value: 'red', label: 'Red' },
          { value: 'blue', label: 'Blue' },
          { value: 'green', label: 'Green' }
        ]
      };

      expect(component.validate(['red', 'blue'], question).isValid).toBe(true);
      expect(component.validate(['green'], question).isValid).toBe(true);
    });

    it('should validate required field', () => {
      const question: MultipleChoiceQuestion = {
        id: 'q1',
        type: QuestionType.MULTIPLE_CHOICE,
        text: 'Select colors',
        required: true,
        options: [
          { value: 'red', label: 'Red' },
          { value: 'blue', label: 'Blue' }
        ]
      };

      expect(component.validate([], question).isValid).toBe(false);
      expect(component.validate(['red'], question).isValid).toBe(true);
    });

    it('should allow empty selection for non-required field', () => {
      const question: MultipleChoiceQuestion = {
        id: 'q1',
        type: QuestionType.MULTIPLE_CHOICE,
        text: 'Select colors',
        required: false,
        options: [
          { value: 'red', label: 'Red' },
          { value: 'blue', label: 'Blue' }
        ]
      };

      expect(component.validate([], question).isValid).toBe(true);
    });

    it('should validate minSelections constraint', () => {
      const question: MultipleChoiceQuestion = {
        id: 'q1',
        type: QuestionType.MULTIPLE_CHOICE,
        text: 'Select colors',
        required: false,
        options: [
          { value: 'red', label: 'Red' },
          { value: 'blue', label: 'Blue' },
          { value: 'green', label: 'Green' }
        ],
        validation: {
          minSelections: 2
        }
      };

      expect(component.validate(['red'], question).isValid).toBe(false);
      expect(component.validate(['red', 'blue'], question).isValid).toBe(true);
      expect(component.validate(['red', 'blue', 'green'], question).isValid).toBe(true);
    });

    it('should validate maxSelections constraint', () => {
      const question: MultipleChoiceQuestion = {
        id: 'q1',
        type: QuestionType.MULTIPLE_CHOICE,
        text: 'Select colors',
        required: false,
        options: [
          { value: 'red', label: 'Red' },
          { value: 'blue', label: 'Blue' },
          { value: 'green', label: 'Green' }
        ],
        validation: {
          maxSelections: 2
        }
      };

      expect(component.validate(['red'], question).isValid).toBe(true);
      expect(component.validate(['red', 'blue'], question).isValid).toBe(true);
      expect(component.validate(['red', 'blue', 'green'], question).isValid).toBe(false);
    });

    it('should validate selection range', () => {
      const question: MultipleChoiceQuestion = {
        id: 'q1',
        type: QuestionType.MULTIPLE_CHOICE,
        text: 'Select colors',
        required: false,
        options: [
          { value: 'red', label: 'Red' },
          { value: 'blue', label: 'Blue' },
          { value: 'green', label: 'Green' },
          { value: 'yellow', label: 'Yellow' }
        ],
        validation: {
          minSelections: 2,
          maxSelections: 3
        }
      };

      expect(component.validate(['red'], question).isValid).toBe(false);
      expect(component.validate(['red', 'blue'], question).isValid).toBe(true);
      expect(component.validate(['red', 'blue', 'green'], question).isValid).toBe(true);
      expect(component.validate(['red', 'blue', 'green', 'yellow'], question).isValid).toBe(false);
    });
  });

  describe('format', () => {
    it('should format selections as comma-separated string', () => {
      expect(component.format(['red', 'blue'])).toBe('red, blue');
      expect(component.format(['green'])).toBe('green');
      expect(component.format(['red', 'blue', 'green'])).toBe('red, blue, green');
    });
  });

  describe('getPromptConfig', () => {
    it('should return valid prompt configuration', () => {
      const question: MultipleChoiceQuestion = {
        id: 'q1',
        type: QuestionType.MULTIPLE_CHOICE,
        text: 'Select your favorite colors',
        required: true,
        options: [
          { value: 'red', label: 'Red' },
          { value: 'blue', label: 'Blue' }
        ]
      };

      const config = component.getPromptConfig(question);
      expect(config.type).toBe('checkbox');
      expect(config.name).toBe('answer');
      expect(config.message).toBeDefined();
      expect(config.choices).toBeDefined();
      expect(config.choices.length).toBe(2);
      expect(config.validate).toBeDefined();
    });

    it('should throw error for non-multiple_choice question', () => {
      const question: any = {
        id: 'q1',
        type: QuestionType.TEXT,
        text: 'Name',
        required: false
      };

      expect(() => component.getPromptConfig(question)).toThrow(
        'MultipleChoiceComponent can only be used with multiple_choice questions'
      );
    });
  });
});
