// Base components
export type { QuestionComponent } from './base/question-component.js';
export { BaseQuestionComponent } from './base/question-component.js';
export { ComponentFactory } from './base/component-factory.js';
export { ValidationHelpers } from './base/validation-helpers.js';
export type { ValidationResult, InquirerPromptConfig } from './base/types.js';

// Input components
export { TextInputComponent } from './inputs/text-input.js';
export { NumberInputComponent } from './inputs/number-input.js';
export { EmailInputComponent } from './inputs/email-input.js';
export { DateInputComponent } from './inputs/date-input.js';

// Choice components
export { SingleChoiceComponent } from './choices/single-choice.js';
export { MultipleChoiceComponent } from './choices/multiple-choice.js';
export { BooleanComponent } from './choices/boolean.js';
export { RatingComponent } from './choices/rating.js';

// Display components
export { MessageFormatter, theme } from './display/theme.js';

// Initialize factory with all components
import { ComponentFactory } from './base/component-factory.js';
import { QuestionType } from '../../core/schema.js';
import { TextInputComponent } from './inputs/text-input.js';
import { NumberInputComponent } from './inputs/number-input.js';
import { EmailInputComponent } from './inputs/email-input.js';
import { DateInputComponent } from './inputs/date-input.js';
import { SingleChoiceComponent } from './choices/single-choice.js';
import { MultipleChoiceComponent } from './choices/multiple-choice.js';
import { BooleanComponent } from './choices/boolean.js';
import { RatingComponent } from './choices/rating.js';

/**
 * Initialize the component factory with all standard components
 * This should be called once at application startup
 */
export function initializeComponents(): void {
  ComponentFactory.register(QuestionType.TEXT, new TextInputComponent());
  ComponentFactory.register(QuestionType.NUMBER, new NumberInputComponent());
  ComponentFactory.register(QuestionType.EMAIL, new EmailInputComponent());
  ComponentFactory.register(QuestionType.DATE, new DateInputComponent());
  ComponentFactory.register(QuestionType.SINGLE_CHOICE, new SingleChoiceComponent());
  ComponentFactory.register(QuestionType.MULTIPLE_CHOICE, new MultipleChoiceComponent());
  ComponentFactory.register(QuestionType.BOOLEAN, new BooleanComponent());
  ComponentFactory.register(QuestionType.RATING, new RatingComponent());
}
