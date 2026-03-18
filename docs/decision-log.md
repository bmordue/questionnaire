# Decision Log

This document tracks key architectural and design decisions made during the development of the questionnaire application.

## Decision Format

For each decision, we document:
- **Decision**: What was decided
- **Date**: When the decision was made
- **Context**: Why this decision was needed
- **Rationale**: The reasoning behind the decision
- **Status**: Current status (Proposed, Accepted, Superseded, Deprecated)
- **Consequences**: Expected outcomes and trade-offs

---

## Decisions

### ADR-001: Multiple Storage Backends Support

**Decision**: No - We will not support multiple storage backends

**Date**: 2025-10-27

**Context**: Decision needed on whether to abstract storage layer to support multiple backends (e.g., file system, database, cloud storage)

**Rationale**: 
- Simplicity over flexibility for initial implementation
- Single storage backend reduces complexity and maintenance overhead
- Can be revisited if requirements change in the future

**Status**: Accepted

**Consequences**: 
- Faster initial development
- Less complex codebase
- May require refactoring if storage requirements change

---

### ADR-002: User Authentication and Multi-tenancy

**Decision**: No - We will not implement user authentication or multi-tenancy

**Date**: 2025-10-27

**Context**: Decision needed on whether to support multiple users and tenant isolation

**Rationale**: 
- Current requirements don't indicate need for user management
- Reduces complexity significantly
- Faster time to market
- Can be added later if needed

**Status**: Accepted

**Consequences**: 
- Single-user or open-access application
- No user-specific data isolation
- Simpler security model
- May need significant refactoring to add later

---

### ADR-003: Response Encryption at Rest

**Decision**: No - Responses will not be encrypted at rest

**Date**: 2025-10-27

**Context**: Decision needed on whether to encrypt stored questionnaire responses

**Rationale**: 
- No sensitive personal data expected in questionnaire responses
- Reduces implementation complexity
- Avoids key management overhead
- Standard file system permissions provide basic protection

**Status**: Accepted

**Consequences**:
- Responses stored in plain text/JSON format
- Easier debugging and data inspection
- Simpler backup and recovery
- May need to revisit if sensitive data requirements emerge

---

### ADR-004: Backup File Cleanup on Session Completion

**Decision**: Yes - Delete backup files when a questionnaire session completes

**Date**: 2026-03-18

**Context**: User requested automatic deletion of backup files after completing a questionnaire run to clean up the workspace. The primary concerns were visual clutter and user confusion about `.backup.*` files.

**Rationale**:
- Users prefer a clean workspace after completing questionnaires
- Backup files during active sessions provide protection against corruption
- Once completed, responses are less likely to need recovery
- Feature is configurable (`deleteBackupsOnCompletion: true` by default)
- Cleanup only happens for COMPLETED sessions, not ABANDONED ones
- Errors are logged as warnings and don't block session completion

**Status**: Accepted

**Consequences**:
- Cleaner workspace after questionnaire completion
- Reduced user confusion about backup files
- Loss of recovery capability for completed responses if they become corrupted
- Users can disable the feature if they want to keep backups
- Minor performance improvement (fewer files in data directory)

**Implementation Details**:
- Cleanup triggered in `PersistenceManager.endSession()` when status is COMPLETED
- Deletes both response and questionnaire backup files
- Shows summary message: "Cleaned up X backup files"
- Respects `deleteBackupsOnCompletion` configuration option