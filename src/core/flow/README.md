# Questionnaire Flow Engine

Complete flow engine for executing questionnaires with conditional logic, state management, and navigation.

## Features

- **Conditional Logic**: Show/hide/skip questions based on previous answers
- **12 Operators**: equals, notEquals, greaterThan, lessThan, greaterThanOrEqual, lessThanOrEqual, contains, notContains, in, notIn, isEmpty, isNotEmpty
- **Navigation**: next, previous, skip, jumpTo, exit
- **State Management**: Automatic state persistence and session recovery
- **Progress Tracking**: Real-time progress calculation

## Quick Start

```typescript
import { QuestionnaireFlowEngine, NavigationManager } from './core/flow/index.js';
import { createStorageService } from './core/storage.js';

// Create storage and engine
const storage = await createStorageService();
const engine = new QuestionnaireFlowEngine(storage);
const navManager = new NavigationManager(engine);

// Start questionnaire
await engine.start('questionnaire-id');

// Navigate through questions
const result = await navManager.handleNavigation({
  type: 'next',
  answer: 'user answer'
});

// Check progress
const progress = engine.getProgress();
console.log(`${progress.percentComplete}% complete`);
```

## Conditional Logic

Questions can be shown/hidden based on previous answers using conditional logic:

```typescript
{
  id: 'follow-up',
  type: QuestionType.TEXT,
  text: 'Tell us more',
  conditional: {
    showIf: {
      questionId: 'previous-question',
      operator: 'equals',
      value: 'yes'
    }
  }
}
```

### Condition Types

- **showIf**: Show question if condition is true
- **hideIf**: Hide question if condition is true
- **skipIf**: Skip question automatically if condition is true
- **requiredIf**: Make question required if condition is true

### Operators

#### Equality
- `equals`: Value equals specified value
- `notEquals`: Value does not equal specified value

#### Comparison (numbers)
- `greaterThan`: Value is greater than specified value
- `lessThan`: Value is less than specified value
- `greaterThanOrEqual`: Value is greater than or equal to specified value
- `lessThanOrEqual`: Value is less than or equal to specified value

#### Array Operations
- `contains`: Array includes specified value
- `notContains`: Array does not include specified value
- `in`: Value is in specified array of values
- `notIn`: Value is not in specified array of values

#### Empty Checks
- `isEmpty`: Value is null, undefined, empty string, or empty array
- `isNotEmpty`: Value is not null, undefined, empty string, or empty array

### Multiple Conditions

Use arrays for AND logic:

```typescript
conditional: {
  showIf: [
    { questionId: 'q1', operator: 'equals', value: 'yes' },
    { questionId: 'q2', operator: 'greaterThan', value: 5 }
  ]
}
```

## Navigation Actions

### Next
Move to the next question, optionally providing an answer:

```typescript
await navManager.handleNavigation({
  type: 'next',
  answer: 'user answer'
});
```

### Previous
Go back to the previous question:

```typescript
await navManager.handleNavigation({
  type: 'previous'
});
```

### Skip
Skip the current question without answering:

```typescript
await navManager.handleNavigation({
  type: 'skip'
});
```

### Jump To
Jump directly to a specific question:

```typescript
await navManager.handleNavigation({
  type: 'jumpTo',
  questionId: 'target-question-id'
});
```

### Exit
Save state and exit:

```typescript
await navManager.handleNavigation({
  type: 'exit'
});
```

## State Management

The flow engine automatically saves state to storage. To resume a session:

```typescript
const sessionId = 'existing-session-id';
await engine.loadState(sessionId);

// Continue from where user left off
const currentQuestion = engine.getCurrentQuestion();
```

## Progress Tracking

```typescript
const progress = engine.getProgress();
console.log(`Question ${progress.currentQuestion} of ${progress.totalQuestions}`);
console.log(`${progress.answeredQuestions} answered`);
console.log(`${progress.percentComplete}% complete`);
console.log(`Completed: ${progress.isCompleted}`);
```

## Architecture

### Components

- **QuestionnaireFlowEngine**: Core flow management and state
- **ConditionalLogicEngine**: Evaluates conditional logic
- **NavigationManager**: High-level navigation handling
- **ProgressTracker**: Progress calculation utilities

### Flow State

```typescript
interface FlowState {
  questionnaireId: string;
  sessionId: string;
  currentQuestionIndex: number;
  currentQuestionId: string;
  responses: Map<string, any>;
  visitedQuestions: Set<string>;
  skippedQuestions: Set<string>;
  questionHistory: string[];
  isCompleted: boolean;
  startTime: Date;
  lastUpdateTime: Date;
}
```

## Examples

See `src/flow-example.ts` for a complete working example.

Run it with:
```bash
npm run flow-example
```

## Testing

Run the comprehensive test suite:
```bash
npm test
```

Test coverage:
- 68 tests for ConditionalLogicEngine
- 21 tests for QuestionnaireFlowEngine
- 16 tests for NavigationManager

## Error Handling

The flow engine throws `FlowError` for various error conditions:

```typescript
try {
  await engine.next();
} catch (error) {
  if (error instanceof FlowError) {
    console.log('Error code:', error.code);
    console.log('Context:', error.context);
  }
}
```

Error codes:
- `QUESTION_NOT_FOUND`: Question ID not found
- `INVALID_NAVIGATION`: Invalid navigation action
- `CONDITION_ERROR`: Error evaluating condition
- `SESSION_ERROR`: Session-related error
- `STATE_CORRUPTION`: Corrupted state data
- `NO_CURRENT_QUESTION`: No current question available
- `QUESTIONNAIRE_NOT_LOADED`: Questionnaire not loaded
