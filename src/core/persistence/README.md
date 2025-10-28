# Persistence Module

The persistence module provides comprehensive response management for questionnaire sessions, including incremental saving, auto-save, session recovery, and analytics.

## Features

- **Response Builder** - Incremental response construction with metadata tracking
- **Auto-save** - Configurable automatic saving at regular intervals
- **Session Recovery** - Resume incomplete sessions across app restarts
- **Progress Tracking** - Real-time tracking of completion status
- **Analytics** - Completion statistics and question-level insights
- **Export** - Export responses in JSON and CSV formats

## Architecture

### Core Components

```
src/core/
├── persistence/
│   ├── response-builder.ts      # Manages incremental response construction
│   ├── persistence-manager.ts   # Coordinates sessions and auto-save
│   └── index.ts                 # Module exports
└── analytics/
    ├── response-analytics.ts    # Analytics and statistics
    └── index.ts                 # Module exports
```

## Usage

### Basic Session Flow

```typescript
import { createStorageService } from './core/storage.js';
import { PersistenceManager } from './core/persistence/persistence-manager.js';

// Create storage and persistence manager
const storage = await createStorageService({ dataDirectory: './data' });
const manager = new PersistenceManager(storage, 30000); // 30s auto-save

// Start a session
const session = await manager.startSession(questionnaire);

// Record answers with metadata
await session.responseBuilder.recordAnswer('q1', 'Answer', {
  duration: 5000  // Time spent in milliseconds
});

// Skip a question
await session.responseBuilder.skipQuestion('q2');

// Update an existing answer
await session.responseBuilder.updateAnswer('q1', 'Updated answer', 2000);

// Complete the response
const completed = await session.responseBuilder.complete();

// End the session (stops auto-save)
await manager.endSession();
```

### Session Recovery

```typescript
// Resume a previously started session
const session = await manager.resumeSession(sessionId);

// Continue from where user left off
const response = session.responseBuilder.getResponse();
console.log(`Continuing with ${response.answers.length} answers already recorded`);
```

### Analytics

```typescript
import { ResponseAnalytics } from './core/analytics/response-analytics.js';

const analytics = new ResponseAnalytics(storage);

// Get completion statistics
const stats = await analytics.getCompletionStats(questionnaireId);
console.log(`Completion rate: ${stats.completionRate}%`);
console.log(`Average time: ${stats.averageCompletionTime}ms`);

// Get question-level statistics
const questionStats = await analytics.getQuestionStats(questionnaireId, 'q1');
console.log(`Answered: ${questionStats.answeredCount}`);
console.log(`Skipped: ${questionStats.skippedCount}`);
console.log(`Average attempts: ${questionStats.averageAttempts}`);
console.log(`Response distribution:`, questionStats.responseDistribution);
```

### Export

```typescript
// Export as JSON
const jsonData = await manager.exportResponse(sessionId, 'json');
console.log(JSON.parse(jsonData));

// Export as CSV
const csvData = await manager.exportResponse(sessionId, 'csv');
console.log(csvData);
```

## Response Schema

### Enhanced Response Structure

```typescript
interface QuestionnaireResponse {
  id: string;
  questionnaireId: string;
  questionnaireVersion: string;
  sessionId: string;
  startedAt: string;
  completedAt?: string;
  lastSavedAt?: string;
  totalDuration?: number;
  status: ResponseStatus;
  answers: Answer[];
  progress: ResponseProgress;
  metadata?: Record<string, any>;
  version: string;
}

interface Answer {
  questionId: string;
  value: any;
  answeredAt: string;
  duration?: number;    // Time spent on question (ms)
  attempts?: number;    // Number of times answer was changed
  skipped?: boolean;    // Whether question was skipped
}

interface ResponseProgress {
  currentQuestionIndex: number;
  totalQuestions: number;
  answeredCount: number;
  skippedCount?: number;
  percentComplete?: number;
}
```

## ResponseBuilder API

### Methods

#### `recordAnswer(questionId, value, metadata?)`
Record a new answer or update an existing one.
- **questionId**: string - Question identifier
- **value**: any - Answer value
- **metadata**: AnswerMetadata - Optional timing metadata
  - `duration`: number - Time spent in milliseconds
  - `timestamp`: string - Custom timestamp (defaults to now)

#### `skipQuestion(questionId)`
Mark a question as skipped.
- **questionId**: string - Question identifier

#### `updateAnswer(questionId, newValue, duration?)`
Update an existing answer with new value.
- **questionId**: string - Question identifier
- **newValue**: any - New answer value
- **duration**: number - Additional time spent (ms)

#### `complete()`
Mark the response as completed and save final state.
Returns the completed response with:
- `status` set to COMPLETED
- `completedAt` timestamp
- `totalDuration` calculated
- `percentComplete` set to 100

#### `abandon()`
Mark the response as abandoned.

#### `getResponse()`
Get the current response state (returns a copy).

## PersistenceManager API

### Constructor
```typescript
new PersistenceManager(storage: StorageService, autoSaveIntervalMs: number = 30000)
```
- **storage**: StorageService - Storage service instance
- **autoSaveIntervalMs**: number - Auto-save interval in milliseconds (default: 30s)

### Methods

#### `startSession(questionnaire, sessionId?)`
Start a new session or resume an existing one.
- **questionnaire**: Questionnaire - Questionnaire to answer
- **sessionId**: string - Optional session ID to resume
- Returns: ResponseSession

#### `resumeSession(sessionId)`
Resume an existing session by ID.
- **sessionId**: string - Session identifier
- Returns: ResponseSession

#### `endSession()`
End the current session (stops auto-save).

#### `exportResponse(sessionId, format)`
Export a response in the specified format.
- **sessionId**: string - Session identifier
- **format**: 'json' | 'csv' - Export format
- Returns: string - Exported data

## Analytics API

### ResponseAnalytics Methods

#### `getCompletionStats(questionnaireId)`
Get completion statistics for a questionnaire.
- Returns: CompletionStats
  - `totalResponses`: number
  - `completedResponses`: number
  - `completionRate`: number (percentage)
  - `averageCompletionTime`: number (ms)
  - `abandonmentRate`: number (percentage)

#### `getQuestionStats(questionnaireId, questionId)`
Get statistics for a specific question.
- Returns: QuestionStats
  - `questionId`: string
  - `totalResponses`: number
  - `answeredCount`: number
  - `skippedCount`: number
  - `averageAttempts`: number
  - `averageDuration`: number (ms)
  - `responseDistribution`: ResponseDistribution

## Auto-Save

The PersistenceManager automatically saves responses at configured intervals:

```typescript
// Create manager with 10-second auto-save
const manager = new PersistenceManager(storage, 10000);

// Start session - auto-save begins
const session = await manager.startSession(questionnaire);

// Changes are automatically saved every 10 seconds
await session.responseBuilder.recordAnswer('q1', 'Answer');

// End session - auto-save stops
await manager.endSession();
```

Auto-save:
- Runs in the background at configured interval
- Gracefully handles errors (logs warnings but doesn't interrupt user)
- Stops when session ends
- Saves to the same session file (incremental updates)

## Progress Tracking

Response progress is automatically calculated and updated:

```typescript
const response = builder.getResponse();
console.log(response.progress);
// {
//   currentQuestionIndex: 2,
//   totalQuestions: 10,
//   answeredCount: 2,
//   skippedCount: 0,
//   percentComplete: 20
// }
```

Progress tracking:
- Updates automatically on each answer/skip
- Counts only non-skipped answers in `answeredCount`
- Tracks skipped questions separately
- Calculates `percentComplete` based on answered questions

## Example

See `src/persistence-example.ts` for a complete working example demonstrating:
- Session creation and management
- Answer recording with metadata
- Session recovery
- Analytics generation
- Export functionality

Run with:
```bash
npm run persistence-example
```

## Testing

The persistence module has comprehensive test coverage:
- `src/__tests__/persistence/response-builder.test.ts` - 21 tests
- `src/__tests__/persistence/persistence-manager.test.ts` - 10 tests
- `src/__tests__/analytics/response-analytics.test.ts` - 8 tests

Total: 39 tests covering all major functionality.

Run tests with:
```bash
npm test
```

## Integration

The persistence module integrates seamlessly with the existing storage layer:
- Uses `StorageService` for all file operations
- Leverages atomic writes and backups
- Compatible with session management
- Works with existing response validation

No breaking changes to existing APIs.

## Performance

- Auto-save is non-blocking and runs in background
- Failed auto-saves log warnings but don't interrupt user
- Progress calculations are O(n) where n = number of answers
- Analytics queries load responses on-demand
- Export operations stream data for large responses

## Future Enhancements

Potential improvements for future versions:
- PDF export format
- Real-time collaboration support
- Response comparison tools
- Advanced analytics (trends, correlations)
- Compression for large responses
- Encryption for sensitive data
