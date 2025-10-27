# Questionnaire TUI - Product Requirements Document

## 1. Overview

A TypeScript-based Terminal User Interface (TUI) application for executing interactive questionnaires with persistent storage of responses.

## 2. Goals

- Provide a JSON schema for defining and validating questionnaire question sets
- Enable runtime execution of questionnaires with interactive prompts
- Store responses as JSON files adhering to a questionnaire response schema
- Support various question types, response types and validation rules
- Allow conditional logic and branching

### 2.1 Non-goals

- Questionnaire design mode: questionnaires will be written as JSON, the tool will not provide an interface for creating questionnaires
- Analysis, reporting, response management: out of scope. The users of the tool will manage the collection of JSON response files using other tools.
- Authentication: not required
- Encryption: out of scope

## 3. Core Features

### 3.1 Questionnaire Runner Mode
- Load and execute questionnaire schemas
- Display questions interactively with appropriate input controls
- Validate user input in real-time
- Handle conditional logic and question skipping
- Save responses with metadata (timestamp, session ID)
- Support resume/continue functionality

## 4. Technical Architecture

### 4.1 Tech Stack
- **Language**: TypeScript
- **Storage**: JSON files
- **CLI Framework**: Commander.js for command parsing
- **User input**: Inquirer.js

### 4.2 Project Structure

```
src/
├── cli/
│   ├── index.ts              # CLI entry point
│   ├── commands/
│   │   ├── run.ts            # Runner mode
├── core/
│   ├── schema.ts             # Schema types and validation
│   ├── questionnaire.ts      # Questionnaire engine
│   └── conditional.ts        # Conditional logic engine
├── ui/
│   ├── components/           # Reusable TUI components
│   └── runner/               # Runner UI screens
└── utils/
```

### 4.3 CLI Commands

```bash
questionnaire run <file>                 # Execute questionnaire
questionnaire continue <session-id>      # Resume incomplete session
```

## 5. Implementation Phases

### Phase 1: Core Schema & Storage (Week 1)
- Define TypeScript schemas with Zod
- Implement basic storage layer
- Create sample questionnaire fixtures
- Write unit tests for schema validation

### Phase 2: Questionnaire Runner (Week 2)
- Build TUI components for each question type
- Implement question flow logic
- Add validation and error handling
- Implement response persistence

### Phase 3: Advanced Features (Week 3)
- Conditional logic engine
- Response viewing and analytics
- Export functionality
- Polish and error handling

## 7. User Experience Considerations

### 7.1 Runner Mode
- Clear, readable question presentation
- Progress indicator
- Graceful error messages
- Ability to go back and change answers
- Save and exit with resume capability

## 8. Future Enhancements

- HTML questionnaire runner
- Question templates library
- Advanced analytics and visualizations
- Response filtering and search
- Integration with external systems (webhooks, APIs)
- Question branching/complex flows

## 9. Success Metrics

- Time to create a simple questionnaire: < 5 minutes
- Time to complete a 10-question survey: < 3 minutes
- Zero data loss on interruption
- Schema validation catches 100% of invalid configurations

## 10. Open Questions

- What's the maximum questionnaire size we should support?

## Critical path

PHASE 1:
Schemas (9h) 
    ├──> Storage (12h) ──────────────────┐
    ├──> Fixtures (11h) ─────────────────┼──> Phase 2
    └──> Schema Tests (15h) ─────────────┘

PHASE 2:
├─> Components (18h) ──┐
│                      ├──> Validation (16h) ──┐
├─> Flow Logic (18h) ──┤                       ├──> Phase 3
                       └──> Persistence (16h) ─┘

PHASE 3:
├─> Conditional Logic (18h) ──┐
├─> Analytics (18h) ───────────┼──┐
├─> Export (18h) ──────────────┘  │
└─> Polish (16h) ← EVERYTHING ────┘