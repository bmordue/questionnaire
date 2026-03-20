# Web App Persistence Model Improvement Plan

**Created**: 2026-03-18  
**Status**: Approved  
**Last Updated**: 2026-03-20

## Overview

Transform the current TUI-focused file-based persistence into a web-ready system supporting **hosted questionnaire creation, answering, and reviewing** with **user accounts**, while retaining **enhanced file-based storage**.

### Key Requirements

- **Full web application** (backend + frontend)
- **Enhanced file-based storage** (no database migration)
- **User accounts** for authentication and authorization

---

## Phase Summary

| Phase | Name | Est. Effort | Dependencies | Status |
|-------|------|-------------|--------------|--------|
| 1 | [Storage Layer Abstraction](phase1-storage-layer-abstraction.md) | 3-4 days | None | Not Started |
| 2 | [User Account System](phase2-user-account-system.md) | 3-4 days | Phase 1 | Not Started |
| 3 | [Web Session Management](phase3-web-session-management.md) | 2-3 days | Phase 1, 2 | Not Started |
| 4 | [Web-Optimized Features](phase4-web-optimized-features.md) | 4-5 days | Phase 1, 2, 3 | Not Started |
| 5 | [API Layer Preparation](phase5-api-layer-preparation.md) | 2-3 days | Phase 1, 2, 4 | Not Started |

**Total Estimated Effort**: 14-19 days

---

## Phase Dependency Graph

```
Phase 1 (Storage Layer Abstraction)
    │
    ├──────────────────────────────┐
    │                              │
    v                              v
Phase 2 (User Account System)   Phase 5 (API Layer)
    │                              │
    v                              │
Phase 3 (Web Session Management)   │
    │                              │
    v                              │
Phase 4 (Web-Optimized Features) <─┘
```

### Critical Path

Phase 1 -> Phase 2 -> Phase 3 -> Phase 4

Phase 5 can start after Phase 1 and Phase 2, running in parallel with Phase 3-4.

---

## Phase Objectives

### Phase 1: Storage Layer Abstraction
Repository pattern over file storage with concurrency controls. Foundation for all other phases.

### Phase 2: User Account System
User schema, password hashing, authentication, authorization. Enables multi-user access.

### Phase 3: Web Session Management
Extended sessions with user binding, expiration, and questionnaire state management for web clients.

### Phase 4: Web-Optimized Features
Questionnaire creation, answering, and review via web. Core application functionality.

### Phase 5: API Layer Preparation
DTOs, service layer extraction, error standardization. Prepares for web framework integration.

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

## Acceptance Criteria

- [ ] Multiple users can create accounts and log in
- [ ] Users can create, edit, publish questionnaires via web
- [ ] Users can answer questionnaires with auto-save
- [ ] Users can review responses with filtering/export
- [ ] Concurrent writes are safely serialized
- [ ] Session state persists across page refreshes
- [ ] All existing TUI functionality continues working
- [ ] No database dependencies added

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

### Optional (for future web framework)

```json
{
  "dependencies": {
    "express": "^4.18.2",
    "cors": "^2.8.5"
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

## Out of Scope (Future Phases)

- Real-time collaboration (WebSocket)
- Email notifications
- OAuth integration
- Multi-server deployment
- Advanced analytics/ML insights
- PDF export
- Mobile-responsive UI components

---

## Notes

- All existing tests must continue passing
- No breaking changes to public APIs
- Documentation must be updated for each phase
- Example applications should demonstrate new features
- See individual phase documents for detailed implementation tasks
