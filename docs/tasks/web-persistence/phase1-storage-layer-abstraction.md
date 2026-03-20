# Phase 1: Storage Layer Abstraction

**Status**: Not Started  
**Estimated Effort**: 3-4 days  
**Dependencies**: None (Foundation phase)

## Overview

Create a repository pattern abstraction over file-based storage with concurrency controls. This phase establishes the foundation for all subsequent web persistence work.

---

## Objectives

1. Abstract current file operations behind repository interfaces
2. Add concurrency primitives for safe multi-user access
3. Implement transaction support for multi-step operations

---

## 1.1 Repository Pattern Implementation

### Interface Definitions

Create `src/core/repositories/interfaces.ts`:

```typescript
export interface IQuestionnaireRepository {
  findById(id: string): Promise<Questionnaire | null>;
  findAll(): Promise<Questionnaire[]>;
  findByUserId(userId: string): Promise<Questionnaire[]>;
  create(questionnaire: Questionnaire): Promise<Questionnaire>;
  update(id: string, questionnaire: Partial<Questionnaire>): Promise<Questionnaire>;
  delete(id: string): Promise<void>;
  exists(id: string): Promise<boolean>;
}

export interface IResponseRepository {
  findById(id: string): Promise<QuestionnaireResponse | null>;
  findByQuestionnaireId(questionnaireId: string): Promise<QuestionnaireResponse[]>;
  findBySessionId(sessionId: string): Promise<QuestionnaireResponse | null>;
  create(response: QuestionnaireResponse): Promise<QuestionnaireResponse>;
  update(id: string, response: Partial<QuestionnaireResponse>): Promise<QuestionnaireResponse>;
  delete(id: string): Promise<void>;
}

export interface IUserRepository {
  findById(id: string): Promise<User | null>;
  findByEmail(email: string): Promise<User | null>;
  create(user: User): Promise<User>;
  update(id: string, user: Partial<User>): Promise<User>;
  delete(id: string): Promise<void>;
  emailExists(email: string): Promise<boolean>;
}
```

### File Repository Implementations

Extract current file operations into concrete implementations:

- `FileQuestionnaireRepository` - wraps existing questionnaire storage
- `FileResponseRepository` - wraps existing response storage
- `FileUserRepository` - new implementation for user accounts

Each implementation should:
- Use the existing `data/` directory structure
- Maintain backward compatibility with existing JSON files
- Add version tracking for optimistic locking

---

## 1.2 Concurrency Controls

### File Locking Mechanism

Create `src/core/concurrency/file-lock.ts`:

```typescript
export interface FileLock {
  acquire(resource: string, timeout?: number): Promise<LockHandle>;
  release(handle: LockHandle): Promise<void>;
  isLocked(resource: string): Promise<boolean>;
}

export interface LockHandle {
  resource: string;
  lockId: string;
  acquiredAt: number;
  expiresAt: number;
}
```

Implementation details:
- Use `.lock` files with JSON content (lockId, timestamp, holder)
- Default timeout: 5 seconds
- Stale lock detection: locks older than 30 seconds are considered abandoned
- Lock files stored in `data/.locks/` directory

### Write Queue

Create `src/core/concurrency/write-queue.ts`:

```typescript
export interface WriteQueue {
  enqueue<T>(operation: () => Promise<T>): Promise<T>;
  flush(): Promise<void>;
  pending(): number;
}
```

Implementation:
- FIFO queue for serializing write operations
- Per-resource queues (not global) for better parallelism
- Timeout for queued operations (30 seconds default)

### Error Types

Create `src/core/concurrency/errors.ts`:

```typescript
export class ConcurrencyError extends Error {
  constructor(message: string, public resource: string) {
    super(message);
    this.name = 'ConcurrencyError';
  }
}

export class LockTimeoutError extends ConcurrencyError {
  constructor(resource: string, timeout: number) {
    super(`Failed to acquire lock for ${resource} within ${timeout}ms`, resource);
    this.name = 'LockTimeoutError';
  }
}

export class OptimisticLockError extends ConcurrencyError {
  constructor(resource: string, expectedVersion: number, actualVersion: number) {
    super(`Version conflict for ${resource}: expected ${expectedVersion}, got ${actualVersion}`, resource);
    this.name = 'OptimisticLockError';
  }
}
```

### Retry Logic

Implement exponential backoff for lock contention:

```typescript
export interface RetryConfig {
  maxAttempts: number;      // default: 3
  baseDelay: number;        // default: 100ms
  maxDelay: number;         // default: 2000ms
  backoffMultiplier: number; // default: 2
}
```

---

## 1.3 Transaction Support

### Unit of Work Pattern

Create `src/core/concurrency/transaction.ts`:

```typescript
export interface Transaction {
  begin(): Promise<void>;
  commit(): Promise<void>;
  rollback(): Promise<void>;
  isActive(): boolean;
}

export interface UnitOfWork {
  registerNew<T>(entity: T, repository: string): void;
  registerDirty<T>(entity: T, repository: string): void;
  registerDeleted(id: string, repository: string): void;
  commit(): Promise<void>;
  rollback(): Promise<void>;
}
```

Implementation:
- Track all changes in memory during transaction
- On commit: write all changes atomically (using file locks)
- On rollback: discard in-memory changes
- Use existing backup system for recovery after partial failure

### Transaction Log

Create transaction logs for crash recovery:

```typescript
interface TransactionLog {
  transactionId: string;
  startedAt: number;
  operations: TransactionOperation[];
  status: 'pending' | 'committed' | 'rolled_back';
}

interface TransactionOperation {
  type: 'create' | 'update' | 'delete';
  repository: string;
  entityId: string;
  beforeState: unknown;
  afterState: unknown;
}
```

Storage: `data/.transactions/` directory with JSON files per transaction.

---

## File Structure

```
src/core/
├── repositories/
│   ├── interfaces.ts           # Repository interfaces
│   ├── file-questionnaire-repository.ts
│   ├── file-response-repository.ts
│   └── file-user-repository.ts
├── concurrency/
│   ├── file-lock.ts            # File locking mechanism
│   ├── write-queue.ts          # Write serialization
│   ├── transaction.ts          # Unit of work pattern
│   ├── retry.ts                # Exponential backoff
│   └── errors.ts               # Concurrency error types
```

---

## Tasks

| Task ID | Description | Estimated Hours |
|---------|-------------|-----------------|
| 1.1.1 | Define repository interfaces | 2 |
| 1.1.2 | Implement FileQuestionnaireRepository | 4 |
| 1.1.3 | Implement FileResponseRepository | 4 |
| 1.1.4 | Implement FileUserRepository | 3 |
| 1.2.1 | Implement file locking mechanism | 4 |
| 1.2.2 | Implement write queue | 3 |
| 1.2.3 | Add retry logic with exponential backoff | 2 |
| 1.2.4 | Create concurrency error types | 1 |
| 1.3.1 | Implement unit of work pattern | 4 |
| 1.3.2 | Add transaction logging | 3 |
| 1.3.3 | Implement crash recovery | 3 |

**Total**: ~33 hours (3-4 days)

---

## Testing Requirements

### Unit Tests

- Repository CRUD operations
- File lock acquire/release
- Write queue ordering
- Transaction commit/rollback
- Error handling for lock timeout
- Optimistic lock conflict detection

### Integration Tests

- Concurrent read operations (should succeed)
- Concurrent write operations (should serialize)
- Transaction with multiple repositories
- Crash recovery from transaction log

### Test Fixtures

- Sample questionnaires for repository tests
- Lock file examples for concurrency tests
- Transaction logs for recovery tests

---

## Acceptance Criteria

- [ ] All repository interfaces defined and documented
- [ ] FileQuestionnaireRepository passes all CRUD tests
- [ ] FileResponseRepository passes all CRUD tests
- [ ] FileUserRepository passes all CRUD tests
- [ ] File locking prevents concurrent writes to same resource
- [ ] Write queue serializes concurrent write operations
- [ ] Transactions can commit or rollback atomically
- [ ] Crash recovery restores consistent state
- [ ] Existing TUI functionality continues working
- [ ] All existing tests pass

---

## Dependencies on Other Phases

This phase has no dependencies and must be completed before:
- Phase 2 (User Account System) - requires FileUserRepository
- Phase 3 (Web Session Management) - requires concurrency controls
- Phase 4 (Web-Optimized Features) - requires all repositories
- Phase 5 (API Layer Preparation) - requires service layer over repositories

---

## Notes

- Maintain backward compatibility with existing JSON file formats
- Do not add external dependencies for file locking (use native fs operations)
- Consider using `fs.promises` for all async file operations
- Lock files should be automatically cleaned up on process exit
