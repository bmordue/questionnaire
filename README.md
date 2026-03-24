# Questionnaire TUI

A TypeScript-based Terminal User Interface (TUI) application for running interactive questionnaires with persistent session storage.

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
