# Rich Hickey Architecture Review

> Reviewed through the lens of simplicity, data orientation, and functional design.

---

## Complecting Found

### 1. `ResponseBuilder` braids mutation, I/O, and progress calculation

**File:** `src/core/persistence/response-builder.ts` lines 41–111

`recordAnswer`, `skipQuestion`, and `updateAnswer` each do three distinct things inside a single method call: mutate the in-memory response object (`this.response.answers[existingIndex] = ...`), recalculate aggregate progress (`this.updateProgress()`), and flush to persistent storage (`await this.saveIncremental()`). These are three independent concerns — *what the answer is*, *what progress looks like now*, and *when to write to disk* — woven together inseparably. The result is that none of the three can be tested, replaced, or reasoned about in isolation.

Separation: a pure function `applyAnswer(response, answer) → response` produces a new value; a separate pure function `computeProgress(response, questionnaire) → progress` derives progress from that value; and a thin I/O wrapper decides when to save. The class can then become an orchestrator over these pure functions.

### 2. `FlowEngine.recordResponse` duplicates `ResponseBuilder.recordAnswer` — two independent answer stores

**File:** `src/core/flow/flow-engine.ts` lines 251–293; `src/core/persistence/response-builder.ts` lines 41–76

`QuestionnaireFlowEngine` maintains its own in-memory `this.state.responses` (`Map<string, any>`) and additionally implements its own answer-writing path in `recordResponse`: it loads the stored response from disk, mutates `response.answers`, recalculates `answeredCount`, `skippedCount`, and `percentComplete`, then saves back to storage — the exact same three-step mutation+progress+persistence braid already identified in `ResponseBuilder`. The two classes independently track the same state.

Synchronisation between them is manual: `runner.ts` lines 225–230 builds the initial Map from a `ResponseBuilder` snapshot at startup; `runner.ts` line 330 calls `session.responseBuilder.refreshFromStorage()` after every `navManager.handleNavigation()`. If `refreshFromStorage()` is skipped or silently fails (its error is swallowed with a `logger.warn` at `response-builder.ts` lines 194–199), the two copies silently diverge and `complete()` finalises stale data.

This is not a testability smell — it is a latent data-integrity bug. Separation: `NavigationManager → FlowEngine` should record only navigation state (which question we are on, visited/skipped sets); all answer persistence should be the sole responsibility of `ResponseBuilder`.

### 3. `runQuestionnaire` in `runner.ts` braids signal handling, UI, flow, and persistence

**File:** `src/runner.ts` lines 165–362

This single async function sets up SIGINT/SIGTERM handlers (OS coordination), renders progress UI (`displayProgressHeader`), drives navigation (`navManager.handleNavigation`), records answers (`session.responseBuilder`), and performs storage operations. Five independent concerns with independent lifecycles are braided into one 200-line function. The signal handler itself (lines 283–300) spawns async work that mutates external state from within a callback closure — the worst form of complecting: temporal logic (signals arriving at unknown times) mixed with business state.

Separation: signal handling should be a thin shell that communicates intent via a channel or cancellation token; the inner loop should be a pure step function `(state, answer) → nextState`; persistence and UI should be invoked from the outermost layer. The current interrupt handler is also reachable from two concurrent code paths — the SIGINT/SIGTERM handlers (lines 295–300) and the `ExitPromptError` catch block (lines 353–355) — with no guard against near-simultaneous execution. `cleanupSignals()` in the `finally` block mitigates signal re-entrancy but not signal-plus-ExitPromptError overlap.

### 4. `resolvePermission` reads `process.env` inside a domain function

**File:** `src/core/schemas/questionnaire.ts` lines 89–101

`resolvePermission` is framed as a pure domain rule — given a questionnaire and a user, produce a permission level — yet it reads `process.env['ADMIN_GROUP']` at call time (line 94). The admin group name is a deployment-time configuration value, not a function of the questionnaire or the user. This complects policy (what counts as admin) with mechanism (how to look it up) and makes the function non-deterministic from a testing perspective: the same arguments produce different results in different environments.

Separation: pass `adminGroup` as an explicit parameter with a default, or provide it at construction time if `resolvePermission` becomes a method.

### 5. `createResponse` complects identity generation with data construction

**File:** `src/core/schemas/response.ts` lines 88–114

`createResponse` builds a plain data structure, but bakes in `Date.now()` and `Math.random()` for ID generation (line 97) and `new Date().toISOString()` for timestamp (line 94). These are side effects (reads of non-deterministic system state) interleaved with what should be a pure construction of a value. The caller cannot control the ID, cannot reproduce the same response in a test, and cannot substitute a different ID strategy.

Separation: accept `id` and `startedAt` as parameters; let the caller (who owns I/O) supply them. The function then becomes a pure data constructor.

### 6. `QuestionnaireFlowEngine` complects questionnaire data, navigation state, and storage coordination

**File:** `src/core/flow/flow-engine.ts` lines 49–294

The engine holds `this.questionnaire` (loaded data), `this.state` (mutable navigation cursor), and `this.storage` (I/O dependency) as nullable private fields. Every method starts with `this.ensureLoaded()` to guard against the uninitialised state — a code smell that reveals that construction and initialisation are split. Data, computation, and I/O are braided into every navigation method (`next()` at lines 124–162 mutates `this.state` and calls `await this.saveState()` in the same operation).

Separation: `FlowState` should be a value passed into and returned from pure navigation functions; persistence should be at the boundary; the class should be a thin coordinator.

---

## Data Orientation

**Strengths:** The schema layer (`src/core/schemas/`) uses Zod to derive plain TypeScript types. `Questionnaire`, `Question`, `QuestionnaireResponse`, and `Answer` are all inert data records — serialisable, inspectable, and composable without method knowledge. This is the strongest part of the design.

**Weaknesses:**

- `ResponseBuilder` (`src/core/persistence/response-builder.ts` line 25) wraps `QuestionnaireResponse` in a class with hidden mutable state. `getResponse()` (line 183) returns `{ ...this.response }` — a shallow copy — so the top-level object is not aliased, but nested arrays such as `.answers` are still shared references. Callers who store the snapshot and then call `recordAnswer` will observe the snapshot's `.answers` array mutate unexpectedly.

- `QuestionnaireFlowEngine` hides `FlowState` behind a nullable private field. The state — which question we are on, the history, which questions are skipped — is not accessible as a plain data structure. Navigation history (`this.state!.questionHistory`) is a mutable `string[]` that is pushed/popped in place (lines 151–175) rather than being produced as a new value.

---

## Immutability

**`ResponseBuilder` mutates the response in-place throughout:**

```typescript
// response-builder.ts:54
this.response.answers[existingIndex] = { ... };

// response-builder.ts:150–155 (complete())
this.response.completedAt = now;
this.response.status = ResponseStatus.COMPLETED;
this.response.progress.percentComplete = 100;
```

Every mutation is mixed with I/O (`saveIncremental`, `saveResponse`), making it impossible to apply a logical update without a storage write.

**`FlowEngine` mutates navigation state in every step:**

```typescript
// flow-engine.ts:136
this.state!.visitedQuestions.add(currentQuestion.id);
// flow-engine.ts:143
this.state!.isCompleted = true;
// flow-engine.ts:175
this.state!.questionHistory.pop();
```

`Set.add()` and `Array.pop()` on shared state mean that there is no way to preview "what would the state be if I moved forward" without actually moving.

**`example.ts` demonstrates the mutation model as idiomatic:**

```typescript
// example.ts:123–131
response.answers.push({ ... });
response.progress.currentQuestionIndex = 1;
response.progress.answeredCount = 1;
```

The example, which is also the project's smoke test, shows that the canonical usage is direct mutation of validated data — teaching consumers that the plain data types are mutable by convention.

---

## Pure Functions

**`loadQuestionnaire` conflates file I/O, JSON parsing, and schema validation** (`runner.ts` lines 110–140). File reading, parsing, and validation are three separable concerns; extracting `parseQuestionnaire(text: string): Questionnaire` would yield a pure, testable function that can be exercised without touching the filesystem.

**`displayProgressHeader` conflates formatting computation and console output** (`runner.ts` lines 91–108). The progress bar string assembly is independent of the side effect of printing it. A pure `formatProgressHeader(progress: ProgressInfo): string` would be testable without capturing stdout.

**`formatCompletionSummary` accesses `z.any()` metadata** (`runner.ts` lines 142–154). `response.metadata?.title` reaches into an untyped bag. The function takes a typed `QuestionnaireResponse` but relies on an unvalidated convention within the `metadata` field.

**`isValidEmail` and `isValidDate`** (`src/core/schemas/validation.ts` lines 12–23) recreate Zod schema objects on every call. These are pure functions, but inefficient — the schema objects are stateless and could be module-level constants.

---

## State Management

**No clear functional core / stateful shell boundary.** The codebase has state in:

- `QuestionnaireFlowEngine` private fields (nullable, initialised lazily)
- `ResponseBuilder` private `this.response` (mutable value)
- `PersistenceManager` private `autoSaveTimer` and `currentBuilder` (`persistence-manager.ts` lines 35–36)
- Module-level singletons in `server.ts`: `const storage = createStorage()` and `const userRepository = new FileUserRepository(...)` at lines 149 and 153, initialised at import time

The module-level singleton initialisation in `server.ts` is the most concerning: storage and user repository are created eagerly at module load, making testing require module isolation tricks and making it impossible to configure the storage backend from outside the module.

`PersistenceManager`'s `autoSaveTimer` (`NodeJS.Timeout | null`, line 35) is stateful coordination logic that belongs in an I/O layer, not alongside the business logic of building responses.

---

## Naming

- **`PersistenceManager`** — "manager" names announce that the author did not know what the thing does. It is a session coordinator with auto-save. A name like `SessionCoordinator` or `ResponsePersister` would say what it is.
- **`QuestionnaireFlowEngine`** — "engine" is a mechanism metaphor. The thing is a questionnaire navigator. `QuestionnaireNavigator` would describe the domain concept.
- **`handleInterrupt`** (`runner.ts` line 283) — "handle" is a generic verb that reveals nothing. The function saves progress, ends the session, emits a message, and throws. `saveAndExit` or `abortWithProgress` would be more truthful.
- **`buildResponseMap` / `buildPersistedSkipped`** (`runner.ts` lines 41–63) — "build" is acceptable here; the functions clearly transform a response into index structures. These are well-named.
- **`ensureQuestionnaireFileExists`** (`runner.ts` line 156) — the name implies a precondition check, but the same error (`ENOENT`) is also handled inside `loadQuestionnaire`. Having two functions with overlapping responsibility around the same error makes the name misleading.
- **`createStorage`** (`server.ts` line 107) — this is a factory that selects between two backends based on environment configuration. `selectStorageBackend` or `configureStorage` would better signal that it reads configuration.

---

## Simplicity

**`ValidationRuleSchema`** (`src/core/schemas/question.ts` lines 21–25) is defined and exported but referenced by no question schema. It is dead code that implies a design that was not carried through.

**`evaluationCache` in `ConditionalLogicEngine`** (`src/core/flow/conditional-logic.ts` line 57) is declared and can be cleared via `clearCache()` (line 66), but is never written to or read from anywhere in the engine. The `evaluateCondition` method (lines 73–166) goes directly to a `switch` statement; the cache is never consulted. It is dead state: it accumulates nothing and changes no behaviour.

**`BooleanQuestionSchema.validation: z.object({}).optional()`** (`question.ts` line 185) — an optional empty object adds nothing. Either boolean questions have validation rules (define them) or they do not (remove the field entirely).

**`schema.ts` double-exports** (`src/core/schema.ts` lines 2–3 and 16–54): `export * from './schemas/question.js'` (line 2) and `export * from './schemas/questionnaire.js'` (line 3) are each immediately followed by explicit named re-exports of the same symbols at lines 16–27 and 44–54 respectively. Every export from both `question.ts` and `questionnaire.ts` is exported twice. Only `response.ts` avoids this, using named exports exclusively. The explicit lists add no information over the wildcards and create a maintenance trap.

**`ensureQuestionnaireFileExists` + `loadQuestionnaire` both handle `ENOENT`** (`runner.ts` lines 110–160). The synchronous existence check (line 157) and the async read with `ENOENT` catch (lines 113–120) guard the same condition. The existence check is a TOCTOU race; the `ENOENT` handler is sufficient on its own.

**`QuestionnaireConfigSchema` is marked `.optional()` at the schema level** (`questionnaire.ts` line 24) yet the fields inside it have defaults. Callers must null-check `config` before accessing `config.allowBack`, even though the intent appears to be that `config` is always present with defaults. Either make the outer object required (not optional) or lift the defaults to the outer schema.

---

## Extension Model

**`StorageService` interface** (`src/core/storage/types.ts`) is the strongest extension point in the project. The flow engine, persistence manager, and web server all accept it by interface, and the factory in `server.ts` selects the implementation at startup. This is a good protocol-over-implementation model.

**`ConditionalLogicEngine` hard-wires `ConditionalFunctionRegistry`** (`conditional-logic.ts` line 59) and all condition operators are implemented in a hardcoded `switch` statement (`conditional-logic.ts` lines 77–156). The `ConditionalFunctionRegistry` exposes aggregate helper functions (`count`, `sum`, `avg`, `daysAgo`, etc.) for external use via `getFunctionRegistry()`, but it does not control how operators such as `in`, `matches`, or `hasLength` evaluate — those are baked into the `switch`. Adding a new operator requires modifying the class directly. The registry is an incomplete and unwired extension mechanism: it exists as an extension point but is not connected to the evaluation path.

**`ComponentFactory.create(question)`** (referenced in `runner.ts` line 321) uses a `Map`-based registry with a `ComponentFactory.register()` method (`ui/components/index.ts`). The open extension mechanism exists and is correct.

**`FlowEngine` interface** is defined and implemented by `QuestionnaireFlowEngine`. However, `NavigationManager` is typed against the *concrete class* `QuestionnaireFlowEngine` (`navigation-manager.ts` lines 7 and 17–19: `import type { QuestionnaireFlowEngine }` and `private flowEngine: QuestionnaireFlowEngine`), not the `FlowEngine` interface. The interface exists but is bypassed at the one place where it matters most. `NavigationManager` should depend on `FlowEngine`, not the concrete class.

**Class inheritance is not used** for question types or UI components. The discriminated union (`QuestionSchema`) and Zod's `z.discriminatedUnion` replace inheritance with data-driven dispatch. This is the right choice.

---

## Summary

### Top 3 most impactful changes, ranked by reduction in complecting

**1. Eliminate dual answer-state tracking between `FlowEngine` and `ResponseBuilder`**

`FlowEngine.recordResponse` (`flow-engine.ts` lines 251–293) and `ResponseBuilder.recordAnswer` (`response-builder.ts` lines 41–76) both independently write answers to storage, both recalculate progress, and both mutate in-memory state. They are kept in sync by `refreshFromStorage()` calls in `runner.ts`, whose failure is swallowed silently. This is a latent data-integrity bug: if synchronisation fails, `complete()` finalises stale data. The fix is structural: `FlowEngine` should own only navigation state (current question, history, visited/skipped sets); all answer recording and progress tracking should belong exclusively to `ResponseBuilder`. `FlowEngine.recordResponse` should be removed.

**2. Extract pure state-transition functions from `ResponseBuilder` and `QuestionnaireFlowEngine`**

Both classes conflate pure data transformation with I/O. Define pure functions — `applyAnswer(response, answer) → response`, `computeProgress(response) → progress`, `applyNavigation(state, direction) → state` — and reduce the classes to thin I/O coordinators. This makes the core logic unit-testable, eliminates mutable aliasing bugs through the shallow-copy boundary in `getResponse()`, and creates a natural functional core / stateful shell boundary.

**3. Decompose `runQuestionnaire` in `runner.ts` into its independent concerns**

The 200-line function owns session setup, UI rendering, navigation, signal handling, and persistence cleanup. It also has a concrete race condition: `handleInterrupt` is reachable from both the SIGINT/SIGTERM handlers and the `ExitPromptError` catch block with no mutual exclusion. Decomposing into: (a) a pure step function `(currentState, answer) → nextState`; (b) a UI layer that prompts and formats; and (c) a thin shell that handles signals via a cancellation token, drives the loop, and flushes to storage — eliminates the race and reduces the surface area of each piece to a single concern.
