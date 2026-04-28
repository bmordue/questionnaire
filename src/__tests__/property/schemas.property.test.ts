import { describe, it, expect } from '@jest/globals';
import fc from 'fast-check';
import {
  QuestionSchema,
  TextQuestionSchema,
  NumberQuestionSchema,
  BooleanQuestionSchema,
  RatingQuestionSchema,
  SingleChoiceQuestionSchema,
  MultipleChoiceQuestionSchema,
  QuestionType
} from '../../core/schemas/question.js';
import {
  QuestionnaireSchema,
  QuestionnaireMetadataSchema
} from '../../core/schemas/questionnaire.js';
import {
  QuestionnaireResponseSchema,
  ResponseStatus,
  createResponse
} from '../../core/schemas/response.js';

// ── Arbitraries ──────────────────────────────────────────────────────────────

const isoDatetime = fc.date({
  min: new Date('2000-01-01'),
  max: new Date('2099-12-31'),
  noInvalidDate: true
}).map(d => d.toISOString());

const questionId = fc.stringMatching(/^[a-z][a-z0-9_-]{0,19}$/);

const baseQuestionFields = (type: QuestionType) => ({
  id: questionId,
  type: fc.constant(type),
  text: fc.string({ minLength: 1, maxLength: 200 }),
  required: fc.boolean()
});

const textQuestionArb = fc.record(baseQuestionFields(QuestionType.TEXT));

const numberQuestionArb = fc.record(baseQuestionFields(QuestionType.NUMBER));

const booleanQuestionArb = fc.record(baseQuestionFields(QuestionType.BOOLEAN));

const ratingQuestionArb = fc.record({
  ...baseQuestionFields(QuestionType.RATING),
  validation: fc.record({
    min: fc.integer({ min: 0, max: 5 }),
    max: fc.integer({ min: 6, max: 10 })
  })
});

const questionOptionArb = fc.record({
  value: fc.string({ minLength: 1, maxLength: 50 }),
  label: fc.string({ minLength: 1, maxLength: 100 })
});

const singleChoiceQuestionArb = fc.record({
  ...baseQuestionFields(QuestionType.SINGLE_CHOICE),
  options: fc.array(questionOptionArb, { minLength: 1, maxLength: 10 })
});

const multipleChoiceQuestionArb = fc.record({
  ...baseQuestionFields(QuestionType.MULTIPLE_CHOICE),
  options: fc.array(questionOptionArb, { minLength: 1, maxLength: 10 })
});

const anyQuestionArb = fc.oneof(
  textQuestionArb,
  numberQuestionArb,
  booleanQuestionArb,
  ratingQuestionArb,
  singleChoiceQuestionArb,
  multipleChoiceQuestionArb
);

const metadataArb = fc.record({
  title: fc.string({ minLength: 1, maxLength: 200 }),
  createdAt: isoDatetime,
  updatedAt: isoDatetime
});

const questionnaireArb = fc.record({
  id: fc.string({ minLength: 1, maxLength: 50 }),
  version: fc.stringMatching(/^\d+\.\d+\.\d+$/),
  metadata: metadataArb,
  questions: fc.array(anyQuestionArb, { minLength: 1, maxLength: 5 }),
  permissions: fc.constant([])
});

// ── Tests ────────────────────────────────────────────────────────────────────

describe('Property-Based Tests: Schema Validation', () => {
  describe('Question Schemas', () => {
    it('valid text questions should always parse successfully', () => {
      fc.assert(
        fc.property(textQuestionArb, (q) => {
          const result = TextQuestionSchema.safeParse(q);
          expect(result.success).toBe(true);
        })
      );
    });

    it('valid number questions should always parse successfully', () => {
      fc.assert(
        fc.property(numberQuestionArb, (q) => {
          const result = NumberQuestionSchema.safeParse(q);
          expect(result.success).toBe(true);
        })
      );
    });

    it('valid boolean questions should always parse successfully', () => {
      fc.assert(
        fc.property(booleanQuestionArb, (q) => {
          const result = BooleanQuestionSchema.safeParse(q);
          expect(result.success).toBe(true);
        })
      );
    });

    it('valid rating questions should always parse successfully', () => {
      fc.assert(
        fc.property(ratingQuestionArb, (q) => {
          const result = RatingQuestionSchema.safeParse(q);
          expect(result.success).toBe(true);
        })
      );
    });

    it('valid single choice questions should always parse successfully', () => {
      fc.assert(
        fc.property(singleChoiceQuestionArb, (q) => {
          const result = SingleChoiceQuestionSchema.safeParse(q);
          expect(result.success).toBe(true);
        })
      );
    });

    it('valid multiple choice questions should always parse successfully', () => {
      fc.assert(
        fc.property(multipleChoiceQuestionArb, (q) => {
          const result = MultipleChoiceQuestionSchema.safeParse(q);
          expect(result.success).toBe(true);
        })
      );
    });

    it('any generated question should parse via the discriminated union', () => {
      fc.assert(
        fc.property(anyQuestionArb, (q) => {
          const result = QuestionSchema.safeParse(q);
          expect(result.success).toBe(true);
        })
      );
    });

    it('questions with missing type field should fail validation', () => {
      fc.assert(
        fc.property(
          fc.record({
            id: questionId,
            text: fc.string({ minLength: 1 })
          }),
          (partial) => {
            const result = QuestionSchema.safeParse(partial);
            expect(result.success).toBe(false);
          }
        )
      );
    });

    it('questions with invalid type should fail validation', () => {
      fc.assert(
        fc.property(
          fc.record({
            id: questionId,
            type: fc.string().filter(s => !Object.values(QuestionType).includes(s as QuestionType)),
            text: fc.string({ minLength: 1 })
          }),
          (invalid) => {
            const result = QuestionSchema.safeParse(invalid);
            expect(result.success).toBe(false);
          }
        )
      );
    });
  });

  describe('Questionnaire Schema', () => {
    it('valid questionnaires should always parse successfully', () => {
      fc.assert(
        fc.property(questionnaireArb, (q) => {
          const result = QuestionnaireSchema.safeParse(q);
          expect(result.success).toBe(true);
        }),
        { numRuns: 50 }
      );
    });

    it('questionnaire metadata should always parse with valid data', () => {
      fc.assert(
        fc.property(metadataArb, (m) => {
          const result = QuestionnaireMetadataSchema.safeParse(m);
          expect(result.success).toBe(true);
        })
      );
    });

    it('questionnaire with empty questions array should fail', () => {
      fc.assert(
        fc.property(questionnaireArb, (q) => {
          const invalid = { ...q, questions: [] };
          const result = QuestionnaireSchema.safeParse(invalid);
          expect(result.success).toBe(false);
        })
      );
    });

    it('parse then serialize round-trip should preserve structure', () => {
      fc.assert(
        fc.property(questionnaireArb, (q) => {
          const parsed = QuestionnaireSchema.safeParse(q);
          if (parsed.success) {
            const serialized = JSON.parse(JSON.stringify(parsed.data));
            const reparsed = QuestionnaireSchema.safeParse(serialized);
            expect(reparsed.success).toBe(true);
          }
        }),
        { numRuns: 50 }
      );
    });
  });

  describe('Response Schema', () => {
    it('createResponse should always produce valid responses', () => {
      fc.assert(
        fc.property(
          fc.string({ minLength: 1, maxLength: 50 }),
          fc.stringMatching(/^\d+\.\d+\.\d+$/),
          fc.string({ minLength: 1, maxLength: 50 }),
          fc.integer({ min: 1, max: 100 }),
          (qId, version, sessionId, totalQuestions) => {
            const response = createResponse(qId, version, sessionId, totalQuestions);
            const result = QuestionnaireResponseSchema.safeParse(response);
            expect(result.success).toBe(true);
          }
        ),
        { numRuns: 50 }
      );
    });

    it('createResponse should set correct initial state', () => {
      fc.assert(
        fc.property(
          fc.string({ minLength: 1 }),
          fc.string({ minLength: 1 }),
          fc.string({ minLength: 1 }),
          fc.integer({ min: 1, max: 100 }),
          (qId, version, sessionId, totalQuestions) => {
            const response = createResponse(qId, version, sessionId, totalQuestions);
            expect(response.questionnaireId).toBe(qId);
            expect(response.questionnaireVersion).toBe(version);
            expect(response.sessionId).toBe(sessionId);
            expect(response.status).toBe(ResponseStatus.IN_PROGRESS);
            expect(response.answers).toEqual([]);
            expect(response.progress.totalQuestions).toBe(totalQuestions);
            expect(response.progress.answeredCount).toBe(0);
            expect(response.progress.currentQuestionIndex).toBe(0);
          }
        )
      );
    });

    it('response round-trip through JSON should preserve validity', () => {
      fc.assert(
        fc.property(
          fc.string({ minLength: 1 }),
          fc.string({ minLength: 1 }),
          fc.string({ minLength: 1 }),
          fc.integer({ min: 1, max: 50 }),
          (qId, version, sessionId, total) => {
            const response = createResponse(qId, version, sessionId, total);
            const serialized = JSON.parse(JSON.stringify(response));
            const result = QuestionnaireResponseSchema.safeParse(serialized);
            expect(result.success).toBe(true);
          }
        )
      );
    });
  });
});
