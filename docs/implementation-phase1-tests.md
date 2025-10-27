# Phase 1 Task 4: Write Unit Tests for Schema Validation

## Overview
Develop comprehensive unit tests to ensure schema validation works correctly for all question types, validation rules, and edge cases.

## Goals
- Achieve 100% test coverage for schema validation
- Validate all question types and their specific rules
- Test error scenarios and edge cases
- Ensure type safety and runtime validation alignment

## Technical Approach

### 1. Testing Strategy

#### Test Categories
- **Schema Definition Tests**: Verify schema structure
- **Valid Data Tests**: Confirm valid inputs pass validation
- **Invalid Data Tests**: Ensure invalid inputs are rejected
- **Edge Case Tests**: Test boundary conditions and limits
- **Integration Tests**: Test schema interactions

#### Test Structure
```typescript
describe('Schema Validation', () => {
  describe('Question Schemas', () => {
    describe('Text Questions', () => {
      // Text-specific validation tests
    })
    describe('Choice Questions', () => {
      // Choice-specific validation tests  
    })
    // ... other question types
  })
  
  describe('Questionnaire Schema', () => {
    // Overall questionnaire validation
  })
  
  describe('Response Schema', () => {
    // Response validation tests
  })
})
```

## Implementation Tasks

### Task 4.1: Question Type Validation Tests (6 hours)
- [ ] Text question validation tests
- [ ] Number question validation tests  
- [ ] Email question validation tests
- [ ] Choice question validation tests
- [ ] Boolean question validation tests
- [ ] Date question validation tests
- [ ] Rating question validation tests

### Task 4.2: Questionnaire Validation Tests (3 hours)
- [ ] Questionnaire structure validation
- [ ] Metadata validation tests
- [ ] Question array validation
- [ ] ID uniqueness validation
- [ ] Version validation tests

### Task 4.3: Response Validation Tests (3 hours)
- [ ] Response structure validation
- [ ] Answer type validation
- [ ] Session data validation
- [ ] Progress tracking validation
- [ ] Metadata validation

### Task 4.4: Edge Cases and Integration (3 hours)
- [ ] Boundary condition tests
- [ ] Large data structure tests
- [ ] Complex conditional logic tests
- [ ] Schema composition tests
- [ ] Performance tests

## Test Specifications

### 1. Text Question Validation Tests

#### Valid Cases
```typescript
describe('Text Question - Valid Cases', () => {
  it('should accept valid text question', () => {
    const validTextQuestion = {
      id: 'q1',
      type: 'text',
      text: 'What is your name?',
      required: true,
      validation: {
        minLength: 2,
        maxLength: 50
      }
    }
    expect(() => QuestionSchema.parse(validTextQuestion)).not.toThrow()
  })

  it('should accept text question without validation', () => {
    const minimalTextQuestion = {
      id: 'q2', 
      type: 'text',
      text: 'Comments?',
      required: false
    }
    expect(() => QuestionSchema.parse(minimalTextQuestion)).not.toThrow()
  })
})
```

#### Invalid Cases
```typescript
describe('Text Question - Invalid Cases', () => {
  it('should reject text question without id', () => {
    const invalidQuestion = {
      type: 'text',
      text: 'Question without ID'
    }
    expect(() => QuestionSchema.parse(invalidQuestion)).toThrow()
  })

  it('should reject negative minLength', () => {
    const invalidQuestion = {
      id: 'q1',
      type: 'text', 
      text: 'Question',
      validation: {
        minLength: -1
      }
    }
    expect(() => QuestionSchema.parse(invalidQuestion)).toThrow()
  })
})
```

### 2. Choice Question Validation Tests

#### Valid Cases
```typescript
describe('Choice Question - Valid Cases', () => {
  it('should accept single choice question', () => {
    const validChoice = {
      id: 'q3',
      type: 'single_choice',
      text: 'Pick one option',
      required: true,
      options: ['Option A', 'Option B', 'Option C']
    }
    expect(() => QuestionSchema.parse(validChoice)).not.toThrow()
  })

  it('should accept multiple choice with max selections', () => {
    const validMultiple = {
      id: 'q4',
      type: 'multiple_choice', 
      text: 'Pick up to 3 options',
      required: false,
      options: ['A', 'B', 'C', 'D', 'E'],
      validation: {
        maxSelections: 3
      }
    }
    expect(() => QuestionSchema.parse(validMultiple)).not.toThrow()
  })
})
```

#### Invalid Cases
```typescript
describe('Choice Question - Invalid Cases', () => {
  it('should reject choice question without options', () => {
    const invalidChoice = {
      id: 'q5',
      type: 'single_choice',
      text: 'Choose option'
    }
    expect(() => QuestionSchema.parse(invalidChoice)).toThrow()
  })

  it('should reject empty options array', () => {
    const invalidChoice = {
      id: 'q6',
      type: 'single_choice',
      text: 'Choose option',
      options: []
    }
    expect(() => QuestionSchema.parse(invalidChoice)).toThrow()
  })
})
```

### 3. Number Question Validation Tests

#### Valid Cases
```typescript
describe('Number Question - Valid Cases', () => {
  it('should accept number with min/max range', () => {
    const validNumber = {
      id: 'q7',
      type: 'number',
      text: 'Enter age',
      required: true,
      validation: {
        min: 0,
        max: 120,
        integer: true
      }
    }
    expect(() => QuestionSchema.parse(validNumber)).not.toThrow()
  })

  it('should accept decimal numbers', () => {
    const validDecimal = {
      id: 'q8',
      type: 'number',
      text: 'Enter price',
      validation: {
        min: 0,
        precision: 2
      }
    }
    expect(() => QuestionSchema.parse(validDecimal)).not.toThrow()
  })
})
```

### 4. Questionnaire Validation Tests

#### Valid Cases
```typescript
describe('Questionnaire - Valid Cases', () => {
  it('should accept complete questionnaire', () => {
    const validQuestionnaire = {
      id: 'survey-1',
      title: 'Customer Survey',
      description: 'Please provide feedback',
      version: '1.0',
      questions: [
        {
          id: 'q1',
          type: 'text',
          text: 'Your name?',
          required: true
        }
      ],
      metadata: {
        createdAt: '2025-01-01T00:00:00Z',
        updatedAt: '2025-01-01T00:00:00Z'
      }
    }
    expect(() => QuestionnaireSchema.parse(validQuestionnaire)).not.toThrow()
  })
})
```

#### Invalid Cases
```typescript
describe('Questionnaire - Invalid Cases', () => {
  it('should reject duplicate question IDs', () => {
    const invalidQuestionnaire = {
      id: 'survey-2',
      title: 'Survey',
      questions: [
        { id: 'q1', type: 'text', text: 'Question 1' },
        { id: 'q1', type: 'text', text: 'Question 2' } // Duplicate ID
      ]
    }
    expect(() => QuestionnaireSchema.parse(invalidQuestionnaire)).toThrow()
  })

  it('should reject empty questions array', () => {
    const invalidQuestionnaire = {
      id: 'survey-3',
      title: 'Empty Survey',
      questions: []
    }
    expect(() => QuestionnaireSchema.parse(invalidQuestionnaire)).toThrow()
  })
})
```

### 5. Response Validation Tests

#### Valid Cases
```typescript
describe('Response - Valid Cases', () => {
  it('should accept complete response', () => {
    const validResponse = {
      questionnaireId: 'survey-1',
      sessionId: 'session-123',
      responses: {
        'q1': 'John Doe',
        'q2': 25
      },
      metadata: {
        startedAt: '2025-01-01T10:00:00Z',
        completedAt: '2025-01-01T10:05:00Z',
        status: 'completed'
      },
      progress: {
        currentQuestionIndex: 2,
        totalQuestions: 2,
        completed: true
      }
    }
    expect(() => ResponseSchema.parse(validResponse)).not.toThrow()
  })
})
```

## Testing Utilities

### Test Data Factories
```typescript
class TestDataFactory {
  static createValidTextQuestion(overrides?: Partial<TextQuestion>): TextQuestion
  static createValidChoiceQuestion(overrides?: Partial<ChoiceQuestion>): ChoiceQuestion
  static createValidQuestionnaire(overrides?: Partial<Questionnaire>): Questionnaire
  static createValidResponse(overrides?: Partial<Response>): Response
}
```

### Validation Helpers
```typescript
class ValidationTestHelpers {
  static expectValidationError(schema: ZodSchema, data: any, expectedMessage?: string): void
  static expectValidationSuccess(schema: ZodSchema, data: any): void
  static testBoundaryValues(schema: ZodSchema, field: string, min: number, max: number): void
}
```

## File Structure
```
src/test/
├── schemas/
│   ├── question-schemas.test.ts     # Question type tests
│   ├── questionnaire-schema.test.ts # Questionnaire tests
│   ├── response-schema.test.ts      # Response tests
│   ├── validation-rules.test.ts     # Validation rule tests
│   └── integration.test.ts          # Schema integration tests
├── helpers/
│   ├── test-data-factory.ts         # Test data generation
│   ├── validation-helpers.ts        # Testing utilities
│   └── fixtures.ts                  # Test fixtures
└── __mocks__/
    └── schemas.ts                   # Mocked schemas for testing
```

## Test Coverage Requirements

### Coverage Targets
- **Line Coverage**: 100%
- **Branch Coverage**: 100% 
- **Function Coverage**: 100%
- **Statement Coverage**: 100%

### Critical Test Areas
- All question type validations
- All validation rule combinations
- Error message accuracy
- Schema composition correctness
- Performance with large datasets

## Performance Tests

### Load Testing
```typescript
describe('Schema Performance', () => {
  it('should validate large questionnaire quickly', () => {
    const largeQuestionnaire = TestDataFactory.createLargeQuestionnaire(1000)
    const start = performance.now()
    QuestionnaireSchema.parse(largeQuestionnaire)
    const duration = performance.now() - start
    expect(duration).toBeLessThan(100) // Should complete in <100ms
  })
})
```

### Memory Testing
```typescript
describe('Memory Usage', () => {
  it('should not leak memory during validation', () => {
    const initialMemory = process.memoryUsage().heapUsed
    
    for (let i = 0; i < 1000; i++) {
      const questionnaire = TestDataFactory.createValidQuestionnaire()
      QuestionnaireSchema.parse(questionnaire)
    }
    
    const finalMemory = process.memoryUsage().heapUsed
    const memoryIncrease = finalMemory - initialMemory
    expect(memoryIncrease).toBeLessThan(10 * 1024 * 1024) // <10MB increase
  })
})
```

## Error Message Testing

### Custom Error Messages
```typescript
describe('Error Messages', () => {
  it('should provide helpful error for missing required field', () => {
    try {
      QuestionSchema.parse({ type: 'text' }) // Missing id
    } catch (error) {
      expect(error.message).toContain('id is required')
    }
  })

  it('should provide specific validation error messages', () => {
    try {
      TextQuestionSchema.parse({
        id: 'q1',
        type: 'text',
        text: 'Question',
        validation: { minLength: -1 }
      })
    } catch (error) {
      expect(error.message).toContain('minLength must be positive')
    }
  })
})
```

## Acceptance Criteria
- [ ] 100% test coverage for all schemas
- [ ] All question types have comprehensive validation tests
- [ ] Error scenarios are thoroughly tested
- [ ] Performance tests pass for large datasets
- [ ] Integration tests validate schema interactions
- [ ] Test utilities are reusable and well-documented
- [ ] Error messages are helpful and specific
- [ ] All edge cases and boundary conditions are tested
- [ ] Tests run quickly and reliably
- [ ] Test documentation is comprehensive

## Dependencies
- Jest (testing framework)
- @types/jest (TypeScript support)
- Zod (schema validation library)
- Performance testing utilities

