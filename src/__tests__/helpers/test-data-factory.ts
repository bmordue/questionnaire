import { QuestionType } from '../../core/schemas/question.js';
import type {
  TextQuestion,
  EmailQuestion,
  NumberQuestion,
  SingleChoiceQuestion,
  MultipleChoiceQuestion,
  BooleanQuestion,
  DateQuestion,
  RatingQuestion,
  Questionnaire,
  QuestionnaireResponse
} from '../../core/schema.js';
import { ResponseStatus } from '../../core/schemas/response.js';

/**
 * Test data factory for creating valid test fixtures
 */
export class TestDataFactory {
  /**
   * Create a valid text question
   */
  static createValidTextQuestion(overrides?: Partial<TextQuestion>): TextQuestion {
    return {
      id: 'text-q1',
      type: QuestionType.TEXT,
      text: 'What is your name?',
      required: false,
      ...overrides
    };
  }

  /**
   * Create a valid email question
   */
  static createValidEmailQuestion(overrides?: Partial<EmailQuestion>): EmailQuestion {
    return {
      id: 'email-q1',
      type: QuestionType.EMAIL,
      text: 'What is your email address?',
      required: false,
      ...overrides
    };
  }

  /**
   * Create a valid number question
   */
  static createValidNumberQuestion(overrides?: Partial<NumberQuestion>): NumberQuestion {
    return {
      id: 'number-q1',
      type: QuestionType.NUMBER,
      text: 'What is your age?',
      required: false,
      ...overrides
    };
  }

  /**
   * Create a valid single choice question
   */
  static createValidSingleChoiceQuestion(overrides?: Partial<SingleChoiceQuestion>): SingleChoiceQuestion {
    return {
      id: 'single-choice-q1',
      type: QuestionType.SINGLE_CHOICE,
      text: 'Pick one option',
      required: false,
      options: [
        { value: 'a', label: 'Option A' },
        { value: 'b', label: 'Option B' },
        { value: 'c', label: 'Option C' }
      ],
      ...overrides
    };
  }

  /**
   * Create a valid multiple choice question
   */
  static createValidMultipleChoiceQuestion(overrides?: Partial<MultipleChoiceQuestion>): MultipleChoiceQuestion {
    return {
      id: 'multiple-choice-q1',
      type: QuestionType.MULTIPLE_CHOICE,
      text: 'Select all that apply',
      required: false,
      options: [
        { value: 'a', label: 'Option A' },
        { value: 'b', label: 'Option B' },
        { value: 'c', label: 'Option C' }
      ],
      ...overrides
    };
  }

  /**
   * Create a valid boolean question
   */
  static createValidBooleanQuestion(overrides?: Partial<BooleanQuestion>): BooleanQuestion {
    return {
      id: 'boolean-q1',
      type: QuestionType.BOOLEAN,
      text: 'Do you agree?',
      required: false,
      ...overrides
    };
  }

  /**
   * Create a valid date question
   */
  static createValidDateQuestion(overrides?: Partial<DateQuestion>): DateQuestion {
    return {
      id: 'date-q1',
      type: QuestionType.DATE,
      text: 'What is your birth date?',
      required: false,
      ...overrides
    };
  }

  /**
   * Create a valid rating question
   */
  static createValidRatingQuestion(overrides?: Partial<RatingQuestion>): RatingQuestion {
    return {
      id: 'rating-q1',
      type: QuestionType.RATING,
      text: 'Rate your experience',
      required: false,
      validation: {
        min: 1,
        max: 5
      },
      ...overrides
    };
  }

  /**
   * Create a valid questionnaire
   */
  static createValidQuestionnaire(overrides?: Partial<Questionnaire>): Questionnaire {
    const now = new Date().toISOString();
    return {
      id: 'test-questionnaire-v1',
      version: '1.0.0',
      metadata: {
        title: 'Test Questionnaire',
        description: 'A test questionnaire',
        createdAt: now,
        updatedAt: now
      },
      questions: [
        this.createValidTextQuestion({ id: 'q1' }),
        this.createValidNumberQuestion({ id: 'q2' })
      ],
      ...overrides
    };
  }

  /**
   * Create a large questionnaire for performance testing
   */
  static createLargeQuestionnaire(questionCount: number): Questionnaire {
    const now = new Date().toISOString();
    const questions = [];
    
    for (let i = 0; i < questionCount; i++) {
      const type = i % 8;
      switch (type) {
        case 0:
          questions.push(this.createValidTextQuestion({ id: `q${i}` }));
          break;
        case 1:
          questions.push(this.createValidEmailQuestion({ id: `q${i}` }));
          break;
        case 2:
          questions.push(this.createValidNumberQuestion({ id: `q${i}` }));
          break;
        case 3:
          questions.push(this.createValidSingleChoiceQuestion({ id: `q${i}` }));
          break;
        case 4:
          questions.push(this.createValidMultipleChoiceQuestion({ id: `q${i}` }));
          break;
        case 5:
          questions.push(this.createValidBooleanQuestion({ id: `q${i}` }));
          break;
        case 6:
          questions.push(this.createValidDateQuestion({ id: `q${i}` }));
          break;
        case 7:
          questions.push(this.createValidRatingQuestion({ id: `q${i}` }));
          break;
      }
    }

    return {
      id: `large-questionnaire-v1`,
      version: '1.0.0',
      metadata: {
        title: `Large Questionnaire with ${questionCount} questions`,
        description: 'Performance testing questionnaire',
        createdAt: now,
        updatedAt: now
      },
      questions
    };
  }

  /**
   * Create a valid response
   */
  static createValidResponse(overrides?: Partial<QuestionnaireResponse>): QuestionnaireResponse {
    const now = new Date().toISOString();
    const defaults = {
      id: 'response-1',
      questionnaireId: 'test-questionnaire-v1',
      questionnaireVersion: '1.0.0',
      sessionId: 'session-123',
      startedAt: now,
      status: ResponseStatus.IN_PROGRESS,
      answers: [],
      progress: {
        currentQuestionIndex: 0,
        totalQuestions: 2,
        answeredCount: 0
      },
      version: '1.0'
    };
    
    return {
      ...defaults,
      ...overrides,
      // Ensure progress is properly merged
      progress: {
        ...defaults.progress,
        ...(overrides?.progress || {})
      }
    };
  }
}
