# Questionnaire TUI

A TypeScript-based Terminal User Interface (TUI) application for executing interactive questionnaires with persistent storage of responses.

## Features

- ✅ **Comprehensive Schema System**: Zod-based type-safe schemas for questionnaires
- ✅ **Rich Question Types**: Text, number, email, single/multiple choice, boolean, date, and rating questions
- ✅ **Advanced Validation**: Min/max length, patterns, ranges, date constraints, and selection limits
- ✅ **Conditional Logic**: Show/hide questions based on previous answers
- ✅ **Fixture Library**: 11 sample questionnaires for testing and demonstration
- ✅ **Test Coverage**: Comprehensive test suite with 354 passing tests
- ✅ **Markdown Export**: Convert responses to LLM-optimized markdown format

## Quick Start

### Installation

```bash
npm install
```

### Build

```bash
npm run build
```

### Run Tests

```bash
npm test
```

### Validate Fixtures

```bash
npm run validate
```

This will:
- Load all 11 sample questionnaires
- Validate them against schemas
- Generate a coverage report
- Test questionnaire flows

### Convert Response to Markdown

Convert a questionnaire response JSON to markdown format:

```bash
npm run markdown-convert -- <response.json> <questionnaire.json> [output.md]
```

Examples:
```bash
# Output to stdout
npm run markdown-convert -- examples/sample-response.json fixtures/basic/simple-text-survey.json

# Output to file
npm run markdown-convert -- examples/sample-response.json fixtures/basic/simple-text-survey.json output.md
```

The markdown format is optimized for LLM consumption with clear structure, formatted answers, and complete metadata. See [examples/README.md](examples/README.md) for more details.

## Project Structure

```
questionnaire/
├── examples/              # Sample responses and markdown outputs
│   ├── sample-response.json           # Example response
│   ├── sample-response.md             # Generated markdown
│   └── README.md                      # Examples documentation
├── fixtures/              # Sample questionnaires
│   ├── basic/            # Simple examples (3 fixtures)
│   ├── advanced/         # Real-world scenarios (4 fixtures)
│   ├── edge-cases/       # Stress tests (4 fixtures)
│   └── README.md         # Fixture documentation
├── src/
│   ├── core/
│   │   ├── schema.ts           # Schema exports
│   │   └── schemas/
│   │       ├── question.ts     # Question type schemas
│   │       └── questionnaire.ts # Questionnaire schema
│   ├── fixtures/
│   │   ├── loader.ts           # Fixture loading utilities
│   │   ├── validator.ts        # Fixture validation
│   │   └── index.ts            # Exports
│   ├── utils/
│   │   └── markdown-converter.ts # Markdown conversion utility
│   ├── markdown-convert.ts     # CLI script for markdown conversion
│   └── __tests__/              # Test suite
├── docs/                       # Documentation
└── package.json
```

## Question Types

The system supports the following question types:

### Text Questions
- Basic text input with optional validation
- Email addresses with validation
- Min/max length constraints
- Regex pattern matching

### Numeric Questions
- Integer or decimal numbers
- Min/max value ranges
- Type validation

### Choice Questions
- Single choice (radio buttons)
- Multiple choice (checkboxes)
- Min/max selection limits

### Other Types
- Boolean (yes/no)
- Date (with range constraints)
- Rating (1-5, 1-10, etc.)

## Validation Rules

Each question type supports specific validation rules:

- **Text/Email**: `minLength`, `maxLength`, `pattern`
- **Number/Rating**: `min`, `max`, `integer`
- **Date**: `minDate`, `maxDate`
- **Multiple Choice**: `minSelections`, `maxSelections`

## Conditional Logic

Questions can be conditionally shown/hidden based on previous answers:

```json
{
  "conditional": {
    "showIf": {
      "questionId": "previous_question",
      "operator": "equals",
      "value": "some_value"
    }
  }
}
```

Supported operators:
- `equals`, `notEquals`
- `greaterThan`, `lessThan`
- `greaterThanOrEqual`, `lessThanOrEqual`
- `contains`

## Sample Fixtures

The project includes 11 sample questionnaires:

### Basic (3)
1. **simple-text-survey** - Text, number, and email inputs
2. **choice-based-quiz** - Single and multiple choice questions
3. **boolean-preferences** - Yes/no questions

### Advanced (4)
1. **customer-feedback** - Customer satisfaction with conditionals
2. **employee-onboarding** - New hire information collection
3. **product-research** - Feature prioritization survey
4. **demographic-survey** - Audience demographics

### Edge Cases (4)
1. **complex-conditionals** - Multi-level conditional logic
2. **validation-stress** - All validation types
3. **maximum-length** - 55 questions for stress testing
4. **error-scenarios** - Boundary conditions

See [fixtures/README.md](fixtures/README.md) for detailed documentation.

## Usage Examples

### Loading Fixtures

```typescript
import { FixtureLoader } from './src/fixtures/loader.js';

// Load all fixtures
const allFixtures = await FixtureLoader.loadAllFixtures();

// Load by category
const basicFixtures = await FixtureLoader.loadBasicFixtures();
const advancedFixtures = await FixtureLoader.loadAdvancedFixtures();

// Load specific fixture
const fixture = await FixtureLoader.loadFixture('basic/simple-text-survey.json');
```

### Validating Questionnaires

```typescript
import { FixtureValidator } from './src/fixtures/validator.js';

// Validate a questionnaire
const result = FixtureValidator.validateQuestionnaire(data, 'my-questionnaire');

if (!result.valid) {
  console.error('Validation errors:', result.errors);
}

// Generate coverage report
const report = FixtureValidator.generateSchemaReport(fixtures);
console.log('Valid fixtures:', report.validFixtures);
console.log('Question type coverage:', report.questionTypeCoverage);

// Test questionnaire flow
const flowResult = FixtureValidator.testQuestionnaireFlow(questionnaire);
if (!flowResult.valid) {
  console.error('Flow issues:', flowResult.issues);
}
```

## Development Status

### Phase 1: Core Schema & Storage ✅
- [x] Define TypeScript schemas with Zod
- [x] Create sample questionnaire fixtures
- [x] Write unit tests for schema validation

### Phase 2: Questionnaire Runner (In Progress)
- [ ] Build TUI components for each question type
- [ ] Implement question flow logic
- [ ] Add validation and error handling
- [ ] Implement response persistence

### Phase 3: Advanced Features (Planned)
- [ ] Conditional logic engine
- [ ] Response viewing and analytics
- [ ] Export functionality

See [docs/](docs/) for detailed implementation plans.

## Test Coverage

The project includes comprehensive test coverage:

- 21 passing tests
- Schema validation tests
- Fixture loading tests
- Flow validation tests
- Edge case tests

Run tests with:
```bash
npm test
```

## License

ISC

## Contributing

This project is in active development. See the [implementation plans](docs/) for upcoming features and tasks.
