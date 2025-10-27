# Storage Module

The storage module provides a robust, file-based persistence layer for questionnaires, responses, and sessions.

## Features

- **Atomic writes** - All file operations use atomic writes with temporary files to prevent data corruption
- **Automatic backups** - Configurable backup system with automatic cleanup
- **Type safety** - Full TypeScript support with runtime validation using Zod
- **Error handling** - Comprehensive error handling with detailed error messages
- **Session management** - Track active questionnaire sessions with lifecycle management

## Architecture

### Directory Structure

```
data/
├── questionnaires/          # Questionnaire definitions
│   ├── {id}.json
│   └── {id}.backup.{timestamp}.json
├── responses/               # Response data
│   ├── {sessionId}.json
│   └── {sessionId}.backup.{timestamp}.json
└── sessions/                # Active sessions
    └── {sessionId}.json
```

## Usage

### Creating a Storage Service

```typescript
import { createStorageService } from './core/storage.js';

const storage = await createStorageService({
  dataDirectory: './data',
  backupEnabled: true,
  maxBackups: 5,
  compressionEnabled: false,
  encryptionEnabled: false
});
```

### Questionnaire Operations

```typescript
// Save a questionnaire
await storage.saveQuestionnaire(questionnaire);

// Load a questionnaire
const questionnaire = await storage.loadQuestionnaire('questionnaire-id');

// List all questionnaires
const questionnaires = await storage.listQuestionnaires();

// Delete a questionnaire
await storage.deleteQuestionnaire('questionnaire-id');
```

### Session Operations

```typescript
// Create a new session
const sessionId = await storage.createSession('questionnaire-id');

// Update session status
await storage.updateSession(sessionId, { status: 'completed' });

// Load session data
const session = await storage.loadSession(sessionId);

// List active sessions
const activeSessions = await storage.listActiveSessions();

// Delete a session
await storage.deleteSession(sessionId);
```

### Response Operations

```typescript
// Save a response
await storage.saveResponse(response);

// Load a response by session ID
const response = await storage.loadResponse(sessionId);

// List all responses
const allResponses = await storage.listResponses();

// List responses for a specific questionnaire
const responses = await storage.listResponses('questionnaire-id');

// Delete a response
await storage.deleteResponse(sessionId);
```

### Maintenance

```typescript
// Clean up old abandoned sessions
await storage.cleanup();

// Get data directory path
const dataDir = storage.getDataDirectory();

// Get current configuration
const config = storage.getConfig();
```

## Configuration

### StorageConfig

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `dataDirectory` | `string` | `'./data'` | Base directory for data storage |
| `backupEnabled` | `boolean` | `true` | Enable automatic backups on overwrites |
| `maxBackups` | `number` | `5` | Maximum backup files to keep per document |
| `compressionEnabled` | `boolean` | `false` | Enable compression (not implemented) |
| `encryptionEnabled` | `boolean` | `false` | Enable encryption (not implemented) |

## Data Integrity

### Atomic Writes

All write operations use a two-phase commit:
1. Write to temporary file
2. Atomic rename to final location

This ensures that files are never partially written, even if the process crashes mid-write.

### Backup System

When `backupEnabled` is `true`:
- A backup is created before overwriting existing files
- Backups are named with timestamps: `{id}.backup.{timestamp}.json`
- Old backups are automatically cleaned up when `maxBackups` limit is reached
- Most recent backups are kept

### Error Handling

All operations throw `FileOperationError` with detailed context:
- Operation that failed
- File path involved
- Original error cause

```typescript
try {
  await storage.loadQuestionnaire('missing-id');
} catch (error) {
  if (error instanceof FileOperationError) {
    console.error(`Failed to ${error.operation}: ${error.message}`);
    console.error(`File: ${error.filePath}`);
  }
}
```

## Session Lifecycle

1. **Create** - `createSession()` generates a unique session ID, creates an initial response, and stores session metadata
2. **Active** - Session status is 'active', response can be updated as user answers questions
3. **Complete** - Update session status to 'completed' when all questions are answered
4. **Cleanup** - Old abandoned sessions are automatically cleaned up by `cleanup()`

## Session Data

```typescript
interface SessionData {
  sessionId: string;
  questionnaireId: string;
  responseId: string;
  createdAt: string;
  updatedAt: string;
  status: 'active' | 'completed' | 'abandoned';
  metadata?: Record<string, any>;
}
```

## Performance

- **Lazy initialization** - Storage service only creates directories when first needed
- **Efficient JSON parsing** - Uses native JSON.parse/stringify
- **No caching** - Always reads from disk for data integrity (can be added if needed)
- **Concurrent safe** - Atomic operations prevent race conditions

## Testing

The storage module has comprehensive test coverage (>84%):
- Unit tests for all file operations
- Integration tests for full storage workflows
- Error scenario testing
- Concurrent access testing

Run tests with:
```bash
npm test
```

Check coverage with:
```bash
npm test -- --coverage
```

## Example

See `src/storage-example.ts` for a complete working example demonstrating all storage operations.

Run with:
```bash
npm run build && node dist/storage-example.js
```

## Implementation Details

### Modules

- `storage.ts` - Main storage service implementation
- `storage/types.ts` - TypeScript interfaces and types
- `storage/file-operations.ts` - Low-level atomic file operations
- `storage/questionnaire-store.ts` - Questionnaire-specific operations
- `storage/response-store.ts` - Response-specific operations
- `storage/session-store.ts` - Session-specific operations

### Dependencies

- `fs/promises` - Asynchronous file operations
- `path` - Path manipulation
- `crypto` - Random session ID generation
- `zod` - Runtime validation (from schema module)

No external dependencies beyond Node.js built-ins.
