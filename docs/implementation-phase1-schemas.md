# Phase 1 Task 1: Define TypeScript Schemas with Zod

## Overview
Create comprehensive TypeScript schemas using Zod for questionnaire definitions and response validation.

## Goals
- Define strongly-typed questionnaire schema structure
- Implement runtime validation using Zod
- Support multiple question types and validation rules
- Ensure type safety across the application

## Technical Approach

### 1. Question Types Schema
```typescript
// Question types to support
enum QuestionType {
  TEXT = 'text',
  NUMBER = 'number',
  EMAIL = 'email',
  SINGLE_CHOICE = 'single_choice',
  MULTIPLE_CHOICE = 'multiple_choice',
  BOOLEAN = 'boolean',
  DATE = 'date',
  RATING = 'rating'
}
```

### 2. Core Schema Definitions

#### Question Schema
- `id`: Unique identifier
- `type`: Question type enum
- `text`: Question text/prompt
- `description`: Optional detailed description
- `required`: Boolean flag
- `validation`: Type-specific validation rules
- `options`: For choice-based questions
- `conditional`: Conditional display logic

#### Questionnaire Schema
- `id`: Unique questionnaire identifier
- `title`: Questionnaire title
- `description`: Optional description
- `version`: Schema version
- `questions`: Array of questions
- `metadata`: Creation/modification timestamps

#### Response Schema
- `questionnaireId`: Reference to questionnaire
- `sessionId`: Unique session identifier
- `responses`: Map of question ID to answer
- `metadata`: Completion status, timestamps
- `progress`: Current question index

## Implementation Tasks

### Task 1.1: Base Schema Types (2 hours)
- [ ] Create `src/core/schema.ts`
- [ ] Define base Zod schemas for questions
- [ ] Implement question type enum
- [ ] Add validation rules structure

### Task 1.2: Question Type Schemas (3 hours)
- [ ] Implement text/email/number question schemas
- [ ] Create choice-based question schemas
- [ ] Add rating and date question schemas
- [ ] Define validation rule schemas for each type

### Task 1.3: Questionnaire Schema (2 hours)
- [ ] Create main questionnaire schema
- [ ] Add metadata and versioning fields
- [ ] Implement questionnaire validation logic
- [ ] Add schema composition utilities

### Task 1.4: Response Schema (2 hours)
- [ ] Define response data structure
- [ ] Create session management schema
- [ ] Add progress tracking schema
- [ ] Implement response validation

## Validation Rules

### Text Questions
- Min/max length
- Regex patterns
- Required field validation

### Number Questions
- Min/max values
- Integer/decimal constraints
- Range validation

### Choice Questions
- Valid option selection
- Multiple selection limits
- Other/custom option support

### Date Questions
- Date format validation
- Min/max date ranges
- Future/past date constraints

## File Structure
```
src/core/
├── schema.ts                 # Main schema exports
├── schemas/
│   ├── question.ts          # Question schemas
│   ├── questionnaire.ts     # Questionnaire schema
│   ├── response.ts          # Response schema
│   └── validation.ts        # Validation utilities
```

## Testing Requirements
- Unit tests for each schema type
- Validation rule testing
- Invalid data rejection tests
- Schema composition tests

## Acceptance Criteria
- [ ] All question types have complete Zod schemas
- [ ] Schemas provide comprehensive TypeScript types
- [ ] Runtime validation catches all invalid inputs
- [ ] Schema exports are properly organized
- [ ] 100% test coverage for schema validation
- [ ] Documentation for schema usage

## Dependencies
- Zod (runtime validation)
- TypeScript (type definitions)
- Jest (testing framework)

