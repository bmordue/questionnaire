# Questionnaire Schemas

This directory contains the core schema definitions for the questionnaire system, implemented using [Zod](https://zod.dev/) for runtime validation and TypeScript type inference.

## Overview

The schema system provides:
- **Runtime validation** - Ensure data conforms to expected structure
- **Type safety** - Full TypeScript type inference from schemas
- **8 question types** - Support for diverse question formats
- **Validation rules** - Type-specific validation for each question type
- **Response tracking** - Schema for storing and managing user responses

## Files

### `schema.ts`
Main export module that re-exports all schemas and types from subdirectories.

### `schemas/question.ts`
Defines all question types and their validation schemas:

- `QuestionType` enum - All supported question types
- Question schemas for each type:
  - `TextQuestionSchema` - Short text input with length/pattern validation
  - `EmailQuestionSchema` - Email input with validation
  - `NumberQuestionSchema` - Numeric input with min/max/integer constraints
  - `SingleChoiceQuestionSchema` - Single selection from options
  - `MultipleChoiceQuestionSchema` - Multiple selections with limits
  - `BooleanQuestionSchema` - Yes/No questions
  - `DateQuestionSchema` - Date input with range validation
  - `RatingQuestionSchema` - Numeric scale (e.g., 1-5, 1-10)

### `schemas/questionnaire.ts`
Defines the questionnaire structure:

- `QuestionnaireSchema` - Main questionnaire object
- `QuestionnaireMetadataSchema` - Title, description, author, timestamps, tags
- `QuestionnaireConfigSchema` - Display and behavior settings

### `schemas/response.ts`
Defines response tracking:

- `QuestionnaireResponseSchema` - Complete response object
- `AnswerSchema` - Individual question answers
- `ResponseProgressSchema` - Progress tracking
- `ResponseStatus` enum - Response states (in_progress, completed, abandoned)

### `schemas/validation.ts`
Utility functions for common validations:

- Email validation
- Date validation
- Range checking
- Pattern matching
- String length validation
- Zod error formatting

## Usage Examples

### Validating a Questionnaire

```typescript
import { validateQuestionnaire, QuestionType } from './core/schema.js';

const questionnaire = {
  id: 'survey-001',
  version: '1.0.0',
  metadata: {
    title: 'Customer Survey',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  },
  questions: [
    {
      id: 'q1',
      type: QuestionType.TEXT,
      text: 'What is your name?',
      required: true
    }
  ]
};

try {
  const validated = validateQuestionnaire(questionnaire);
  console.log('Valid questionnaire!');
} catch (error) {
  console.error('Validation failed:', error);
}
```

### Creating a Response

```typescript
import { createResponse, ResponseStatus } from './core/schema.js';

const response = createResponse(
  'survey-001',  // questionnaireId
  '1.0.0',       // version
  'session-123', // sessionId
  5              // totalQuestions
);

// Add an answer
response.answers.push({
  questionId: 'q1',
  value: 'John Doe',
  answeredAt: new Date().toISOString()
});

response.progress.answeredCount = 1;
response.progress.currentQuestionIndex = 1;
```

### Working with Different Question Types

```typescript
import { QuestionType } from './core/schema.js';

// Text question with validation
const textQuestion = {
  id: 'q1',
  type: QuestionType.TEXT,
  text: 'Enter your comment',
  validation: {
    minLength: 10,
    maxLength: 500,
    pattern: '^[a-zA-Z\\s]+$'
  }
};

// Rating question
const ratingQuestion = {
  id: 'q2',
  type: QuestionType.RATING,
  text: 'Rate our service',
  validation: {
    min: 1,
    max: 5
  }
};

// Multiple choice question
const multipleChoiceQuestion = {
  id: 'q3',
  type: QuestionType.MULTIPLE_CHOICE,
  text: 'Select your interests',
  options: [
    { value: 'sports', label: 'Sports' },
    { value: 'music', label: 'Music' },
    { value: 'tech', label: 'Technology' }
  ],
  validation: {
    minSelections: 1,
    maxSelections: 2
  }
};
```

### Conditional Logic

```typescript
const conditionalQuestion = {
  id: 'q2',
  type: QuestionType.TEXT,
  text: 'Please explain',
  conditional: {
    dependsOn: 'q1',
    operator: 'equals',
    value: 'other',
    action: 'show'
  }
};
```

## Type Inference

All schemas automatically infer TypeScript types:

```typescript
import type { 
  Question, 
  Questionnaire, 
  QuestionnaireResponse 
} from './core/schema.js';

// These types are fully type-safe and derived from Zod schemas
const question: Question = { /* ... */ };
const questionnaire: Questionnaire = { /* ... */ };
const response: QuestionnaireResponse = { /* ... */ };
```

## Validation

### Safe Validation

Use `safeParse` for validation without throwing errors:

```typescript
import { QuestionnaireSchema } from './core/schema.js';

const result = QuestionnaireSchema.safeParse(data);

if (result.success) {
  console.log('Valid:', result.data);
} else {
  console.error('Errors:', result.error.issues);
}
```

### Throwing Validation

Use `parse` or validation functions for throwing errors:

```typescript
import { validateQuestionnaire } from './core/schema.js';

try {
  const validated = validateQuestionnaire(data);
  // Use validated data
} catch (error) {
  // Handle validation error
}
```

## Running the Example

See how the schemas work with a complete example:

```bash
npm run example
```

This runs `src/example.ts` which demonstrates:
- Creating a questionnaire with multiple question types
- Validating the questionnaire structure
- Creating a response object
- Adding answers to a response
- Tracking progress

## Testing

Schema validation tests will be added in Phase 1 Task on Tests (see `docs/implementation-phase1-tests.md`).

## Future Enhancements

- Custom validation functions
- Nested/grouped questions
- Dynamic option loading
- File upload question type
- Signature question type
- Matrix/grid questions
