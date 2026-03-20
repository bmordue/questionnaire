# Phase 1 Task 3: Create Sample Questionnaire Fixtures

## Overview
Develop comprehensive sample questionnaires to validate schema design and support development/testing across all question types and features.

## Goals
- Create realistic questionnaire examples for each use case
- Validate schema completeness and usability
- Provide development and testing fixtures
- Demonstrate all supported question types and features

## Technical Approach

### 1. Fixture Categories

#### Basic Questionnaires
- Simple text and number questions
- Single and multiple choice
- Boolean yes/no questions
- Basic validation rules

#### Advanced Questionnaires
- Complex conditional logic
- Mixed question types
- Advanced validation rules
- Multi-section questionnaires

#### Edge Case Questionnaires
- Maximum length questionnaires
- Deeply nested conditionals
- Complex validation scenarios
- Stress testing fixtures

### 2. Sample Questionnaire Types

#### Customer Feedback Survey
- Rating questions (1-5 scale)
- Multiple choice satisfaction
- Text feedback areas
- Conditional follow-up questions

#### Employee Onboarding
- Personal information collection
- Choice-based preferences
- Date selections
- Multi-step workflow

#### Product Research
- Feature priority ranking
- Usage pattern questions
- Demographic information
- Conditional feature exploration

## Implementation Tasks

### Task 3.1: Basic Fixtures (3 hours)
- [x] Create simple text/number questionnaire
- [x] Develop choice-based survey example
- [x] Build boolean question showcase
- [x] Add basic validation examples

### Task 3.2: Advanced Fixtures (4 hours)
- [x] Create customer feedback survey
- [x] Develop employee onboarding questionnaire
- [x] Build product research survey
- [x] Add demographic information collector

### Task 3.3: Edge Case Fixtures (2 hours)
- [x] Create maximum length questionnaire
- [x] Develop complex conditional logic example
- [x] Build validation stress test
- [x] Add error scenario fixtures

### Task 3.4: Documentation and Validation (2 hours)
- [x] Document each fixture's purpose
- [x] Validate fixtures against schemas
- [x] Create fixture loading utilities
- [x] Add fixture test suite

## Sample Questionnaire Specifications

### 1. Customer Feedback Survey
```json
{
  "id": "customer-feedback-v1",
  "title": "Customer Satisfaction Survey",
  "description": "Help us improve our service",
  "questions": [
    {
      "id": "overall_satisfaction",
      "type": "rating",
      "text": "How satisfied are you with our service?",
      "required": true,
      "validation": {
        "min": 1,
        "max": 5
      }
    },
    {
      "id": "improvement_areas",
      "type": "multiple_choice",
      "text": "Which areas need improvement?",
      "options": [
        "Customer Support",
        "Product Quality",
        "Delivery Speed",
        "Pricing"
      ],
      "conditional": {
        "showIf": {
          "questionId": "overall_satisfaction",
          "operator": "lessThan",
          "value": 4
        }
      }
    }
  ]
}
```

### 2. Employee Onboarding
```json
{
  "id": "employee-onboarding-v1",
  "title": "New Employee Information",
  "description": "Welcome! Please provide your information",
  "questions": [
    {
      "id": "full_name",
      "type": "text",
      "text": "What is your full name?",
      "required": true,
      "validation": {
        "minLength": 2,
        "maxLength": 100
      }
    },
    {
      "id": "start_date",
      "type": "date",
      "text": "What is your start date?",
      "required": true,
      "validation": {
        "minDate": "today",
        "maxDate": "2025-12-31"
      }
    },
    {
      "id": "department",
      "type": "single_choice",
      "text": "Which department will you join?",
      "required": true,
      "options": [
        "Engineering",
        "Marketing", 
        "Sales",
        "HR",
        "Operations"
      ]
    }
  ]
}
```

### 3. Product Research Survey
```json
{
  "id": "product-research-v1",
  "title": "Product Feature Research",
  "description": "Help us prioritize new features",
  "questions": [
    {
      "id": "current_usage",
      "type": "single_choice",
      "text": "How often do you use our product?",
      "required": true,
      "options": [
        "Daily",
        "Weekly", 
        "Monthly",
        "Rarely",
        "Never"
      ]
    },
    {
      "id": "feature_priorities",
      "type": "multiple_choice",
      "text": "Which features are most important?",
      "required": false,
      "options": [
        "Mobile App",
        "API Integration",
        "Advanced Analytics",
        "Collaboration Tools"
      ],
      "conditional": {
        "showIf": {
          "questionId": "current_usage",
          "operator": "notEquals",
          "value": "Never"
        }
      }
    }
  ]
}
```

## Fixture Organization

### Directory Structure
```
fixtures/
├── basic/
│   ├── simple-text-survey.json
│   ├── choice-based-quiz.json
│   └── boolean-preferences.json
├── advanced/
│   ├── customer-feedback.json
│   ├── employee-onboarding.json
│   ├── product-research.json
│   └── demographic-survey.json
├── edge-cases/
│   ├── maximum-length.json
│   ├── complex-conditionals.json
│   ├── validation-stress.json
│   └── error-scenarios.json
└── responses/
    ├── sample-responses.json
    └── test-sessions.json
```

### Fixture Categories

#### Basic Examples (3 fixtures)
- Simple text and number inputs
- Basic choice selections
- Minimal validation rules
- No conditional logic

#### Real-world Examples (4 fixtures)
- Customer satisfaction surveys
- Employee data collection
- Market research questionnaires
- Event registration forms

#### Edge Cases (4 fixtures)
- 50+ question questionnaire
- 5+ levels of conditional nesting
- All validation rule types
- Error and recovery scenarios

## Validation Requirements

### Schema Compliance
- All fixtures must pass Zod validation
- Question types must be properly defined
- Validation rules must be syntactically correct
- Conditional logic must be well-formed

### Usability Testing
- Each fixture should be manually testable
- Question flow should be logical
- Validation messages should be clear
- User experience should be smooth

## Fixture Utilities

### Loading System
```typescript
class FixtureLoader {
  static loadBasicFixtures(): Promise<Questionnaire[]>
  static loadAdvancedFixtures(): Promise<Questionnaire[]>
  static loadEdgeCaseFixtures(): Promise<Questionnaire[]>
  static loadSampleResponses(): Promise<Response[]>
}
```

### Validation Tools
```typescript
class FixtureValidator {
  static validateAllFixtures(): Promise<ValidationResult[]>
  static generateSchemaReport(): Promise<SchemaReport>
  static testQuestionnaireFlow(id: string): Promise<FlowResult>
}
```

## File Structure
```
src/
├── fixtures/
│   ├── index.ts             # Fixture exports
│   ├── loader.ts            # Fixture loading utilities
│   ├── validator.ts         # Fixture validation
│   └── generator.ts         # Fixture generation tools
├── test/
│   └── fixtures/
│       ├── fixture.test.ts  # Fixture validation tests
│       └── schema.test.ts   # Schema compliance tests
```

## Testing Requirements

### Fixture Validation Tests
- Schema compliance validation
- Question type coverage verification
- Conditional logic testing
- Validation rule verification

### Integration Tests
- Loading and parsing fixtures
- Running complete questionnaires
- Response generation and storage
- Error handling scenarios

## Documentation

### Fixture Documentation
- Purpose and use case for each fixture
- Question type demonstrations
- Feature showcases
- Testing scenarios covered

### Usage Examples
- How to load and use fixtures
- Integration with development workflow
- Testing best practices
- Fixture modification guidelines

## Acceptance Criteria
- [x] Complete set of basic questionnaire examples
- [x] Real-world questionnaire scenarios covered
- [x] Edge cases and stress tests included
- [x] All fixtures validate against schemas
- [x] Fixtures demonstrate all question types
- [x] Conditional logic examples provided
- [x] Sample responses are realistic and valid
- [x] Documentation is comprehensive and clear
- [x] Fixture loading utilities work correctly
- [x] Integration tests pass for all fixtures

## Dependencies
- Zod schemas (for validation)
- File system utilities
- JSON parsing/validation
- Test framework integration
