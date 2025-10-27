/**
 * TUI Components Usage Example
 * 
 * This example demonstrates how to use the TUI components to render
 * interactive questionnaires with various question types.
 */

import { initializeComponents, ComponentFactory } from './ui/components/index.js';
import { QuestionType } from './core/schema.js';
import type { Question } from './core/schema.js';

// Initialize components once at application startup
initializeComponents();

async function demonstrateComponents() {
  console.log('\n=== TUI Components Demonstration ===\n');

  // Example 1: Text Input
  console.log('1. Text Input Component');
  const textQuestion: Question = {
    id: 'username',
    type: QuestionType.TEXT,
    text: 'Choose a username',
    description: 'Must be 3-20 characters, lowercase letters and numbers only',
    required: true,
    validation: {
      minLength: 3,
      maxLength: 20,
      pattern: '^[a-z0-9]+$',
      patternMessage: 'Username can only contain lowercase letters and numbers'
    }
  };

  const textComponent = ComponentFactory.create(textQuestion);
  console.log(`Validation check: ${JSON.stringify(textComponent.validate('john123', textQuestion))}`);
  console.log(`Validation check: ${JSON.stringify(textComponent.validate('Jo', textQuestion))}`);
  console.log('');

  // Example 2: Number Input
  console.log('2. Number Input Component');
  const numberQuestion: Question = {
    id: 'age',
    type: QuestionType.NUMBER,
    text: 'What is your age?',
    required: true,
    validation: {
      min: 18,
      max: 100,
      integer: true
    }
  };

  const numberComponent = ComponentFactory.create(numberQuestion);
  console.log(`Validation check: ${JSON.stringify(numberComponent.validate(25, numberQuestion))}`);
  console.log(`Validation check: ${JSON.stringify(numberComponent.validate(15, numberQuestion))}`);
  console.log('');

  // Example 3: Email Input
  console.log('3. Email Input Component');
  const emailQuestion: Question = {
    id: 'email',
    type: QuestionType.EMAIL,
    text: 'What is your email address?',
    required: true
  };

  const emailComponent = ComponentFactory.create(emailQuestion);
  console.log(`Validation check: ${JSON.stringify(emailComponent.validate('user@example.com', emailQuestion))}`);
  console.log(`Validation check: ${JSON.stringify(emailComponent.validate('invalid-email', emailQuestion))}`);
  console.log('');

  // Example 4: Date Input
  console.log('4. Date Input Component');
  const dateQuestion: Question = {
    id: 'start_date',
    type: QuestionType.DATE,
    text: 'When would you like to start?',
    required: true,
    validation: {
      minDate: '2024-01-01',
      maxDate: '2024-12-31'
    }
  };

  const dateComponent = ComponentFactory.create(dateQuestion);
  console.log(`Validation check: ${JSON.stringify(dateComponent.validate('2024-06-15', dateQuestion))}`);
  console.log(`Validation check: ${JSON.stringify(dateComponent.validate('2025-01-01', dateQuestion))}`);
  console.log('');

  // Example 5: Single Choice
  console.log('5. Single Choice Component');
  const singleChoiceQuestion: Question = {
    id: 'plan',
    type: QuestionType.SINGLE_CHOICE,
    text: 'Select your plan',
    required: true,
    options: [
      { value: 'free', label: 'Free Plan', description: '$0/month' },
      { value: 'pro', label: 'Pro Plan', description: '$10/month' },
      { value: 'enterprise', label: 'Enterprise Plan', description: '$50/month' }
    ],
    validation: {
      allowOther: false
    }
  };

  const singleChoiceComponent = ComponentFactory.create(singleChoiceQuestion);
  console.log(`Component type: ${singleChoiceComponent.constructor.name}`);
  console.log(`Formatted answer: ${singleChoiceComponent.format('pro')}`);
  console.log('');

  // Example 6: Multiple Choice
  console.log('6. Multiple Choice Component');
  const multipleChoiceQuestion: Question = {
    id: 'interests',
    type: QuestionType.MULTIPLE_CHOICE,
    text: 'Select your interests (choose 1-3)',
    required: true,
    options: [
      { value: 'coding', label: 'Coding' },
      { value: 'design', label: 'Design' },
      { value: 'writing', label: 'Writing' },
      { value: 'gaming', label: 'Gaming' }
    ],
    validation: {
      minSelections: 1,
      maxSelections: 3
    }
  };

  const multipleChoiceComponent = ComponentFactory.create(multipleChoiceQuestion);
  console.log(`Validation check: ${JSON.stringify(multipleChoiceComponent.validate(['coding', 'design'], multipleChoiceQuestion))}`);
  console.log(`Validation check: ${JSON.stringify(multipleChoiceComponent.validate(['coding', 'design', 'writing', 'gaming'], multipleChoiceQuestion))}`);
  console.log(`Formatted answer: ${multipleChoiceComponent.format(['coding', 'design'])}`);
  console.log('');

  // Example 7: Boolean
  console.log('7. Boolean Component');
  const booleanQuestion: Question = {
    id: 'terms',
    type: QuestionType.BOOLEAN,
    text: 'Do you agree to the terms and conditions?',
    required: true
  };

  const booleanComponent = ComponentFactory.create(booleanQuestion);
  console.log(`Formatted answer (true): ${booleanComponent.format(true)}`);
  console.log(`Formatted answer (false): ${booleanComponent.format(false)}`);
  console.log('');

  // Example 8: Rating
  console.log('8. Rating Component');
  const ratingQuestion: Question = {
    id: 'satisfaction',
    type: QuestionType.RATING,
    text: 'How satisfied are you with our service?',
    required: true,
    validation: {
      min: 1,
      max: 5
    }
  };

  const ratingComponent = ComponentFactory.create(ratingQuestion);
  console.log(`Component type: ${ratingComponent.constructor.name}`);
  console.log(`Formatted answer: ${ratingComponent.format(4)}`);
  console.log('');

  // Example 9: Component Factory Features
  console.log('9. Component Factory Features');
  console.log(`Has TEXT component: ${ComponentFactory.hasComponent(QuestionType.TEXT)}`);
  console.log(`Has NUMBER component: ${ComponentFactory.hasComponent(QuestionType.NUMBER)}`);
  console.log(`Registered types: ${ComponentFactory.getRegisteredTypes().join(', ')}`);
  console.log('');

  console.log('=== Demonstration Complete ===\n');
}

// Run the demonstration
demonstrateComponents().catch(console.error);
