# Phase 4 Task 1: Wire TUI Integration Layer

## Overview

Connect the individually-implemented subsystems — `QuestionnaireFlowEngine`, `ComponentFactory` (8 Inquirer-backed components), `PersistenceManager`, and `FileStorageService` — into a runnable application. Currently `src/app.ts` is empty and no file imports both the UI components and the flow engine together. This task creates the `src/runner.ts` orchestration module and populates `src/app.ts` as a CLI entry point, making it possible for a user to load a questionnaire template from a JSON file, answer questions interactively in the terminal, and have responses persisted to disk.

## Goals

- Create a single integration layer that connects flow engine, UI components, and persistence
- Enable a user to run a questionnaire from the command line with a single command
- Support resuming a previous session via a `--resume` flag
- Provide clear progress feedback after each question
- Handle errors gracefully with user-friendly terminal output
- Maintain zero new runtime dependencies

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

**Chosen approach — FlowEngine is session authority on fresh start; PersistenceManager.resumeSession() on resume:**

```
Fresh start:
  ① PersistenceManager.startSession(questionnaire)
      → calls createNewSession() → gets sessionId, creates response record, starts auto-save timer
      → returns { sessionId, responseBuilder, questionnaire }
  ② engine.loadState(session.sessionId)   ← ONLY if session already has flow state
     OR engine.start(questionnaireId) with a modified approach:
        Do NOT call engine.start() directly. Instead call engine with existing sessionId.
```

**Recommended approach for MVP simplicity** — bypass `QuestionnaireFlowEngine.start()` for the fresh path and instead:
- Let `PersistenceManager.startSession(questionnaire)` create the session and return `{ sessionId, responseBuilder }`
- Manually initialise the FlowEngine's state via `engine.loadState(session.sessionId)` for resume, or drive the engine loop differently for fresh start
- Use `NavigationManager` (which wraps `FlowEngine`) to avoid re-implementing `handleNext` logic inline

For the resume path, `PersistenceManager.resumeSession(sessionId)` restores the `ResponseBuilder` correctly; `FlowEngine.loadState(sessionId)` restores navigation position. Both calls agree on the same session.

### 3. Single Recording Authority: ResponseBuilder

`FlowEngine.recordResponse(questionId, answer)` does two things:
1. Updates `state.responses` Map (needed for conditional logic evaluation)
2. Calls `storage.loadResponse()` → `response.answers.push(...)` → `storage.saveResponse()` (raw append with no deduplication)

`ResponseBuilder.recordAnswer(questionId, answer)` upserts (deduplicates by `questionId`) before saving.

**Do not call both.** The runner should:
- Call `engine.recordResponse()` **only** to update the in-memory conditional logic state (if the engine provides a way to do so without triggering a storage write — see Task 1.3 notes)
- Call `session.responseBuilder.recordAnswer()` as the **sole persistence authority**

In practice, use `NavigationManager.handleNavigation({ type: 'next', answer })` which already calls `engine.recordResponse()`. Then additionally call `session.responseBuilder.recordAnswer()`. Accept that the engine's raw push to storage happens; rely on `ResponseBuilder` as the authoritative readable record for the resume path.

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

  // Record via ResponseBuilder (persistence authority)
  await session.responseBuilder.recordAnswer(question.id, answer, {
    timestamp: new Date().toISOString()   // AnswerMetadata.timestamp is string, not Date
  })

  // Advance via NavigationManager (also updates engine's in-memory state)
  const navResult = await navManager.handleNavigation({ type: 'next', answer })
  if (!navResult.success) {
    console.log(MessageFormatter.formatError(navResult.error ?? 'Navigation error'))
    break
  }

  if (navResult.result?.type === 'complete') break
}

// Completion
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
├── app.ts           # CLI entry point (to be populated)
├── runner.ts        # New: integration orchestrator
src/__tests__/
└── runner.test.ts   # New: integration tests
```

## Implementation Tasks

### Task 1.1: Validate Fixture Compatibility (30 minutes)

- [ ] Load each file in `fixtures/basic/`, `fixtures/advanced/`, and `fixtures/edge-cases/` through `safeValidateQuestionnaire()`
- [ ] Check whether the `config` field is optional in `QuestionnaireSchema` — if required, basic fixtures will fail (they have no `config` key); adjust schema or fixtures accordingly
- [ ] Record any other divergences; either fix fixtures or note as schema adjustments for Task 1.2

> This task runs in parallel with Task 1.2 — it is not a prerequisite gate.

### Task 1.2: Create `src/runner.ts` — Initialisation (2 hours)

- [ ] Read questionnaire JSON from disk with `fs/promises.readFile()` and `JSON.parse()`; wrap in try/catch for ENOENT and JSON parse errors
- [ ] Validate with `safeValidateQuestionnaire()` and format Zod errors with `formatZodErrors()` if validation fails
- [ ] Instantiate `FileStorageService` with the `dataDirectory` option (default `'./data'`)
- [ ] Call `storage.initialize()` if the method exists; create `./data/` subdirectories
- [ ] **Save questionnaire to storage first** via `storage.saveQuestionnaire(questionnaire)` — `FlowEngine.start()` calls `storage.loadQuestionnaire()` and will throw if the record does not exist
- [ ] Call `initializeComponents()` from `src/ui/components/index.ts` to register all 8 components
- [ ] Implement start vs resume branching:
  - Fresh: `await persistenceManager.startSession(questionnaire)` → returns `{ sessionId, responseBuilder }`; then initialise FlowEngine from that same session
  - Resume: `await persistenceManager.resumeSession(sessionId)` + `await engine.loadState(sessionId)` using the **same** `sessionId`

### Task 1.3: Implement Question-Answer Loop (5 hours)

> *Estimate revised from 3h: session coordination, `SIGINT` handling, and resume pre-population add meaningful complexity.*

- [ ] Instantiate `NavigationManager` wrapping `FlowEngine` — **do not re-implement** `handleNext` logic inline
- [ ] Implement the loop as shown in Section 4, using `NavigationManager.handleNavigation()`
- [ ] Retrieve the prior answer for pre-population via `session.responseBuilder.getResponse().answers.find(a => a.questionId === question.id)?.value`
- [ ] Call `ComponentFactory.create(question)` passing the **full `Question` object** (not `question.type`)
- [ ] Call `session.responseBuilder.recordAnswer(questionId, answer, { timestamp: new Date().toISOString() })`
- [ ] Display progress using `displayProgressHeader()` helper (see Section 7)
- [ ] Register `SIGINT` handler: on `Ctrl+C`, call `navManager.handleNavigation({ type: 'exit' })` (which calls `engine.saveState()`), then `persistenceManager.endSession()`, print a save confirmation, and `process.exit(0)`
- [ ] Register `SIGTERM` handler: same logic as `SIGINT`
- [ ] Handle Inquirer's `ExitPromptError` (import from `@inquirer/core`) as equivalent to `SIGINT`
- [ ] On loop exit (complete): call `session.responseBuilder.complete()` then `persistenceManager.endSession()`; print completion summary (title, answered count, save path)
- [ ] Guard for 0-question questionnaire before entering the loop

### Task 1.4: Populate `src/app.ts` (1 hour)

- [ ] Parse CLI arguments with Node's built-in `parseArgs` — no new dependencies
- [ ] Validate that `--questionnaire` is provided and the file exists (`fs.existsSync`) before calling the runner
- [ ] Print `--help` text and exit `0` if `-h` / `--help` is passed or if `--questionnaire` is missing
- [ ] Check that if `--resume` is provided, a value is also present (guard against `--resume` without a value causing a `parseArgs` throw)
- [ ] Pass `--data` to `RunnerOptions.dataDirectory`
- [ ] Call `runQuestionnaire(options)` from `runner.ts` and `await` the result
- [ ] Catch all errors with `MessageFormatter.formatError()` and exit `1`

### Task 1.5: Add Scripts to `package.json` (15 minutes)

- [ ] Add `"start": "npm run build && node dist/app.js"` — rebuilds then runs
- [ ] Add `"start:dev": "node dist/app.js"` — runs last build directly (for iterative testing)
- [ ] Update the scripts README comment to show both invocation patterns

### Task 1.6: Write Tests (2 hours)

- [ ] **Unit — runner initialisation**: valid questionnaire path → success; ENOENT path → error exit; invalid JSON → error exit; schema validation failure → error exit listing Zod errors
- [ ] **Unit — session branching**: fresh start creates one session; resume loads existing session; `--resume` with unknown ID falls back to fresh start with a warning
- [ ] **Unit — question-answer loop**: mock `ComponentFactory`, `NavigationManager`, and `ResponseBuilder`; verify loop iterates correct number of times; verify `responseBuilder.recordAnswer()` is called once per question; verify `responseBuilder.complete()` is called at end
- [ ] **Unit — resume pre-population**: when prior answers exist in response, verify they are passed as `currentAnswer` to `component.render()`
- [ ] **Unit — SIGINT handling**: emit `process.emit('SIGINT')`; verify `navManager.handleNavigation({ type: 'exit' })` is called and `process.exit(0)` fires
- [ ] **Unit — CLI arg parsing**: missing `--questionnaire` → help text + exit `1`; `--help` → exit `0`; `--resume` without value → error + exit `1`
- [ ] **Integration smoke test**: run against `fixtures/basic/simple-text-survey.json` with Inquirer stubbed to return hardcoded answers; verify a file appears in `./data/responses/`; verify the response JSON contains all answered questions

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
| 0-question questionnaire | `formatWarning('Questionnaire has no questions')`; exit `0` |
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

- [ ] `npm start -- --questionnaire fixtures/basic/simple-text-survey.json` completes without error
- [ ] All 8 question types display interactive Inquirer prompts correctly
- [ ] Progress (`Question N of ~T [bar] %`) is displayed before each question
- [ ] Response file is written to `./data/responses/` on completion
- [ ] Completion summary displays questionnaire title, answer count, and save path
- [ ] `--resume <sessionId>` restores prior answers as component defaults and resumes from the first unanswered question
- [ ] `Ctrl+C` saves state and exits with code `0` and a resume hint
- [ ] SIGTERM saves state identically to `Ctrl+C`
- [ ] Running against a non-TTY stdin produces a clear error and exits `1`
- [ ] Invalid file path, invalid JSON, or schema validation failure produce clear terminal output and exit `1`
- [ ] TypeScript build (`npm run build`) completes with no errors
- [ ] All new tests pass (`npm test`)

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
