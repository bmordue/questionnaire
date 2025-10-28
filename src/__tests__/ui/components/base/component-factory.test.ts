import { describe, it, expect, beforeEach, afterEach } from '@jest/globals';
import { ComponentFactory } from '../../../../ui/components/base/component-factory.js';
import { TextInputComponent } from '../../../../ui/components/inputs/text-input.js';
import { NumberInputComponent } from '../../../../ui/components/inputs/number-input.js';
import { QuestionType } from '../../../../core/schema.js';
import type { Question } from '../../../../core/schema.js';

describe('ComponentFactory', () => {
  beforeEach(() => {
    ComponentFactory.clear();
  });

  afterEach(() => {
    ComponentFactory.clear();
  });

  describe('register', () => {
    it('should register a component for a question type', () => {
      const component = new TextInputComponent();
      ComponentFactory.register(QuestionType.TEXT, component);
      
      expect(ComponentFactory.hasComponent(QuestionType.TEXT)).toBe(true);
    });

    it('should replace existing component when registering same type', () => {
      const component1 = new TextInputComponent();
      const component2 = new TextInputComponent();
      
      ComponentFactory.register(QuestionType.TEXT, component1);
      ComponentFactory.register(QuestionType.TEXT, component2);
      
      const question: Question = {
        id: 'q1',
        type: QuestionType.TEXT,
        text: 'Test',
        required: false
      };
      
      const retrieved = ComponentFactory.create(question);
      expect(retrieved).toBe(component2);
    });
  });

  describe('create', () => {
    it('should create component for registered question type', () => {
      const component = new TextInputComponent();
      ComponentFactory.register(QuestionType.TEXT, component);
      
      const question: Question = {
        id: 'q1',
        type: QuestionType.TEXT,
        text: 'Test',
        required: false
      };
      
      const created = ComponentFactory.create(question);
      expect(created).toBe(component);
    });

    it('should throw error for unregistered question type', () => {
      const question: Question = {
        id: 'q1',
        type: QuestionType.TEXT,
        text: 'Test',
        required: false
      };
      
      expect(() => ComponentFactory.create(question)).toThrow(
        'No component registered for question type: text'
      );
    });
  });

  describe('hasComponent', () => {
    it('should return true for registered component', () => {
      ComponentFactory.register(QuestionType.TEXT, new TextInputComponent());
      expect(ComponentFactory.hasComponent(QuestionType.TEXT)).toBe(true);
    });

    it('should return false for unregistered component', () => {
      expect(ComponentFactory.hasComponent(QuestionType.TEXT)).toBe(false);
    });
  });

  describe('getRegisteredTypes', () => {
    it('should return empty array when no components registered', () => {
      expect(ComponentFactory.getRegisteredTypes()).toEqual([]);
    });

    it('should return all registered types', () => {
      ComponentFactory.register(QuestionType.TEXT, new TextInputComponent());
      ComponentFactory.register(QuestionType.NUMBER, new NumberInputComponent());
      
      const types = ComponentFactory.getRegisteredTypes();
      expect(types).toContain(QuestionType.TEXT);
      expect(types).toContain(QuestionType.NUMBER);
      expect(types.length).toBe(2);
    });
  });

  describe('clear', () => {
    it('should clear all registered components', () => {
      ComponentFactory.register(QuestionType.TEXT, new TextInputComponent());
      ComponentFactory.register(QuestionType.NUMBER, new NumberInputComponent());
      
      ComponentFactory.clear();
      
      expect(ComponentFactory.getRegisteredTypes()).toEqual([]);
      expect(ComponentFactory.hasComponent(QuestionType.TEXT)).toBe(false);
      expect(ComponentFactory.hasComponent(QuestionType.NUMBER)).toBe(false);
    });
  });
});
