# TUI Components

Reusable Terminal User Interface (TUI) components for rendering interactive questionnaires using Inquirer.js.

## Overview

This module provides a comprehensive set of components for rendering different question types in a terminal environment. Each component handles its own validation, formatting, and user interaction logic.

## Architecture

### Component Hierarchy

```
BaseQuestionComponent (abstract)
├── TextInputComponent
├── NumberInputComponent  
├── EmailInputComponent
├── DateInputComponent
├── SingleChoiceComponent
├── MultipleChoiceComponent
├── BooleanComponent
└── RatingComponent
```

### Key Interfaces

#### QuestionComponent

All components implement the `QuestionComponent` interface:

```typescript
interface QuestionComponent<T = any> {
  render(question: Question, currentAnswer?: T): Promise<T>;
  validate(answer: T, question: Question): ValidationResult;
  format(answer: T): string;
  getPromptConfig(question: Question): InquirerPromptConfig;
}
```

#### ValidationResult

Validation results follow a consistent structure:

```typescript
interface ValidationResult {
  isValid: boolean;
  message?: string;
}
```

## Components

### Input Components

#### TextInputComponent

Handles text input with optional length and pattern validation.

**Supported Validations:**
- `minLength`: Minimum character length
- `maxLength`: Maximum character length  
- `pattern`: Regular expression pattern
- `patternMessage`: Custom message for pattern failures

#### NumberInputComponent

Handles numeric input with range and integer validation.

**Supported Validations:**
- `min`: Minimum value
- `max`: Maximum value
- `integer`: Require whole numbers only

#### EmailInputComponent

Handles email input with format validation using regex pattern.

#### DateInputComponent

Handles date input in YYYY-MM-DD format with range validation.

**Supported Validations:**
- `minDate`: Earliest allowed date (or 'today')
- `maxDate`: Latest allowed date

### Choice Components

#### SingleChoiceComponent

Displays a list of options for single selection.

**Features:**
- Keyboard navigation
- Optional "Other" field support
- Custom option labels and values

#### MultipleChoiceComponent

Displays checkboxes for multi-selection.

**Supported Validations:**
- `minSelections`: Minimum number of selections required
- `maxSelections`: Maximum number of selections allowed

#### BooleanComponent

Simple Yes/No confirmation prompt.

#### RatingComponent

Displays a numeric rating scale with labels.

**Features:**
- Configurable min/max range (default 1-5)
- Automatic labels (Poor/Average/Excellent)
- Visual scale display

## Component Factory

The `ComponentFactory` manages component registration and creation:

```typescript
// Initialize all standard components
initializeComponents();

// Create component for a question
const component = ComponentFactory.create(question);

// Use the component
const answer = await component.render(question);
```

## Validation Helpers

The `ValidationHelpers` utility class provides reusable validation functions:

- `validateEmail(email: string)`
- `validateDateFormat(dateString: string)`
- `validateLength(value: string, min?, max?)`
- `validatePattern(value: string, pattern: string, message?)`
- `validateRange(value: number, min?, max?)`
- `validateInteger(value: number)`
- `validateDateRange(date: Date, minDate?, maxDate?)`
- `combineValidationResults(...results)`

## Theming

Components use a consistent color scheme via the `theme` object:

```typescript
const theme = {
  primary: chalk.blue,      // Question text
  success: chalk.green,     // Success messages
  warning: chalk.yellow,    // Warnings
  error: chalk.red,         // Errors and required indicators
  info: chalk.cyan,         // Info messages
  muted: chalk.gray         // Descriptions and hints
};
```

### Message Formatting

The `MessageFormatter` class provides consistent message styling:

```typescript
MessageFormatter.formatQuestion(text, description?, required?)
MessageFormatter.formatError(message)
MessageFormatter.formatSuccess(message)
MessageFormatter.formatWarning(message)
MessageFormatter.formatInfo(message)
MessageFormatter.formatMuted(message)
```

## Usage Examples

### Basic Usage

```typescript
import { initializeComponents, ComponentFactory } from './ui/components/index.js';
import type { Question } from './core/schema.js';

// Initialize components once at startup
initializeComponents();

// Render a question
const question: Question = {
  id: 'name',
  type: QuestionType.TEXT,
  text: 'What is your name?',
  required: true,
  validation: {
    minLength: 2,
    maxLength: 50
  }
};

const component = ComponentFactory.create(question);
const answer = await component.render(question);

console.log(`Answer: ${component.format(answer)}`);
```

### Custom Validation

```typescript
const question: Question = {
  id: 'username',
  type: QuestionType.TEXT,
  text: 'Choose a username',
  required: true,
  validation: {
    minLength: 3,
    maxLength: 20,
    pattern: '^[a-z0-9_]+$',
    patternMessage: 'Username can only contain lowercase letters, numbers, and underscores'
  }
};

const component = ComponentFactory.create(question);
const answer = await component.render(question);
```

### Multiple Choice with Constraints

```typescript
const question: Question = {
  id: 'skills',
  type: QuestionType.MULTIPLE_CHOICE,
  text: 'Select your top 3 skills',
  required: true,
  options: [
    { value: 'js', label: 'JavaScript' },
    { value: 'ts', label: 'TypeScript' },
    { value: 'py', label: 'Python' },
    { value: 'go', label: 'Go' },
    { value: 'rs', label: 'Rust' }
  ],
  validation: {
    minSelections: 1,
    maxSelections: 3
  }
};

const component = ComponentFactory.create(question);
const skills = await component.render(question);
console.log(`Selected: ${component.format(skills)}`);
```

### Rating Scale

```typescript
const question: Question = {
  id: 'satisfaction',
  type: QuestionType.RATING,
  text: 'How satisfied are you with our service?',
  required: true,
  validation: {
    min: 1,
    max: 10
  }
};

const component = ComponentFactory.create(question);
const rating = await component.render(question);
```

### Date Input with Range

```typescript
const question: Question = {
  id: 'start_date',
  type: QuestionType.DATE,
  text: 'When would you like to start?',
  description: 'Enter a date in the future',
  required: true,
  validation: {
    minDate: 'today',
    maxDate: '2025-12-31'
  }
};

const component = ComponentFactory.create(question);
const date = await component.render(question);
```

## Testing

All components include comprehensive unit tests covering:

- Validation logic for all rule types
- Required field handling
- Edge cases and error conditions
- Format methods
- Prompt configuration generation

Run tests with:

```bash
npm test
```

## File Structure

```
src/ui/components/
├── base/
│   ├── question-component.ts    # Base interfaces and abstract class
│   ├── component-factory.ts     # Factory for creating components
│   ├── validation-helpers.ts    # Reusable validation utilities
│   └── types.ts                 # Type definitions
├── inputs/
│   ├── text-input.ts           # Text input component
│   ├── number-input.ts         # Number input component
│   ├── email-input.ts          # Email input component
│   └── date-input.ts           # Date input component
├── choices/
│   ├── single-choice.ts        # Single choice list component
│   ├── multiple-choice.ts      # Multiple choice checkbox component
│   ├── boolean.ts              # Boolean confirmation component
│   └── rating.ts               # Rating scale component
├── display/
│   └── theme.ts                # Theming and message formatting
└── index.ts                    # Main exports and initialization
```

## Dependencies

- **inquirer** (^12.10.0) - Interactive command line prompts
- **chalk** (^5.6.2) - Terminal string styling
- **@types/inquirer** (^9.0.9) - TypeScript types for inquirer

## Design Principles

1. **Single Responsibility**: Each component handles one question type
2. **Consistent Interface**: All components implement the same interface
3. **Validation Separation**: Validation logic is separate from rendering
4. **Reusable Utilities**: Common validation logic is in helpers
5. **Type Safety**: Full TypeScript type coverage
6. **Testability**: Components are designed for easy unit testing

## Future Enhancements

Potential improvements for future versions:

- Custom prompt types for enhanced UX
- Accessibility improvements (screen reader support)
- Progress indicators for multi-step forms
- Answer history/undo functionality
- Custom themes and styling options
- Autocomplete support for text inputs
- Calendar picker for date inputs
