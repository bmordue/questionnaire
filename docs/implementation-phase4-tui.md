# Phase 4 Task 1: Wire TUI Integration Layer

## Overview

Connect the individually-implemented subsystems — `QuestionnaireFlowEngine`, `ComponentFactory` (8 Inquirer-backed components), `PersistenceManager`, and `FileStorageService` — into a runnable application.

**Current implementation status (2026-03-19):** this wiring is now implemented via `src/runner.ts` (orchestrator) and `src/app.ts` (CLI entry point), with automated tests in `src/__tests__/runner/runner.test.ts`.

## Goals

- Create a single integration layer that connects flow engine, UI components, and persistence
- Enable a user to run a questionnaire from the command line with a single command
- Support resuming a previous session via a `--resume` flag
- Provide clear progress feedback after each question
- Handle errors gracefully with user-friendly terminal output
- Maintain zero new runtime dependencies

## Status (as of 2026-03-19)

**Implemented & verified (automated):**

- Runner orchestration exists (`src/runner.ts`) and drives a full question loop
- CLI entry point exists (`src/app.ts`) using `node:util.parseArgs`
- `start` and `start:dev` scripts exist in `package.json`
- Fixtures validate (`npm run validate`)
- Build and tests pass (`npm run build`, `npm test`)

**Still missing / not yet verified:**

- Dedicated unit tests for CLI argument parsing in `src/app.ts`
- Dedicated unit tests for SIGINT/SIGTERM behavior (runner currently handles signals, but tests don’t assert it)
- “0-question questionnaire exits 0” behavior is not realistically reachable because the schema enforces `questions: z.array(...).min(1)`

## Technical Approach

### 1. Architecture: Runner Module

The runner sits between the CLI entry point and the existing subsystems. It drives the question-answer loop, coordinating flow, rendering, and persistence.

```typescript
// src/runner.ts

export interface RunnerOptions {
  questionnairePath: string   // absolute or relative path to questionnaire JSON on disk
  sessionId?: string          // if provided, resume this session instead of starting fresh
  dataDirectory?: string      // storage root; defaults to './data'
}

export interface RunnerResult {
  sessionId: string
  responseId: string
  answeredCount: number
  skippedCount: number        // derived from FlowState.skippedQuestions.size after completion
  completed: boolean
}

export async function runQuestionnaire(options: RunnerOptions): Promise<RunnerResult>
```

### 2. Session Coordination Strategy

**Critical design constraint**: `QuestionnaireFlowEngine.start()` and `PersistenceManager.startSession()` each call `storage.createSession()` independently, producing two unrelated session records. The runner must use **one session-creation authority** and share that `sessionId` with both subsystems.

**Implemented approach (current): PersistenceManager is the session authority for both fresh + resume, and the FlowEngine is started with that `sessionId`:**

```
Fresh start:
  ① PersistenceManager.startSession(questionnaire)
      → gets sessionId + responseBuilder
  ② engine.start(questionnaire.id, { sessionId, initialResponses, skippedQuestions, currentQuestionId })
```

**Recommended approach for MVP simplicity** — bypass `QuestionnaireFlowEngine.start()` for the fresh path and instead:
- Let `PersistenceManager.startSession(questionnaire)` create the session and return `{ sessionId, responseBuilder }`
- Manually initialise the FlowEngine's state via `engine.loadState(session.sessionId)` for resume, or drive the engine loop differently for fresh start
- Use `NavigationManager` (which wraps `FlowEngine`) to avoid re-implementing `handleNext` logic inline

Resume:
  ① PersistenceManager.resumeSession(sessionId)
    → restores responseBuilder
  ② engine.loadState(sessionId)
    → if session state is missing/corrupt, runner falls back to `engine.start(..., { sessionId, initialResponses, ... })`

### 3. Recording & Persistence Strategy

`FlowEngine.recordResponse(questionId, answer)` does two things:
1. Updates `state.responses` Map (needed for conditional logic evaluation)
2. Calls `storage.loadResponse()` → `response.answers.push(...)` → `storage.saveResponse()` (raw append with no deduplication)

`ResponseBuilder.recordAnswer(questionId, answer)` upserts (deduplicates by `questionId`) before saving.

**Implemented approach (current): the FlowEngine is the persistence writer for answers**, and `ResponseBuilder` is kept in sync via `responseBuilder.refreshFromStorage()`.

- `NavigationManager.handleNavigation({ type: 'next', answer })` calls `FlowEngine.recordResponse()` which upserts the answer into the persisted response JSON.
- The runner calls `responseBuilder.refreshFromStorage()` after each step (and before completion) so resume/pre-population is based on the latest persisted response.

### 4. Question-Answer Loop (using NavigationManager)

`NavigationManager` already implements the record-then-advance pattern, backward navigation via `'previous'`, skipping via `'skip'`, and clean exit via `'exit'` (which calls `engine.saveState()`). Use it rather than reimplementing the loop inline.

```typescript
import { NavigationManager } from './core/flow/navigation-manager.js'

// After engine.start() / engine.loadState():
const navManager = new NavigationManager(engine)

while (true) {
  const question = engine.getCurrentQuestion()
  if (!question) break  // flow is complete

  // Guard: 0-question questionnaire
  if (!question) {
    console.log(MessageFormatter.formatWarning('This questionnaire has no questions.'))
    break
  }

  // Progress header
  const progress = engine.getProgress()
  displayProgressHeader(progress)

  // Retrieve prior answer (for resume pre-population)
  const priorAnswer = session.responseBuilder
    .getResponse()
    .answers.find(a => a.questionId === question.id)

  // Render the prompt
  const component = ComponentFactory.create(question)   // takes full Question object
  const answer = await component.render(question, priorAnswer?.value)

  // Advance via NavigationManager (also updates engine's in-memory state)
  const navResult = await navManager.handleNavigation({ type: 'next', answer })
  if (!navResult.success) {
    console.log(MessageFormatter.formatError(navResult.error ?? 'Navigation error'))
    break
  }

  if (navResult.result?.type === 'complete') break
}

  // Keep ResponseBuilder in sync with storage
  await session.responseBuilder.refreshFromStorage()
}

// Completion
await session.responseBuilder.refreshFromStorage()
await session.responseBuilder.complete()   // marks response status as completed
await persistenceManager.endSession()      // stops auto-save timer
```

### 5. CLI Entry Point

```typescript
// src/app.ts
import { parseArgs } from 'node:util'
import { existsSync } from 'node:fs'

const { values } = parseArgs({
  args: process.argv.slice(2),
  options: {
    questionnaire: { type: 'string', short: 'q' },
    resume:        { type: 'string', short: 'r' },
    data:          { type: 'string', short: 'd' },
    help:          { type: 'boolean', short: 'h' },
  }
})
```

Invocation (PowerShell / bash):
```bash
npm start -- --questionnaire fixtures/basic/simple-text-survey.json
npm start -- -q fixtures/advanced/customer-feedback.json --resume <sessionId>
```

> **Note (Windows CMD)**: The `--` separator works correctly with npm in PowerShell and bash.
> On Windows CMD, prefer `node dist/app.js --questionnaire <path>` directly after building.

### 6. UX Decisions

These decisions must be explicit so the implementing developer does not invent behaviour:

| Scenario | Specified behaviour |
|---|---|
| Question skipped by conditional logic | Silent — no message to user. Progress counter jumps (e.g. "3 of ~8") |
| Progress total with conditional branching | Display `~N` (approximate) rather than a firm total to avoid confusion |
| Resume: where to start | Jump to the **first unanswered question** (not restart from question 1) |
| Completion summary | Show: questionnaire title, number of answers recorded, save path in `./data/responses/` |
| 0-question questionnaire | Show a warning and exit cleanly with code `0` |
| Resuming a completed session | Print a notice that the session is already complete and show save path; exit `0` |

### 7. Progress Display Format

```
──────────────────────────────────────────
 Question 3 of ~8  [■■■░░░░░░░]  37%
──────────────────────────────────────────
```

Use ASCII-only bar characters (`■`, `░`) — compatible with Windows CMD and Windows Terminal.

### 8. File Structure

```
src/
├── app.ts           # CLI entry point
├── runner.ts        # New: integration orchestrator
src/__tests__/
└── runner/runner.test.ts   # Integration tests
```

## Implementation Tasks

### Task 1.1: Validate Fixture Compatibility (30 minutes)

- [x] Load each file in `fixtures/basic/`, `fixtures/advanced/`, and `fixtures/edge-cases/` through `safeValidateQuestionnaire()`
- [x] Check whether the `config` field is optional in `QuestionnaireSchema`
- [x] Record any other divergences (none found; `npm run validate` reports all fixtures valid)

> This task runs in parallel with Task 1.2 — it is not a prerequisite gate.

### Task 1.2: Create `src/runner.ts` — Initialisation (2 hours)

- [x] Read questionnaire JSON from disk with `fs/promises.readFile()` and `JSON.parse()`; wrap in try/catch for ENOENT and JSON parse errors
- [x] Validate with `safeValidateQuestionnaire()` and format Zod errors (current code uses `formatZodError()`)
- [x] Instantiate `FileStorageService` with the `dataDirectory` option (default `'./data'`)
- [x] Call `storage.initialize()` if the method exists; create `./data/` subdirectories
- [x] **Save questionnaire to storage first** via `storage.saveQuestionnaire(questionnaire)`
- [x] Call `initializeComponents()` to register all components
- [x] Implement start vs resume branching:
  - Fresh: `await persistenceManager.startSession(questionnaire)` → returns `{ sessionId, responseBuilder }`; then initialise FlowEngine from that same session
  - Resume: `await persistenceManager.resumeSession(sessionId)` + `await engine.loadState(sessionId)` using the **same** `sessionId`

### Task 1.3: Implement Question-Answer Loop (5 hours)

> *Estimate revised from 3h: session coordination, `SIGINT` handling, and resume pre-population add meaningful complexity.*

- [x] Instantiate `NavigationManager` wrapping `FlowEngine`
- [x] Implement the loop using `NavigationManager.handleNavigation()`
- [x] Retrieve the prior answer for pre-population via `session.responseBuilder.getResponse().answers.find(a => a.questionId === question.id)?.value`
- [x] Call `ComponentFactory.create(question)` passing the **full `Question` object**
- [x] Persist answers (current implementation persists via `FlowEngine.recordResponse()`; runner then keeps `ResponseBuilder` in sync via `refreshFromStorage()`)
- [x] Display progress using `displayProgressHeader()`
- [x] Register `SIGINT` handler: save state, end session, print resume hint (runner throws `QuestionnaireInterruptedError`; CLI exits `0`)
- [x] Register `SIGTERM` handler: same logic as `SIGINT`
- [x] Handle Inquirer's `ExitPromptError` as equivalent to `SIGINT`
- [x] On loop exit (complete): `responseBuilder.complete()` then `persistenceManager.endSession()`; print completion summary
- [ ] Guard for 0-question questionnaire before entering the loop (unreachable with current schema: `questions.min(1)`)

### Task 1.4: Populate `src/app.ts` (1 hour)

- [x] Parse CLI arguments with Node's built-in `parseArgs` — no new dependencies
- [x] Validate that `--questionnaire` is provided and the file exists before calling the runner
- [x] Print `--help` text and exit `0` if `-h` / `--help` is passed or if `--questionnaire` is missing
- [x] Guard `--resume` without a value (handled via `parseArgs` try/catch)
- [x] Pass `--data` to `RunnerOptions.dataDirectory`
- [x] Call `runQuestionnaire(options)` and await
- [x] Catch all errors with `MessageFormatter.formatError()` and exit `1`

### Task 1.5: Add Scripts to `package.json` (15 minutes)

- [x] Add `"start": "npm run build && node dist/app.js"` — rebuilds then runs
- [x] Add `"start:dev": "node dist/app.js"` — runs last build directly
- [x] Update the scripts README comment to show both invocation patterns

### Task 1.6: Write Tests (2 hours)

- [x] **Runner initialisation**: valid path succeeds; missing file / invalid JSON / schema validation failure throw (see `src/__tests__/runner/runner.test.ts`)
- [ ] **Session branching**: add coverage for unknown/corrupt `--resume` falling back to fresh start with a warning
- [ ] **Question-answer loop assertions**: current integration test asserts answers persisted + prompt count; does not assert `NavigationManager`/signal paths explicitly
- [ ] **Resume pre-population**: add test ensuring prior answers are passed as defaults to `component.render()`
- [ ] **SIGINT handling**: add test for SIGINT/SIGTERM exit-save behavior
- [ ] **CLI arg parsing**: add tests for `src/app.ts` edge cases
- [x] **Integration smoke test**: runner test persists a full response file under a temp `dataDirectory`

## Detailed Error Handling Contract

| Condition | Behaviour |
|---|---|
| `--questionnaire` not provided | Print help text; exit `1` |
| File does not exist on disk (ENOENT) | `formatError()` with path; exit `1` |
| File permission denied (EACCES) | `formatError()` with path and error code; exit `1` |
| File is not valid JSON | `formatError()` with parse message; exit `1` |
| Schema validation fails | `formatError()` listing each Zod error; exit `1` |
| stdin is not a TTY (CI/piped) | `formatError('Interactive mode requires a TTY terminal')`; exit `1` |
| `--resume <id>` session not found | Warn with `formatWarning()`; start fresh session instead |
| `--resume <id>` session file exists but is corrupt | Warn; start fresh session |
| Resuming an already-completed session | Print `formatSuccess()` with prior save path; exit `0` (do not re-run) |
| `--resume` flag provided without a value | `formatError('--resume requires a session ID value')`; exit `1` |
| 0-question questionnaire | Not reachable with current schema (`questions.min(1)`): this fails schema validation and exits `1` |
| Write failure during persistence (disk full, EACCES) | `formatError()` with OS error; exit `1` |
| `FlowEngine` throws `FlowError` | `formatError()` with `FlowError.code` and message; exit `1` |
| `Ctrl+C` / SIGINT | Save state via `NavigationManager.handleNavigation({ type: 'exit' })`; `formatMuted('Progress saved. Run with --resume <sessionId> to continue.')`; exit `0` |
| SIGTERM | Same as SIGINT |
| `ExitPromptError` from Inquirer | Same as SIGINT; import from `@inquirer/core` |

## Testing Requirements

### Unit Tests

- Runner initialisation: valid and each invalid file condition
- Session start vs resume branching
- Question-answer loop iteration with mock components
- Loop termination on `FlowResult.type === 'complete'`
- Resume pre-population of prior answers as component defaults
- Each error contract condition
- CLI argument parsing edge cases

### Integration Tests

- End-to-end against `fixtures/basic/simple-text-survey.json` with stubbed Inquirer auto-answers
- Resume: save mid-session state, reload process (re-instantiate runner), verify prior answers are pre-populated
- SIGINT: verify state is saved and process exits `0`
- Cross-fixture: run all files in `fixtures/basic/` through the runner

### Manual Verification

```bash
# PowerShell / bash
npm run build
npm start -- --questionnaire fixtures/basic/simple-text-survey.json

# Windows CMD (after build)
node dist/app.js --questionnaire fixtures/basic/simple-text-survey.json

# Resume
npm start -- -q fixtures/basic/simple-text-survey.json --resume <sessionId printed on Ctrl+C>
```

Expected: interactive prompts, progress display, completion summary, response file in `./data/responses/`.

## Acceptance Criteria

- [ ] `npm start -- --questionnaire fixtures/basic/simple-text-survey.json` completes without error (manual interactive verification pending)
- [x] All 8 question types have component-level prompt coverage via unit tests (interactive manual verification pending)
- [x] Progress header is displayed before each question (covered by runner test output)
- [x] Response file is written under `./data/responses/` on completion (covered by runner integration test)
- [x] Completion summary displays questionnaire title, answer count, and save path (covered by runner integration test output)
- [x] `--resume <sessionId>` resumes an already-completed session without prompting again (covered by runner test)
- [ ] `--resume <sessionId>` resumes mid-session at the first unanswered question (no direct test yet)
- [ ] `Ctrl+C` saves state and exits with code `0` and a resume hint (not covered by tests yet)
- [ ] SIGTERM saves state identically to `Ctrl+C` (not covered by tests yet)
- [ ] Running against a non-TTY stdin produces a clear error and exits `1` (not covered by tests yet)
- [x] Invalid file path, invalid JSON, or schema validation failure produce clear errors (covered by runner tests)
- [x] TypeScript build (`npm run build`) completes with no errors
- [x] All tests pass (`npm test`)

## Dependencies

- `QuestionnaireFlowEngine` + `NavigationManager` (Phase 2 Task 2) ✅
- `ComponentFactory` + all 8 question components (Phase 2 Task 1) ✅
- `initializeComponents()` from `src/ui/components/index.ts` (Phase 2 Task 1) ✅
- `PersistenceManager` + `ResponseBuilder` (Phase 2 Task 4) ✅
- `FileStorageService` (Phase 1) ✅
- `safeValidateQuestionnaire()` (Phase 1) ✅
- `MessageFormatter` + `theme` from `src/ui/components/display/theme.ts` (Phase 2 Task 1) ✅
- `ExitPromptError` from `@inquirer/core` (part of `inquirer` package already installed) ✅
- Node.js built-ins: `fs/promises`, `node:util.parseArgs`, `node:process` (no new runtime deps) ✅
