# Lowy Review — Questionnaire Project

_Date: 2026-05-19_

---

## 1. Overview

The questionnaire project is a dual-mode Node.js/TypeScript application that delivers interactive questionnaires both through a terminal user interface (TUI) and an Express-based web API. It supports JSON-defined questionnaire schemas, persistent file-based (and optionally S3-backed) storage, proxy-delegated authentication, conditional question logic, and session resumption.

The codebase has grown significantly beyond the Phase 1 scope: a full web server, S3 backend, ACL system, analytics, backup, logging, and property-based tests are all present.

---

## 2. Strengths

### 2.1 Schema design

The Zod schema system is well-structured. Using a discriminated union (`z.discriminatedUnion('type', [...])`) for question types gives exhaustive type narrowing in consumers. Separating validation schemas per question type (e.g., `TextValidationSchema`, `RatingValidationSchema`) avoids a single monolithic validation object and is easy to extend.

### 2.2 Authentication model

Delegating authentication to Authelia/nginx forward-auth is a sound architectural choice for a self-hosted application. The service correctly treats identity headers as trusted only after the proxy strips and re-injects them. The documentation in `docs/auth.md` is thorough, covering deployment topology, nginx configuration, threat model, and local development workflow. This is the strongest area of operational documentation in the project.

### 2.3 Concurrency

The `WriteQueue` class (`src/core/concurrency/write-queue.ts`) correctly serialises concurrent file writes per resource key without heavy locking primitives. The post-loop re-entrancy check guards against tasks that arrive between the last dequeue and the `running.delete()` call.

### 2.4 Testing breadth

With 48 test files spanning unit tests, integration tests, property-based tests (`fast-check`), E2E tests, and mutation testing (`stryker`), the project has unusual testing ambition for its size. Property-based tests for schemas and permissions are particularly valuable.

### 2.5 Progressive enhancement for S3

The `RetryableStorageBackend` wrapper adds exponential backoff atop any `StorageBackend`, and the factory centralises backend selection. This makes swapping storage implementations transparent to the rest of the application.

---

## 3. Concerns

### 3.1 Pervasive use of `any`

Several critical schema and type boundaries allow `any`:

| Location | Usage |
|---|---|
| `ConditionSchema.value` | `z.any().optional()` |
| `ConditionSchema.values` | `z.array(z.any()).optional()` |
| `AnswerSchema.value` | `z.any()` |
| `SessionData.state` | `any` |
| `FlowError.context` | `any` |
| `BaseQuestionSchema.metadata` | `z.record(z.string(), z.any())` |

The most consequential is `AnswerSchema.value: z.any()`. Answer values are the primary output of the application and flow into analytics, exports, and stored responses with no runtime type validation. A discriminated answer type keyed on the parent question type would be more correct, though it would require more schema complexity.

### 3.2 Weak response ID generation

`createResponse` in `src/core/schemas/response.ts` generates IDs with:

```typescript
id: `response-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`
```

`Math.random()` is not cryptographically random. On a server handling many concurrent sessions, collisions are unlikely but not impossible. `crypto.randomUUID()` (a Node.js built-in) would be safer and more idiomatic.

### 3.3 Silent error swallowing in auth middleware

In `loadUser`, any exception during user provisioning silently falls back to the guest identity:

```typescript
} catch {
  // Non-fatal: proceed as guest
  res.locals['user'] = GUEST_USER;
}
```

A failure in `userRepository.findOrCreate` (e.g., a disk write error) will cause an authenticated request to be silently demoted to guest, potentially denying access or exposing data the user should not see. At minimum, the error should be logged at warning level.

### 3.4 Non-null assertions on array access

In `src/runner.ts`:

```typescript
const startQuestionId = pending.question?.id ?? questionnaire.questions[0]!.id;
```

The `!` asserts that `questions[0]` exists. While `questionnaire.questions` has a `.min(1)` constraint in the schema, this is not enforced by the TypeScript type system at this point. The assertion is likely safe in practice but fragile — if the schema constraint were ever relaxed, this would become a silent runtime error.

### 3.5 Unimplemented `StorageConfig` fields

`StorageConfig` documents two capability flags that are explicitly not implemented:

```typescript
/** Enable compression (not implemented) */
compressionEnabled: boolean;
/** Enable encryption (not implemented) */
encryptionEnabled: boolean;
```

Including unimplemented config fields in a public interface is misleading. These should be removed or clearly marked as planned future work.

### 3.6 Logout URL path-traversal check

In `src/web/server.ts`, `validatedLogoutRedirect` checks for path traversal with:

```typescript
if (pathOnly.split('/').includes('..')) return null;
```

A URL-encoded `%2e%2e` traversal segment would pass this check. The check should use `decodeURIComponent` before splitting, or use the URL parser to normalise before validation.

### 3.7 Dual storage abstraction

There is a `src/core/storage.ts` (singular) alongside the `src/core/storage/` directory. The web server imports from both. This dual-layer storage abstraction creates confusion about which path is canonical. If `storage.ts` is a legacy shim, it should be labelled as such or migrated.

### 3.8 Path traversal in storage IDs

Storage operations accept `questionnaireId` and `sessionId` as path components. The presence of `src/__tests__/storage/path-traversal.test.ts` indicates this has been considered, but the mitigations should be audited end-to-end from HTTP parameter to file path.

### 3.9 Questionnaire listing does O(N) full loads

`GET /api/questionnaires` calls `storage.listQuestionnaires()` and then, for non-admin users, loads each questionnaire in full to evaluate permissions. This scales as O(N) storage reads and can become a bottleneck as questionnaire count grows, especially with an S3 backend where each load is a network call.

### 3.10 CORS wildcard configuration mismatch

In non-development environments, CORS allowlisting uses a literal `allowedOrigins.includes(origin)` check. If `CORS_ORIGINS=*`, requests still fail because `*` is treated as a literal entry rather than a wildcard policy.

---

## 4. Architectural observations

### 4.1 Dual TUI/web surface

Running both a TUI runner and a web server from the same codebase creates tension. The TUI path (`runner.ts`) manages sessions, persistence, and flow directly; the web path delegates to the same storage layer but through a different coordination model. The session lifecycle logic is not fully shared, so bugs fixed in one path may not be fixed in the other.

### 4.2 Permission model optionality risk

`ownerId` is optional for backwards compatibility. Any legacy questionnaire without an owner is effectively ownerless and access is controlled only by `permissions[]`. In the current API, create requests are gated by `requireAuth` and creation injects `ownerId: user.id`, so the §3.3 guest fallback causes authenticated requests to be denied rather than creating new ownerless questionnaires.

### 4.3 No request body size limit visible

The Express server accepts JSON request bodies. No explicit `express.json({ limit: '...' })` size cap is visible in the server setup. Without this, a malicious client could send a very large questionnaire payload and exhaust memory.

---

## 5. Documentation

The project has strong documentation in some areas (`docs/auth.md`, `src/core/README.md`) and weaker documentation in others. The implementation phase documents in `docs/` are planning artefacts that have not been updated to reflect the current state of the code. These should either be archived in `docs/completed/` or replaced with a single current-state architecture document.

---

## 6. Recommendations (priority order)

| # | Recommendation | Effort |
|---|---|---|
| 1 | Replace `Math.random()` IDs with `crypto.randomUUID()` | Low |
| 2 | Log (not swallow) errors in `loadUser` before falling back to guest | Low |
| 3 | Fix logout URL path-traversal check to decode before splitting | Low |
| 4 | Add `express.json({ limit: '1mb' })` or similar to the web server | Low |
| 5 | Reduce O(N) questionnaire listing loads by moving permission filtering to metadata/index level | Medium |
| 6 | Support `CORS_ORIGINS=*` as wildcard (or document explicit non-support) | Low |
| 7 | Remove or clearly mark unimplemented `StorageConfig` fields | Low |
| 8 | Consolidate `src/core/storage.ts` and `src/core/storage/` into one canonical path | Medium |
| 9 | Audit path-traversal mitigations end-to-end from HTTP parameter to file path | Medium |
| 10 | Replace `AnswerSchema.value: z.any()` with discriminated per-type answer schemas | High |
| 11 | Update or archive stale phase planning documents | Low |

---

## 7. Summary

This is a well-structured project with a thoughtful schema system, a secure proxy-delegated auth model, and good testing ambition. The main weaknesses are scattered `any` types that erode the benefit of Zod runtime validation (especially on answer values), a handful of low-effort security hygiene gaps (ID generation, error logging, request body limits), and a growing dual-abstraction layer in storage that should be rationalised. None of the issues are critical blockers, but addressing the priority-1 to priority-4 items would meaningfully reduce operational risk.
