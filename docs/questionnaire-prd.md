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
- Advanced analysis and reporting: out of scope (basic markdown export is supported)
- Response management UI: users will manage the collection of JSON response files using other tools
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

### 3.2 Markdown Export Utility
- Convert questionnaire responses from JSON to markdown format
- Optimize markdown output for LLM consumption
- Support all question types with appropriate formatting
- Include metadata, progress tracking, and answer details
- Standalone CLI script for batch conversion

## 4. Technical Architecture

### 4.1 Tech Stack
- **Language**: TypeScript
- **Storage**: JSON files
- **Validation**: Zod for runtime schema validation
- **CLI Framework**: Commander.js for command parsing
- **User input**: Inquirer.js
- **Export**: Native TypeScript for markdown generation

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
├── utils/
│   └── markdown-converter.ts # Response to markdown converter
└── markdown-convert.ts       # Standalone markdown export CLI
```

### 4.3 CLI Commands

```bash
questionnaire run <file>                        # Execute questionnaire
questionnaire continue <session-id>             # Resume incomplete session
npm run markdown-convert -- <response.json> <questionnaire.json> [output.md]
                                                # Convert response to markdown
```

## 5. Implementation Phases

### Phase 1: Core Schema & Storage (Week 1) ✅ COMPLETED
- Define TypeScript schemas with Zod
- Implement basic storage layer
- Create sample questionnaire fixtures
- Write unit tests for schema validation
- **Markdown export utility**: Convert responses to LLM-optimized markdown format

### Phase 2: Questionnaire Runner (Week 2)
- Build TUI components for each question type
- Implement question flow logic
- Add validation and error handling
- Implement response persistence

### Phase 3: Advanced Features (Week 3)
- Conditional logic engine
- Response viewing and analytics
- Advanced export functionality (CSV, PDF)
- Polish and error handling

## 6. Markdown Export Feature

### 6.1 Overview
The markdown export utility converts questionnaire responses from JSON format into well-structured markdown documents optimized for consumption by Large Language Models (LLMs).

### 6.2 Key Features
- **Type-safe conversion**: Uses existing Zod schemas for validation
- **Format-specific handlers**: Specialized formatting for all 8 question types
  - Text: Plain text or blockquotes for multi-line responses
  - Number: Numeric values
  - Boolean: Yes/No representation
  - Rating: Numeric value with star visualization (★★★★☆)
  - Single Choice: Option labels
  - Multiple Choice: Bulleted lists
  - Date: Formatted dates
  - Email: Email addresses
- **Rich metadata**: Includes response ID, status, timestamps, duration, session info
- **Progress tracking**: Completion percentage and answered question count
- **Configurable output**: Options for metadata, progress, timestamps, and custom titles

### 6.3 Usage
```bash
# Output to stdout
npm run markdown-convert -- response.json questionnaire.json

# Save to file
npm run markdown-convert -- response.json questionnaire.json output.md
```

### 6.4 Output Structure
```markdown
# Survey Title

## Metadata
- Response ID, status, timestamps, duration
- Session ID and custom metadata

## Progress
- Questions answered, completion percentage

## Responses
### 1. Question text
*Type: rating | Required*
**Answer**: 4 (★★★★☆)
```

### 6.5 Implementation Details
- **Location**: `src/utils/markdown-converter.ts` (converter class)
- **CLI Script**: `src/markdown-convert.ts` (standalone utility)
- **Test Coverage**: 18 test cases covering all question types and options
- **Dependencies**: None (uses existing project dependencies)

## 7. User Experience Considerations

### 7.1 Runner Mode
- Clear, readable question presentation
- Progress indicator
- Graceful error messages
- Ability to go back and change answers
- Save and exit with resume capability

### 7.2 Markdown Export
- Clear, hierarchical markdown structure
- Human-readable formatting for all question types
- Consistent patterns for easy parsing by LLMs
- Complete context and metadata for analysis
- No data loss during conversion

## 8. Future Enhancements

- HTML questionnaire runner
- Question templates library
- Advanced analytics and visualizations
- Response filtering and search
- Integration with external systems (webhooks, APIs)
- Question branching/complex flows
- Additional export formats (CSV, PDF, Excel)

## 9. Success Metrics

- Time to create a simple questionnaire: < 5 minutes
- Time to complete a 10-question survey: < 3 minutes
- Zero data loss on interruption
- Schema validation catches 100% of invalid configurations
- Markdown export preserves 100% of response data
- Export conversion time: < 1 second for typical responses

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