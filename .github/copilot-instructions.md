# Copilot Coding Agent Instructions

## Repository Overview

**Purpose**: TypeScript-based Terminal User Interface (TUI) application for executing interactive questionnaires with persistent storage of responses.

**Type**: Node.js TypeScript library/application  
**Size**: Small (~48KB source code, 248KB docs)  
**Language**: TypeScript with ES modules  
**Runtime**: Node.js v20.19.5  
**Key Framework**: Zod for schema validation and type inference

**Core Features**:
- JSON schema for defining and validating questionnaire question sets
- Runtime execution of questionnaires with interactive prompts (planned)
- Storage of responses as JSON files
- Support for 8 question types: text, email, number, single_choice, multiple_choice, boolean, date, rating
- Validation rules for each question type
- Conditional logic and branching (planned)

**Current Status**: Phase 1 complete (schemas and core types), Phases 2-3 in progress

## Project Structure

```
/
├── src/
│   ├── app.ts                          # Empty placeholder file
│   ├── example.ts                      # Working example demonstrating schema usage
│   └── core/
│       ├── schema.ts                   # Main export module for all schemas
│       ├── README.md                   # Comprehensive schema documentation
│       └── schemas/
│           ├── question.ts             # Question types and validation (197 lines)
│           ├── questionnaire.ts        # Questionnaire structure (65 lines)
│           ├── response.ts             # Response tracking (102 lines)
│           └── validation.ts           # Validation utilities (94 lines)
├── docs/                               # Implementation plan and design docs (16 files)
├── dist/                               # Build output (gitignored)
├── package.json                        # Dependencies and scripts
└── tsconfig.json                       # TypeScript configuration
```

## Build and Validation Instructions

### Prerequisites

- **Node.js**: v20.19.5 (or compatible)
- **npm**: 10.8.2 (or compatible)
- **TypeScript**: 5.9.2 (installed as dev dependency)

### Installation

**ALWAYS run npm install before building** if node_modules doesn't exist:

```bash
npm install
```

This installs:
- `typescript` (^5.9.3) - TypeScript compiler
- `@types/node` (^24.9.1) - Node.js type definitions
- `zod` (^4.1.12) - Runtime validation library

Installation completes in ~1 second with no vulnerabilities.

### Build Process

**To build the project:**

```bash
npm run build
```

This runs `tsc` which:
- Compiles TypeScript files from `src/` to `dist/`
- Generates .js files, .d.ts type declarations, and source maps
- Takes approximately 1-1.5 seconds
- **Always succeeds** with the current codebase (exit code 0)

**To clean and rebuild:**

```bash
rm -rf dist && npm run build
```

The dist/ directory is in .gitignore and should never be committed.

### Running the Example

**To build and run the example:**

```bash
npm run example
```

This runs `npm run build && node dist/example.js` which:
- Rebuilds the project
- Executes the example demonstrating schema validation
- Takes approximately 1.5-2 seconds total
- Outputs validation results for a sample questionnaire

Expected output includes:
- "✓ Questionnaire validation successful!"
- "✓ Response created successfully!"
- "✓ Answer added to response"
- "✓ Schema demonstration complete!"

### Testing

**Current test status**: No test framework is configured yet.

```bash
npm test
```

This currently outputs: "Error: no test specified" and exits with code 1.

**Do not add test infrastructure** unless specifically required by a task. Tests are planned for Phase 1 (see `docs/implementation-phase1-tests.md`).

### Linting

**No linting is configured**. There are no ESLint, Prettier, or other code quality tools installed.

**Do not add linting tools** unless specifically required by a task.

### CI/CD

**No GitHub Actions workflows exist**. There is no `.github/workflows/` directory.

There are no automated checks to replicate before committing.

## Architecture and Key Components

### TypeScript Configuration

The project uses modern TypeScript with strict settings:
- **Module system**: ES modules (`"type": "module"` in package.json, `"module": "nodenext"`)
- **Target**: esnext
- **Strict mode**: Enabled with additional strictness (`noUncheckedIndexedAccess`, `exactOptionalPropertyTypes`)
- **Output**: `dist/` directory with source maps and declaration files
- **Source root**: `src/`

**Important**: All imports must use `.js` extensions (not `.ts`) due to `verbatimModuleSyntax` setting.

### Schema System

The core of the project is a comprehensive schema validation system using Zod:

1. **Question Schemas** (`src/core/schemas/question.ts`):
   - `QuestionType` enum with 8 types
   - Individual schemas for each question type (TextQuestion, EmailQuestion, etc.)
   - Union type `QuestionSchema` combining all question types
   - `QuestionOptionSchema` for choice-based questions
   - `ConditionalLogicSchema` for conditional display logic

2. **Questionnaire Schema** (`src/core/schemas/questionnaire.ts`):
   - `QuestionnaireMetadataSchema` - title, description, author, timestamps, tags
   - `QuestionnaireConfigSchema` - display and behavior settings
   - `QuestionnaireSchema` - complete questionnaire with metadata, questions, config
   - Validation functions: `validateQuestionnaire()`, `safeValidateQuestionnaire()`

3. **Response Schema** (`src/core/schemas/response.ts`):
   - `AnswerSchema` - individual question answers
   - `ResponseStatus` enum (in_progress, completed, abandoned)
   - `ResponseProgressSchema` - tracking completion
   - `QuestionnaireResponseSchema` - complete response object
   - Helper: `createResponse()` factory function
   - Validation functions: `validateResponse()`, `safeValidateResponse()`

4. **Validation Utilities** (`src/core/schemas/validation.ts`):
   - Email, date, range checking
   - Pattern matching
   - String length validation
   - Zod error formatting

All schemas export both Zod schemas and inferred TypeScript types.

### Main Export Module

`src/core/schema.ts` re-exports all schemas, types, and utilities. **Always import from this file**:

```typescript
import { QuestionType, QuestionnaireSchema, createResponse } from './core/schema.js';
```

### Example File

`src/example.ts` demonstrates:
- Creating a questionnaire with 6 different question types
- Validating the questionnaire structure
- Creating a response object
- Adding answers and tracking progress

This file serves as both documentation and a smoke test for the schemas.

## Documentation

Extensive documentation exists in the `docs/` directory:

- `questionnaire-prd.md` - Product requirements (goals, features, tech stack)
- `schema-design.md` - Detailed schema design decisions
- `decision-log.md` - Architectural decision records
- `implementation-dependencies.md` - Task dependencies and parallelization plan
- `implementation-phase1-*.md` - Phase 1 implementation tasks
- `implementation-phase2-*.md` - Phase 2 implementation tasks (TUI, flow, validation)
- `implementation-phase3-*.md` - Phase 3 implementation tasks (conditionals, analytics, export)

**Key documentation file**: `src/core/README.md` - Comprehensive guide to the schema system with examples.

## Common Workflows

### Making Code Changes

1. **Edit TypeScript files** in `src/`
2. **Build immediately** to catch TypeScript errors: `npm run build`
3. **If changing schemas**, run the example to verify: `npm run example`
4. **Review build output** in `dist/` to ensure changes compiled correctly

### Adding New Question Types

1. Define schema in `src/core/schemas/question.ts`
2. Add to `QuestionSchema` discriminated union
3. Export from `src/core/schema.ts`
4. Update example in `src/example.ts` to demonstrate
5. Build and run example to verify

### Adding New Features

Consult the implementation phase documents in `docs/` to understand:
- Task dependencies
- Estimated effort
- Integration points
- Success criteria

## Important Notes

### Module Resolution

**CRITICAL**: All relative imports must use `.js` extensions, not `.ts`:

```typescript
// Correct
import { QuestionSchema } from './schemas/question.js';

// Wrong - will cause runtime errors
import { QuestionSchema } from './schemas/question.ts';
import { QuestionSchema } from './schemas/question';
```

This is required because `verbatimModuleSyntax: true` in tsconfig.json.

### Dependencies

The project has minimal dependencies:
- **Runtime**: Only `zod` for validation
- **Development**: Only TypeScript and Node.js types

**Do not add dependencies** without strong justification. The project intentionally keeps dependencies minimal.

### File Locations

- **Source files**: Always in `src/` or subdirectories
- **Build output**: Always in `dist/` (gitignored)
- **Documentation**: Always in `docs/`
- **Configuration**: At repository root

### What NOT to Do

1. **Do not commit `dist/` or `node_modules/`** - both are gitignored
2. **Do not add testing frameworks** unless task requires it
3. **Do not add linting tools** unless task requires it
4. **Do not create CI/CD workflows** unless task requires it
5. **Do not modify `package.json`** without understanding the ES module setup
6. **Do not use `.ts` extensions in imports** - always use `.js`

### Build Performance

Builds are fast (~1-1.5s). If a build takes longer than 5 seconds, something is wrong.

### Project Phases (Reference)

- **Phase 1** (Current): Core schema & storage - COMPLETE
- **Phase 2** (Planned): TUI components, flow logic, validation, persistence
- **Phase 3** (Planned): Conditional logic, analytics, export, polish

See `docs/implementation-dependencies.md` for detailed task breakdown.

## Trust These Instructions

These instructions have been validated by:
- Running `npm install` from clean state
- Running `npm run build` multiple times (clean and incremental)
- Running `npm run example` to verify functionality
- Testing code changes and rebuilds
- Verifying all file paths and directory structures

**Only search for additional information if**:
- These instructions are incomplete for your specific task
- You discover information that contradicts these instructions
- You need details about Phase 2/3 features not yet implemented

Otherwise, trust this document and proceed with confidence.
