# Questionnaire TUI

A TypeScript-based Terminal User Interface (TUI) application for running interactive questionnaires with persistent session storage.

## Authentication Model

> **This service does not handle credentials.** Authentication is delegated entirely to an nginx reverse proxy running Authelia forward-auth. The service is auth-agnostic: it trusts the identity headers (`Remote-User`, `Remote-Name`, `Remote-Groups`) injected by the proxy and uses them for ownership and permission checks only.

**Threat assumptions:**
- Clients can only reach the service via nginx; the service binds to `127.0.0.1` in production.
- nginx strips `Remote-*` headers from untrusted clients before forwarding.
- Identity is derived exclusively from proxy-injected headers — no passwords or sessions are managed in-app.

**Running locally without the auth stack:**
```bash
export DEV_STUB_USER="dev@example.com:Developer:admins"
npm run dev
```

See [docs/auth.md](docs/auth.md) for the full deployment topology, nginx configuration snippet, Authelia access-control rules, OIDC notes, and the production checklist.

## Features

- ✅ **Interactive TUI Runner**: Prompt-driven questionnaire execution in the terminal
- ✅ **All Question Types**: Text, email, number, single choice, multiple choice, boolean, date, and rating
- ✅ **Conditional Logic**: Questions shown or skipped based on previous answers
- ✅ **Session Persistence**: Auto-save every 30 seconds with the ability to resume interrupted sessions
- ✅ **Progress Display**: Real-time progress bar and question counter
- ✅ **Validation**: Per-type rules (length, range, pattern, date bounds, selection limits)
- ✅ **Markdown Export**: Convert saved responses to LLM-optimised markdown
- ✅ **Fixture Library**: 14 sample questionnaires for testing and demonstration
- ✅ **Test Coverage**: ~680 passing tests

## Quick Start

### Nix Development Environment

If you use [Nix](https://nixos.org/), you can get a fully-reproducible development environment with all required tools:

```bash
nix-shell
```

This drops you into a shell with Node.js 22 and TypeScript pre-installed. If your Nixpkgs configuration has `allowUnfree = true`, the shell also includes `gemini-cli` and `claude-code`.

#### direnv integration

If you have [direnv](https://direnv.net/) installed, allow the provided `.envrc` to activate the Nix shell automatically whenever you enter the project directory:

```bash
direnv allow
```

### Installation

```bash
npm install
```

### Build

```bash
npm run build
```

### Run a Questionnaire

```bash
npm start -- --questionnaire fixtures/basic/simple-text-survey.json
```

Resume a saved session:

```bash
npm start -- --questionnaire fixtures/basic/simple-text-survey.json --resume <sessionId>
```

For iterative runs without rebuilding:

```bash
npm run start:dev -- --questionnaire fixtures/basic/simple-text-survey.json
```

Options:

| Flag              | Short | Description                                               |
| ----------------- | ----- | --------------------------------------------------------- |
| `--questionnaire` | `-q`  | Path to questionnaire JSON file (required)                |
| `--resume`        | `-r`  | Resume an existing session by ID                          |
| `--data`          | `-d`  | Data directory for sessions/responses (default: `./data`) |
| `--help`          | `-h`  | Show usage                                                |

### Run Tests

```bash
npm test
```

### Validate Fixtures

```bash
npm run validate
```

This validates all 14 sample questionnaires against the schema, generates a coverage report, and tests questionnaire flows.

### Convert Response to Markdown

```bash
npm run markdown-convert -- <response.json> <questionnaire.json> [output.md]
```

Examples:
```bash
# Output to stdout
npm run markdown-convert -- examples/sample-response.json fixtures/basic/simple-text-survey.json

# Output to file
npm run markdown-convert -- examples/sample-response.json fixtures/basic/simple-text-survey.json output.md
```

The markdown format is structured for LLM consumption with formatted answers and complete metadata. See [examples/README.md](examples/README.md) for details.

## How It Works

### Running a Questionnaire

When you run a questionnaire, the runner:

1. Loads and validates the questionnaire JSON against the schema
2. Creates (or resumes) a persistent session in `data/sessions/` and `data/responses/`
3. Evaluates conditional logic to determine which question to show next
4. Renders the appropriate TUI component for the question type using Inquirer (`inquirer`) prompts
5. Validates the answer and saves it incrementally to disk
6. Displays a progress bar and question counter after each answer
7. Repeats until all applicable questions are answered
8. Marks the session as complete

Pressing Ctrl+C interrupts the session gracefully — progress is saved and can be resumed with `--resume <sessionId>`.

### Session Storage

Sessions are stored as JSON files under `data/`:

```
data/
├── sessions/       # Session metadata
└── responses/      # Individual responses, with timestamped backups
```

Auto-save creates a backup of the response file every 30 seconds while a session is active.

## Pluggable Storage Backend

The project ships with a file-based storage implementation by default. The entrypoint is `src/core/storage.ts` which exports `FileStorageService` and the helper `createStorageService()`.

- **Default behaviour**: `FileStorageService` persists questionnaires, responses and sessions under the `data/` directory and is configured via the `StorageConfig` type in `src/core/storage/types.ts` (fields: `dataDirectory`, `backupEnabled`, `maxBackups`, `compressionEnabled`, `encryptionEnabled`, `deleteBackupsOnCompletion`).
- **CLI override**: The runner accepts `--data <path>` (see `--data` in Quick Start) which is passed to the storage service as the `dataDirectory`.

If you want to use a different storage backend (database, cloud object store, etc.), implement the `StorageService` interface found at `src/core/storage/types.ts` and provide your implementation to the runner or application entrypoint.

Minimal example (outline):

```
import type { StorageService } from './src/core/storage/types.js';

class MyDbStorage implements StorageService {
  // implement all required methods: saveQuestionnaire, loadQuestionnaire,
  // listQuestionnaires, saveResponse, loadResponse, listResponses, createSession,
  // updateSession, loadSession, deleteSession, listActiveSessions, cleanup,
  // cleanupBackups, getDataDirectory, getConfig
}

// In your application/runner bootstrap:
const storage = new MyDbStorage(/* config */);
if ('initialize' in storage && typeof storage.initialize === 'function') {
  await (storage as any).initialize();
}
// pass `storage` to the PersistenceManager, FlowEngine, etc.
```

Notes:
- The runner currently instantiates `FileStorageService` directly in `src/runner.ts`. To switch to a custom backend you can modify `src/runner.ts` to create and use your storage instance (or update `src/app.ts` if you bootstrap elsewhere).
- The `FileStorageService` exposes a small `createStorageService(config?)` helper which returns an initialized service — useful for tests and quick swaps.
- The runner will call an optional `initialize()` method on the storage instance if present, so your implementation can perform async setup as needed.

## Storage Configuration

A quick reference for configuring storage in local development and for deployments (for example, on Vercel).

- **Local filesystem (default)**
  - Default data directory: `./data`.
  - CLI override: pass `--data <path>` to the runner (or `-d`).
  - When running the web server, set `DATA_DIR` to point at a different directory.
  - The built-in `FileStorageService` will create `sessions/`, `responses/` and `questionnaires/` under the configured directory.

- **S3 (recommended for serverless platforms like Vercel)**
  - Environment variables used by the web server:
    - `S3_BUCKET` (required) — S3 bucket name
    - `S3_REGION` — AWS region (defaults to `us-east-1`)
    - `S3_KEY_PREFIX` — optional key prefix to namespace objects
    - `S3_ENDPOINT` — optional custom endpoint for S3-compatible services (MinIO, LocalStack)
    - `AWS_ACCESS_KEY_ID` / `AWS_SECRET_ACCESS_KEY` — credentials (or rely on instance role/credentials provider)
    - `S3_FORCE_PATH_STYLE` — set to `true` for MinIO/LocalStack path-style URLs
  - On Vercel, configure these as Environment Variables in your project settings (for the "Production" environment).
  - When deploying via the GitHub Actions workflow (`.github/workflows/deploy.yml`), set the following as GitHub repository secrets and variables:
    - Secrets: `AWS_ACCESS_KEY_ID`, `AWS_SECRET_ACCESS_KEY`, `VERCEL_TOKEN`, `VERCEL_ORG_ID`, `VERCEL_PROJECT_ID`
    - Variables: `S3_BUCKET`, `S3_REGION`
  - When `S3_BUCKET` is present the web server uses the S3-backed storage automatically; otherwise it falls back to the filesystem-based `FileStorageService`.

Notes:
  - The S3 backend stores objects under keys:
    - `questionnaires/{id}.json`
    - `responses/{sessionId}.json`
    - `sessions/{sessionId}.json`
  - Backups and rotating temporary files are handled by the filesystem-based stores; generic backends (S3) do not currently perform automatic backup rotation.

## Project Structure

```
questionnaire/
├── fixtures/              # Sample questionnaires (14 total)
│   ├── basic/            # Simple examples (3 fixtures)
│   ├── advanced/         # Real-world scenarios (6 fixtures)
│   ├── edge-cases/       # Stress tests and edge cases (4 fixtures)
│   ├── feature-refinement/ # Feature exploration (1 fixture)
│   └── README.md
├── examples/              # Sample responses and markdown outputs
├── src/
│   ├── app.ts            # CLI entry point and argument parsing
│   ├── runner.ts         # Main questionnaire runner
│   ├── core/
│   │   ├── flow/         # Flow engine, navigation, conditional logic, progress tracking
│   │   ├── persistence/  # Session management, auto-save, response builder
│   │   ├── schemas/      # Zod schemas (questions, questionnaire, response)
│   │   ├── storage.ts    # File-based JSON storage entry point (FileStorageService)
│   │   └── storage/      # Storage backends and helpers
│   ├── ui/
│   │   └── components/   # TUI input components (text, email, number, date,
│   │                     #   single/multiple choice, boolean, rating)
│   ├── utils/
│   │   └── markdown-converter.ts  # Response-to-markdown conversion
│   └── __tests__/        # Test suite
├── data/                 # Saved sessions and responses (runtime, gitignored)
├── docs/                 # Implementation documentation
└── package.json
```

## Question Types

### Text inputs
- **text** — free text with optional min/max length and regex pattern
- **email** — email address with format validation
- **number** — integer or decimal with optional min/max range
- **date** — date picker with optional `minDate`/`maxDate` bounds

### Choice inputs
- **single_choice** — select one option from a list
- **multiple_choice** — select one or more options, with optional `minSelections`/`maxSelections`

### Other
- **boolean** — yes/no prompt
- **rating** — numeric rating within a configured scale (e.g. 1–5 or 1–10)

## Conditional Logic

Questions can be conditionally shown or skipped based on previous answers:

```json
{
  "conditional": {
    "showIf": {
      "questionId": "previous_question",
      "operator": "equals",
      "value": "some_value"
    }
  }
}
```

Supported operators: `equals`, `notEquals`, `greaterThan`, `lessThan`, `greaterThanOrEqual`, `lessThanOrEqual`, `contains`

## Sample Fixtures

### Basic (3)
1. **simple-text-survey** — Text, number, and email inputs
2. **choice-based-quiz** — Single and multiple choice questions
3. **boolean-preferences** — Yes/no questions

### Advanced (6)
1. **customer-feedback** — Customer satisfaction survey with conditionals
2. **employee-onboarding** — New hire information collection
3. **product-research** — Feature prioritisation survey
4. **demographic-survey** — Audience demographics
5. **holiday-destination** — Destination preferences
6. **persistence-solution-selector** — Storage technology selection

### Edge Cases (4)
1. **complex-conditionals** — Multi-level conditional logic
2. **validation-stress** — All validation types exercised
3. **maximum-length** — 55 questions for stress testing
4. **error-scenarios** — Boundary conditions

### Feature Refinement (1)
1. **backup-cleanup-questions** — Backup and cleanup workflow

See [fixtures/README.md](fixtures/README.md) for detailed documentation.

## License

ISC
