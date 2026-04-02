# Requirements Questionnaires

This directory contains pre-built questionnaires for eliciting project requirements using the questionnaire schema system.

## Available Questionnaires

### Core Requirements

**`project-requirements-core.json`** (22 questions)

Comprehensive requirements gathering questionnaire covering:
- Project overview and goals
- Target users and user counts
- Application type selection (web, mobile, desktop, API, CLI, etc.)
- Core feature identification
- Technology stack preferences
- Deployment environment
- Security and compliance requirements
- Performance requirements
- Timeline and budget
- Success metrics and risks

**Best for:** Initial project discovery with stakeholders

---

### Feature Prioritisation

**`feature-prioritisation-moscow.json`** (15 questions)

MoSCoW method prioritisation questionnaire:
- **M**ust Have - Critical, non-negotiable features
- **S**hould Have - Important but not vital features
- **C**ould Have - Desirable but deferrable features
- **W**on't Have - Consciously excluded features

Also covers:
- Timeline and resource constraints
- Stakeholder alignment assessment
- Priority change anticipation

**Best for:** Sprint planning, roadmap definition, scope management

---

## Creating Domain-Specific Questionnaires

You can create customised questionnaires for specific domains by copying one of the existing JSON templates in this directory (for example, `project-requirements-core.json`) and editing the questions to suit your domain.

For details of the questionnaire structure and all supported question types, see the schema documentation in `src/core/README.md`.

---

## Usage

### Running a Questionnaire

```bash
# Run core requirements questionnaire
npm start -- --questionnaire fixtures/requirements/project-requirements-core.json

# Run with custom data directory for stakeholder sessions
npm start -- --questionnaire fixtures/requirements/project-requirements-core.json --data ./sessions/stakeholder-a

# Resume an interrupted session
npm start -- --questionnaire fixtures/requirements/project-requirements-core.json --resume <sessionId>
```

### Exporting to Markdown

```bash
npm run markdown-convert -- \
  data/responses/response-*.json \
  fixtures/requirements/project-requirements-core.json \
  requirements.md
```

### Multi-Stakeholder Workflow

```bash
# Collect from multiple stakeholders
npm start -- -q fixtures/requirements/project-requirements-core.json -d ./sessions/tech-lead
npm start -- -q fixtures/requirements/project-requirements-core.json -d ./sessions/product-owner
npm start -- -q fixtures/requirements/project-requirements-core.json -d ./sessions/business-stakeholder

# Consolidate all responses
npm run markdown-convert -- \
  ./sessions/*/responses/*.json \
  fixtures/requirements/project-requirements-core.json \
  consolidated-requirements.md
```

---

## Creating Custom Questionnaires

Use the questionnaire schema to create custom requirements questionnaires:

```json
{
  "id": "my-custom-requirements",
  "version": "1.0.0",
  "metadata": {
    "title": "Custom Requirements",
    "description": "Tailored for specific project needs",
    "createdAt": "2026-03-30T00:00:00Z",
    "updatedAt": "2026-03-30T00:00:00Z",
    "tags": ["custom", "requirements"]
  },
  "questions": [
    {
      "id": "question-1",
      "type": "text",
      "text": "Your question here?",
      "required": true
    }
  ]
}
```

See `src/core/schemas/questionnaire.ts` and `src/core/schemas/question.ts` for schema details.

---

## Validation

Validate all questionnaires against the schema:

```bash
npm run validate
```

---

## Tips

1. **Start with core**: Use `project-requirements-core.json` as a baseline, then customise
2. **Combine questionnaires**: Run multiple questionnaires in sequence for comprehensive coverage
3. **Use conditionals**: Reduce cognitive load by showing only relevant questions
4. **Save sessions**: Each stakeholder session is persisted and can be resumed
5. **Export early**: Convert to markdown after each session for review

---

## Related Files

- [Schema Definitions](../../src/core/schemas/)
- [Schema Documentation](../../src/core/README.md)
- [Main README](../../README.md)
