# Phase 3: Web Session Management

**Status**: Not Started  
**Estimated Effort**: 2-3 days  
**Dependencies**: Phase 1 (Concurrency), Phase 2 (Auth)

## Overview

Enhance the existing session model to support web-specific features including user binding, activity tracking, and questionnaire state management for concurrent editing.

---

## Objectives

1. Extend session data with web-specific fields
2. Add session lifecycle management (expiration, cleanup)
3. Implement questionnaire state management for web clients

---

## 3.1 Enhanced Session Model

### Extended Session Schema

Modify `src/core/schemas/session.ts`:

```typescript
export const WebSessionDataSchema = SessionDataSchema.extend({
  // User binding
  userId: z.string().uuid().optional(), // null for anonymous sessions
  
  // Client metadata
  userAgent: z.string().max(500).optional(),
  ipAddress: z.string().ip().optional(),
  
  // Activity tracking
  lastActivityAt: z.string().datetime(),
  activityCount: z.number().int().nonnegative().default(0),
  
  // Session lifecycle
  expiresAt: z.string().datetime(),
  isExpired: z.boolean().default(false),
  
  // Web-specific state
  csrfToken: z.string().optional(),
});

export type WebSessionData = z.infer<typeof WebSessionDataSchema>;
```

### Session Configuration

```typescript
export interface SessionConfig {
  // Expiration
  maxAge: number;              // default: 24 hours (86400000ms)
  idleTimeout: number;         // default: 30 minutes (1800000ms)
  absoluteTimeout: number;     // default: 7 days (604800000ms)
  
  // Security
  regenerateOnLogin: boolean;  // default: true
  regenerateOnPrivilegeChange: boolean; // default: true
  
  // Cleanup
  cleanupInterval: number;     // default: 1 hour
  maxSessionsPerUser: number;  // default: 5
}
```

### Session Expiration

Implement expiration logic:

```typescript
export interface SessionExpirationService {
  isExpired(session: WebSessionData): boolean;
  isIdle(session: WebSessionData, idleTimeout: number): boolean;
  shouldRegenerate(session: WebSessionData): boolean;
  extend(session: WebSessionData): WebSessionData;
}
```

### Session Cleanup

```typescript
export interface SessionCleanupService {
  cleanupExpiredSessions(): Promise<number>;
  cleanupIdleSessions(idleTimeout: number): Promise<number>;
  enforceMaxSessionsPerUser(userId: string, maxSessions: number): Promise<number>;
  scheduleCleanup(interval: number): void;
  stopScheduledCleanup(): void;
}
```

---

## 3.2 Multi-Session Support

### Concurrent Sessions

Allow users to have multiple active sessions:
- Track all sessions per user
- Enforce maximum sessions limit (oldest sessions revoked first)
- Support "logout from all devices" functionality

### Session Activity Audit

Create `src/core/storage/session-activity.ts`:

```typescript
export interface SessionActivity {
  sessionId: string;
  userId: string;
  action: SessionAction;
  timestamp: string;
  metadata?: Record<string, unknown>;
}

export type SessionAction = 
  | 'login'
  | 'logout'
  | 'timeout'
  | 'revoked'
  | 'regenerated'
  | 'activity';

export interface SessionActivityLog {
  recordActivity(activity: SessionActivity): Promise<void>;
  getActivityByUser(userId: string, limit?: number): Promise<SessionActivity[]>;
  getActivityBySession(sessionId: string): Promise<SessionActivity[]>;
}
```

Storage: `data/sessions/{sessionId}.activity.json` or embedded in session file.

---

## 3.3 Questionnaire State Management

### Draft vs Published States

```typescript
export const QuestionnaireStateSchema = z.enum([
  'draft',      // Being edited, not answerable
  'published',  // Available for responses
  'closed',     // No longer accepting responses
  'archived',   // Hidden from listings
]);

export type QuestionnaireState = z.infer<typeof QuestionnaireStateSchema>;
```

### Real-time Progress Tracking

Track response progress per session:

```typescript
export interface ResponseProgress {
  responseId: string;
  questionnaireId: string;
  sessionId: string;
  userId?: string;
  
  // Progress
  currentQuestionIndex: number;
  answeredQuestions: string[];
  skippedQuestions: string[];
  
  // Timing
  startedAt: string;
  lastAnsweredAt: string;
  estimatedTimeRemaining?: number;
  
  // Auto-save
  lastSavedAt: string;
  hasUnsavedChanges: boolean;
}
```

### Conflict Detection for Concurrent Edits

Create `src/core/concurrency/conflict-detection.ts`:

```typescript
export interface EditSession {
  questionnaireId: string;
  userId: string;
  sessionId: string;
  startedAt: string;
  lastActivityAt: string;
}

export interface ConflictDetectionService {
  startEditing(questionnaireId: string, userId: string, sessionId: string): Promise<EditSession | null>;
  stopEditing(questionnaireId: string, sessionId: string): Promise<void>;
  getCurrentEditor(questionnaireId: string): Promise<EditSession | null>;
  isBeingEdited(questionnaireId: string): Promise<boolean>;
  getStaleEditSessions(maxIdleMinutes: number): Promise<EditSession[]>;
}
```

Resolution strategy: **Last-write-wins with warnings**
- Check for concurrent edit session before saving
- Warn user if someone else is editing
- Allow save but notify about potential conflict
- Store conflict metadata for later review

### Auto-save with Debouncing

```typescript
export interface AutoSaveConfig {
  enabled: boolean;
  debounceMs: number;        // default: 2000ms
  maxDelayMs: number;        // default: 30000ms
  retryAttempts: number;     // default: 3
}

export interface AutoSaveService {
  scheduleAutoSave(responseId: string, data: Partial<QuestionnaireResponse>): void;
  cancelAutoSave(responseId: string): void;
  forceAutoSave(responseId: string): Promise<void>;
  getPendingAutoSaves(): string[];
}
```

---

## File Structure

```
src/core/
├── schemas/
│   └── session.ts              # Extended WebSessionDataSchema
├── storage/
│   └── session-activity.ts     # Activity logging
├── concurrency/
│   └── conflict-detection.ts   # Edit conflict handling
├── services/
│   ├── session-service.ts      # Session lifecycle management
│   └── auto-save-service.ts    # Auto-save orchestration
```

---

## Tasks

| Task ID | Description | Estimated Hours |
|---------|-------------|-----------------|
| 3.1.1 | Extend SessionData schema with web fields | 2 |
| 3.1.2 | Implement session expiration logic | 2 |
| 3.1.3 | Implement session cleanup service | 3 |
| 3.2.1 | Support multiple sessions per user | 2 |
| 3.2.2 | Implement session activity logging | 2 |
| 3.3.1 | Add questionnaire state (draft/published) | 2 |
| 3.3.2 | Implement response progress tracking | 3 |
| 3.3.3 | Implement conflict detection for edits | 3 |
| 3.3.4 | Implement auto-save service | 3 |

**Total**: ~22 hours (2-3 days)

---

## Testing Requirements

### Unit Tests

- Session expiration calculation
- Idle timeout detection
- Session extension logic
- Conflict detection state machine
- Auto-save debouncing

### Integration Tests

- Session cleanup with multiple expired sessions
- Max sessions per user enforcement
- Edit conflict detection with concurrent sessions
- Auto-save persistence

### Timing Tests

- Auto-save debounce behavior
- Idle timeout accuracy
- Cleanup interval execution

---

## Acceptance Criteria

- [ ] Sessions track userId, userAgent, ipAddress
- [ ] Sessions expire after configured timeout
- [ ] Idle sessions are cleaned up automatically
- [ ] Users can have multiple concurrent sessions
- [ ] Old sessions are revoked when max reached
- [ ] Session activity is logged for audit
- [ ] Questionnaires have draft/published state
- [ ] Edit conflicts are detected and warned
- [ ] Auto-save works with debouncing
- [ ] Progress persists across page refreshes
- [ ] All existing tests pass

---

## Notes

- Session cleanup should be idempotent (safe to run multiple times)
- Conflict detection uses optimistic approach (no locking)
- Auto-save should not block user interaction
- Consider WebSocket for real-time conflict notifications (future phase)
