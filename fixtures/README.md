# Questionnaire Fixtures

This directory contains sample questionnaire fixtures used for development, testing, and demonstration purposes.

## Directory Structure

```
fixtures/
├── basic/              # Simple questionnaires demonstrating basic features
├── advanced/           # Real-world questionnaires with advanced features
├── edge-cases/         # Edge cases and stress tests
└── responses/          # Sample response data (reserved for future use)
```

## Fixture Categories

### Basic Fixtures (`fixtures/basic/`)

Simple questionnaires demonstrating fundamental question types and validation:

1. **simple-text-survey.json** - Text, number, and email input fields
   - Demonstrates basic text validation (min/max length)
   - Number validation with ranges
   - Required vs optional fields

2. **choice-based-quiz.json** - Single and multiple choice questions
   - Single choice selections
   - Multiple choice with selection limits
   - Option-based questions

3. **boolean-preferences.json** - Yes/no boolean questions
   - User preferences
   - Terms acceptance
   - Simple boolean flags

### Advanced Fixtures (`fixtures/advanced/`)

Real-world questionnaire scenarios with complex logic:

1. **customer-feedback.json** - Customer satisfaction survey
   - Rating scales (1-5, 1-10)
   - Conditional follow-up questions based on ratings
   - Email collection with conditionals
   - Demonstrates: conditional logic, ratings, mixed question types

2. **employee-onboarding.json** - New employee information collection
   - Personal information (name, start date)
   - Department and position selection
   - Equipment requests
   - Emergency contact information
   - Demonstrates: date validation, comprehensive data collection

3. **product-research.json** - Product feature prioritization
   - Usage frequency tracking
   - Feature priority selection
   - Competitor analysis
   - Multiple levels of conditional logic
   - Demonstrates: complex conditionals, market research patterns

4. **demographic-survey.json** - Audience demographic data
   - Age ranges and location
   - Education and employment
   - Industry-specific questions (conditional)
   - Household and interest information
   - Demonstrates: demographic data collection patterns

### Edge Case Fixtures (`fixtures/edge-cases/`)

Stress tests and boundary conditions:

1. **complex-conditionals.json** - Multi-level conditional dependencies
   - 5 levels of nested conditional logic
   - Multiple conditional branches
   - Demonstrates: complex question flow scenarios

2. **validation-stress.json** - All validation rule types
   - Min/max length validation
   - Pattern/regex validation
   - Number ranges (integers and decimals)
   - Date range validation
   - Selection count limits
   - Demonstrates: comprehensive validation coverage

3. **maximum-length.json** - Large questionnaire (50+ questions)
   - 55 questions covering all types
   - Stress test for performance
   - Demonstrates: handling large questionnaires

4. **error-scenarios.json** - Edge cases and boundary conditions
   - Empty/minimal values
   - Single options
   - Many options (15+)
   - Negative numbers
   - Past/future date constraints
   - Demonstrates: edge case handling

## Using Fixtures

### Loading Fixtures in Code

```typescript
import { FixtureLoader } from './src/fixtures/loader.js';

// Load specific category
const basicFixtures = await FixtureLoader.loadBasicFixtures();
const advancedFixtures = await FixtureLoader.loadAdvancedFixtures();
const edgeCaseFixtures = await FixtureLoader.loadEdgeCaseFixtures();

// Load all fixtures
const allFixtures = await FixtureLoader.loadAllFixtures();

// Load a specific fixture
const fixture = await FixtureLoader.loadFixture('basic/simple-text-survey.json');
```

### Validating Fixtures

```typescript
import { FixtureValidator } from './src/fixtures/validator.js';

// Validate a single questionnaire
const result = FixtureValidator.validateQuestionnaire(data, 'my-questionnaire');

// Generate schema coverage report
const fixtures = await FixtureLoader.loadAllFixtures();
const report = FixtureValidator.generateSchemaReport(fixtures);

console.log(`Valid fixtures: ${report.validFixtures}/${report.totalFixtures}`);
console.log('Question types covered:', report.questionTypeCoverage);
console.log('Validation rules used:', report.validationRuleCoverage);

// Test questionnaire flow
const flowResult = FixtureValidator.testQuestionnaireFlow(questionnaire);
if (!flowResult.valid) {
  console.error('Flow issues:', flowResult.issues);
}
```

## Question Type Coverage

All fixtures combined provide coverage for:

- ✅ Text questions (with min/max length, pattern validation)
- ✅ Number questions (integers, decimals, ranges)
- ✅ Email questions
- ✅ Single choice questions
- ✅ Multiple choice questions (with selection limits)
- ✅ Boolean questions
- ✅ Date questions (with date ranges)
- ✅ Rating questions (various scales)

## Validation Rule Coverage

The fixtures demonstrate:

- Text validation: `minLength`, `maxLength`, `pattern`
- Number validation: `min`, `max`, `integer`
- Date validation: `minDate`, `maxDate`
- Choice validation: `minSelections`, `maxSelections`
- Conditional logic: `showIf` with various operators

## Conditional Logic Operators

Fixtures demonstrate these conditional operators:

- `equals` - Show if value equals specified value
- `notEquals` - Show if value does not equal specified value
- `lessThan` - Show if value is less than specified value
- `greaterThan` - Show if value is greater than specified value
- `greaterThanOrEqual` - Show if value is >= specified value
- `lessThanOrEqual` - Show if value is <= specified value

## Running Tests

To validate all fixtures:

```bash
npm test
```

This will:
1. Load all fixtures from all categories
2. Validate them against the Zod schemas
3. Check for duplicate IDs
4. Verify conditional references
5. Generate coverage reports

## Adding New Fixtures

To add a new fixture:

1. Create a JSON file in the appropriate directory
2. Follow the schema structure (see examples)
3. Ensure unique questionnaire ID
4. Run tests to validate: `npm test`
5. Document the fixture's purpose and features

## Schema Validation

All fixtures must conform to the Zod schemas defined in `src/core/schemas/`. The schema enforces:

- Required fields (id, title, questions)
- Valid question types
- Proper validation rule formats
- Correct conditional logic structure
- Unique question IDs within a questionnaire

## Best Practices

1. **Use descriptive IDs**: Follow the pattern `{name}-v{version}`
2. **Include descriptions**: Help users understand the purpose
3. **Test edge cases**: Include boundary conditions
4. **Validate conditionals**: Ensure referenced questions exist
5. **Keep realistic**: Use real-world scenarios when possible
6. **Document purpose**: Add comments in this file for new fixtures
