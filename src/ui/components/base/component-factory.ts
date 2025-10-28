import type { Question } from '../../../core/schema.js';
import { QuestionType } from '../../../core/schema.js';
import type { QuestionComponent } from './question-component.js';

/**
 * Component factory for creating question components based on question type
 */
export class ComponentFactory {
  private static components = new Map<QuestionType, QuestionComponent>();

  /**
   * Register a component for a specific question type
   */
  static register(type: QuestionType, component: QuestionComponent): void {
    this.components.set(type, component);
  }

  /**
   * Create a component for the given question
   */
  static create(question: Question): QuestionComponent {
    const component = this.components.get(question.type);
    if (!component) {
      throw new Error(`No component registered for question type: ${question.type}`);
    }
    return component;
  }

  /**
   * Initialize the factory with all standard components
   * This will be called once during application startup
   */
  static init(): void {
    // Component registration will be done after individual components are created
    // This method is kept for future initialization
  }

  /**
   * Check if a component is registered for a question type
   */
  static hasComponent(type: QuestionType): boolean {
    return this.components.has(type);
  }

  /**
   * Get all registered question types
   */
  static getRegisteredTypes(): QuestionType[] {
    return Array.from(this.components.keys());
  }

  /**
   * Clear all registered components (useful for testing)
   */
  static clear(): void {
    this.components.clear();
  }
}
