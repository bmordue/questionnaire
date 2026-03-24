# Web App Persistence Model Improvement Plan

**Created**: 2026-03-18  
**Status**: In Progress

## Overview

Transform the current TUI-focused file-based persistence into a web-ready system supporting **hosted questionnaire creation, answering, and reviewing** with **user accounts**, while retaining **enhanced file-based storage**.

### Key Requirements

- **Full web application** (backend + frontend)
- **Enhanced file-based storage** (no database migration)
- **User accounts** for authentication and authorization

---

## Phase 1: Storage Layer Abstraction (Foundation)

### 1.1 Repository Pattern Implementation
- Create `IQuestionnaireRepository` and `IResponseRepository` interfaces
- Extract current file operations into `FileQuestionnaireRepository` and `FileResponseRepository`
- Add concurrency primitives: file locks, atomic operations, read/write queues
- Implement optimistic locking with version tracking

### 1.2 Concurrency Controls
- Add file locking mechanism using `.lock` files with timeout
- Implement write queue for serializing concurrent writes
- Add retry logic with exponential backoff for lock contention
- Create `ConcurrencyError` and `LockTimeoutError` exception types

### 1.3 Transaction Support
- Implement unit-of-work pattern for multi-step operations
- Add rollback capability using existing backup system
- Create transaction logs for recovery after crashes

---

## Phase 2: User Account System

### 2.1 User Schema & Storage
- Define `User` schema (id, email, passwordHash, createdAt, updatedAt, role)
- Create `UserRepository` with file-based storage
- Implement password hashing (bcrypt/argon2)
- Add email uniqueness validation

### 2.2 Authentication Layer
- Session-based authentication with secure cookies
- `AuthService` with login/logout/register/passwordReset
- Rate limiting for login attempts
- Password reset token generation and validation

### 2.3 Authorization
- Role-based access control (admin, creator, respondent)
- Permission checks for questionnaire CRUD operations
- Ownership validation (users can only edit their own questionnaires)

---

## Phase 3: Web Session Management

### 3.1 Enhanced Session Model
- Extend `SessionData` with `userId`, `userAgent`, `ipAddress`
- Add session expiration and cleanup
- Support multiple concurrent sessions per user
- Track session activity for audit trail

### 3.2 Questionnaire State Management
- Real-time progress tracking per user session
- Conflict detection for concurrent edits (last-write-wins with warnings)
- Auto-save with debouncing for web clients
- Draft vs. published questionnaire states

---

## Phase 4: Web-Optimized Features

### 4.1 Questionnaire Creation (Web)
- Multi-user questionnaire collaboration (single editor at a time)
- Version history with diff tracking
- Draft preview before publishing
- Template system for reusable questionnaire structures

### 4.2 Questionnaire Answering (Web)
- Anonymous vs. authenticated response modes
- Response deduplication controls
- Partial response saving with resume capability
- Progress persistence across page refreshes

### 4.3 Response Review (Web)
- Response listing with filtering (by date, user, status)
- Individual response viewing with navigation
- Bulk export (JSON, CSV) per questionnaire
- Response analytics dashboard (completion rates, timing)

---

## Phase 5: API Layer Preparation

### 5.1 Request/Response Models
- Define DTOs for all web operations
- Input validation schemas (extend existing Zod schemas)
- Error response standardization

### 5.2 Service Layer Extraction
- Extract business logic from TUI runner into `QuestionnaireService`
- Create `ResponseService` for answer processing
- Build `ReviewService` for analytics and reporting

---

## File Structure Changes

```
src/
├── core/
│   ├── repositories/           # NEW: Repository interfaces & implementations
│   │   ├── interfaces.ts
│   │   ├── file-questionnaire-repository.ts
│   │   ├── file-response-repository.ts
│   │   └── file-user-repository.ts
│   ├── services/               # NEW: Business logic layer
│   │   ├── questionnaire-service.ts
│   │   ├── response-service.ts
│   │   ├── user-service.ts
│   │   └── auth-service.ts
│   ├── auth/                   # NEW: Authentication
│   │   ├── password-hasher.ts
│   │   ├── session-manager.ts
│   │   └── tokens.ts
│   ├── concurrency/            # NEW: Concurrency primitives
│   │   ├── file-lock.ts
│   │   ├── write-queue.ts
│   │   └── transaction.ts
│   └── storage/                # MODIFIED: Simplified to use repositories
├── web/                        # NEW: Web-specific code
│   ├── dtos/                   # Data transfer objects
│   ├── middleware/             # Auth, validation, error handling
│   └── utils/
└── ui/                         # EXISTING: TUI components (unchanged)
```

---

## Key Design Decisions

| Aspect | Decision | Rationale |
|--------|----------|-----------|
| Storage | Enhanced file-based | Meets requirements, minimal dependencies |
| Concurrency | File locks + write queue | Simple, works with file storage |
| Auth | Session-based with cookies | Simpler than JWT for single-server |
| Passwords | bcrypt | Industry standard, well-tested |
| Transactions | Unit-of-work with rollback | Adequate for file-based storage |
| API prep | Service layer extraction | Enables future Express/Fastify integration |

---

## Acceptance Criteria

- [x] Multiple users can create accounts and log in
- [ ] Users can create, edit, publish questionnaires via web (web UI for create/edit exists; publish/unpublish API implemented; frontend publish UI not yet wired up)
- [ ] Users can answer questionnaires with auto-save (web session-based answering exists; auto-save with debouncing not yet implemented)
- [ ] Users can review responses with filtering/export (listing + filter by questionnaire exists; per-questionnaire export and analytics API now implemented; CSV/JSON export routes added)
- [x] Concurrent writes are safely serialized
- [ ] Session state persists across page refreshes
- [x] All existing TUI functionality continues working
- [x] No database dependencies added

---

## Out of Scope (Future Phases)

- Real-time collaboration (WebSocket)
- Email notifications
- OAuth integration
- Multi-server deployment
- Advanced analytics/ML insights
- PDF export
- Mobile-responsive UI components

---

## Implementation Tasks

### Phase 1 Tasks
1. [x] Create repository interfaces (`IQuestionnaireRepository`, `IResponseRepository`, `ISessionRepository` defined in `src/core/repositories/interfaces.ts`; `IUserRepository` not yet defined)
2. [x] Implement `FileQuestionnaireRepository` with concurrency controls
3. [x] Implement `FileResponseRepository` with concurrency controls
4. [x] Implement `FileUserRepository` for user accounts
5. [x] Add concurrency primitives (file lock, write queue, transaction)

### Phase 2 Tasks
6. [x] Define User schema with Zod validation
7. [x] Implement password hashing service
8. [x] Create AuthService with login/logout/register
9. [x] Implement session-based authentication with cookies

### Phase 3 Tasks
10. [x] Extend SessionData with userId, userAgent, ipAddress
11. [x] Add session expiration and cleanup
12. [ ] Implement conflict detection for concurrent edits

### Phase 4 Tasks
13. [x] Create QuestionnaireService for CRUD operations
14. [x] Create ResponseService for answer processing
15. [x] Create ReviewService for analytics and reporting

### Phase 5 Tasks
16. [x] Define DTOs for web operations
17. [x] Extract business logic from TUI runner into services

### Testing & Integration
18. [ ] Update existing storage layer to use repositories
19. [x] Write tests for new repository implementations
20. [x] Write tests for authentication and session management

### Completed Outside Original Plan
- [x] Express web server (`src/web/server.ts`) with REST API for questionnaires, responses, and sessions
- [x] Frontend web UI (`src/web/public/`): questionnaire list, builder, runner, and responses pages
- [x] Response filtering by questionnaire in the web UI
- [x] Concurrency primitives: `src/core/concurrency/` (file-lock, write-queue, transaction)
- [x] File-based repository implementations: `FileQuestionnaireRepository`, `FileResponseRepository`, `FileUserRepository`
- [x] Auth layer: `SessionManager`, `AuthService`, password hashing, token utilities
- [x] Service layer: `QuestionnaireService`, `ResponseService`, `ReviewService`
- [x] DTOs for web operations: `src/web/dtos/`
- [x] Auth middleware: `src/web/middleware/` (auth guard, error handler)
- [x] Auth routes on the web server: `/api/auth/register`, `/api/auth/login`, `/api/auth/logout`, `/api/auth/me`, `/api/auth/change-password`
- [x] Review/analytics routes: `/api/questionnaires/:id/stats`, `/api/questionnaires/:id/summary`, `/api/questionnaires/:id/export`

---

## Dependencies

### New Dependencies Required

```json
{
  "dependencies": {
    "bcryptjs": "^2.4.3",
    "cookie": "^0.6.0",
    "cookie-signature": "^1.2.1"
  }
}
```

### Already Added (was previously optional)

```json
{
  "dependencies": {
    "express": "^5.2.1",
    "cors": "^2.8.6"
  }
}
```

---

## Migration Path

### Backward Compatibility

- Existing JSON response files remain readable
- TUI continues to work unchanged
- Session IDs maintain same format

### Gradual Rollout

1. Implement repository layer alongside existing storage
2. Migrate internal code to use repositories
3. Add user authentication layer
4. Build web API on top of services
5. Deprecate direct storage access

---

## Risk Mitigation

| Risk | Mitigation |
|------|------------|
| File lock deadlocks | Timeout + stale lock detection |
| Concurrent write corruption | Write queue serializes all writes |
| Password security | bcrypt with salt rounds >= 10 |
| Session hijacking | Secure cookies + CSRF tokens |
| Data loss | Atomic writes + backup system |

---

## Notes

- All existing tests must continue passing
- No breaking changes to public APIs
- Documentation must be updated for each phase
- Example applications should demonstrate new features
