import { describe, it, expect } from '@jest/globals';
import { MarkdownConverter } from '../../utils/markdown-converter.js';
import type { QuestionnaireResponse, Questionnaire } from '../../core/schema.js';
import { QuestionType, ResponseStatus } from '../../core/schema.js';

describe('MarkdownConverter', () => {
  const sampleQuestionnaire: Questionnaire = {
    id: 'test-questionnaire',
    version: '1.0.0',
    metadata: {
      title: 'Test Survey',
      description: 'A test survey',
      createdAt: '2025-10-27T10:00:00.000Z',
      updatedAt: '2025-10-27T10:00:00.000Z'
    },
    questions: [
      {
        id: 'q1',
        type: QuestionType.TEXT,
        text: 'What is your name?',
        required: true
      },
      {
        id: 'q2',
        type: QuestionType.NUMBER,
        text: 'What is your age?',
        required: true,
        validation: { min: 0, max: 120, integer: true }
      },
      {
        id: 'q3',
        type: QuestionType.BOOLEAN,
        text: 'Do you agree?',
        required: false
      },
      {
        id: 'q4',
        type: QuestionType.RATING,
        text: 'Rate your experience',
        required: true,
        validation: { min: 1, max: 5 }
      },
      {
        id: 'q5',
        type: QuestionType.SINGLE_CHOICE,
        text: 'Pick one option',
        required: false,
        options: [
          { value: 'opt1', label: 'Option 1' },
          { value: 'opt2', label: 'Option 2' }
        ]
      },
      {
        id: 'q6',
        type: QuestionType.MULTIPLE_CHOICE,
        text: 'Select all that apply',
        required: false,
        options: [
          { value: 'choice1', label: 'Choice 1' },
          { value: 'choice2', label: 'Choice 2' },
          { value: 'choice3', label: 'Choice 3' }
        ]
      }
    ]
  };

  const sampleResponse: QuestionnaireResponse = {
    id: 'response-001',
    questionnaireId: 'test-questionnaire',
    questionnaireVersion: '1.0.0',
    sessionId: 'session-001',
    startedAt: '2025-10-27T12:00:00.000Z',
    completedAt: '2025-10-27T12:10:00.000Z',
    status: ResponseStatus.COMPLETED,
    answers: [
      { questionId: 'q1', value: 'John Doe', answeredAt: '2025-10-27T12:01:00.000Z' },
      { questionId: 'q2', value: 30, answeredAt: '2025-10-27T12:02:00.000Z' },
      { questionId: 'q3', value: true, answeredAt: '2025-10-27T12:03:00.000Z' },
      { questionId: 'q4', value: 4, answeredAt: '2025-10-27T12:04:00.000Z' },
      { questionId: 'q5', value: 'opt2', answeredAt: '2025-10-27T12:05:00.000Z' },
      { questionId: 'q6', value: ['choice1', 'choice3'], answeredAt: '2025-10-27T12:06:00.000Z' }
    ],
    progress: {
      currentQuestionIndex: 6,
      totalQuestions: 6,
      answeredCount: 6
    },
    version: '1.0'
  };

  describe('convertResponse', () => {
    it('should generate valid markdown', () => {
      const markdown = MarkdownConverter.convertResponse(sampleResponse, sampleQuestionnaire);
      
      expect(markdown).toContain('# Test Survey');
      expect(markdown).toContain('## Metadata');
      expect(markdown).toContain('## Progress');
      expect(markdown).toContain('## Responses');
    });

    it('should include response metadata', () => {
      const markdown = MarkdownConverter.convertResponse(sampleResponse, sampleQuestionnaire);
      
      expect(markdown).toContain('response-001');
      expect(markdown).toContain('session-001');
      expect(markdown).toContain('Completed');
    });

    it('should format text answers correctly', () => {
      const markdown = MarkdownConverter.convertResponse(sampleResponse, sampleQuestionnaire);
      
      expect(markdown).toContain('What is your name?');
      expect(markdown).toContain('John Doe');
    });

    it('should format number answers correctly', () => {
      const markdown = MarkdownConverter.convertResponse(sampleResponse, sampleQuestionnaire);
      
      expect(markdown).toContain('What is your age?');
      expect(markdown).toContain('**Answer**: 30');
    });

    it('should format boolean answers correctly', () => {
      const markdown = MarkdownConverter.convertResponse(sampleResponse, sampleQuestionnaire);
      
      expect(markdown).toContain('Do you agree?');
      expect(markdown).toContain('**Answer**: Yes');
    });

    it('should format rating answers with stars', () => {
      const markdown = MarkdownConverter.convertResponse(sampleResponse, sampleQuestionnaire);
      
      expect(markdown).toContain('Rate your experience');
      expect(markdown).toContain('4 (★★★★☆)');
    });

    it('should format single choice answers with labels', () => {
      const markdown = MarkdownConverter.convertResponse(sampleResponse, sampleQuestionnaire);
      
      expect(markdown).toContain('Pick one option');
      expect(markdown).toContain('Option 2');
    });

    it('should format multiple choice answers as list', () => {
      const markdown = MarkdownConverter.convertResponse(sampleResponse, sampleQuestionnaire);
      
      expect(markdown).toContain('Select all that apply');
      expect(markdown).toContain('- Choice 1');
      expect(markdown).toContain('- Choice 3');
    });

    it('should show unanswered questions', () => {
      const partialResponse: QuestionnaireResponse = {
        ...sampleResponse,
        answers: [
          { questionId: 'q1', value: 'John Doe', answeredAt: '2025-10-27T12:01:00.000Z' }
        ],
        status: ResponseStatus.IN_PROGRESS,
        progress: {
          currentQuestionIndex: 1,
          totalQuestions: 6,
          answeredCount: 1
        }
      };
      delete partialResponse.completedAt;

      const markdown = MarkdownConverter.convertResponse(partialResponse, sampleQuestionnaire);
      
      expect(markdown).toContain('*(No response)*');
    });

    it('should respect includeMetadata option', () => {
      const markdown = MarkdownConverter.convertResponse(
        sampleResponse,
        sampleQuestionnaire,
        { includeMetadata: false }
      );
      
      expect(markdown).not.toContain('## Metadata');
      expect(markdown).toContain('## Responses');
    });

    it('should respect includeProgress option', () => {
      const markdown = MarkdownConverter.convertResponse(
        sampleResponse,
        sampleQuestionnaire,
        { includeProgress: false }
      );
      
      expect(markdown).not.toContain('## Progress');
      expect(markdown).toContain('## Metadata');
    });

    it('should respect custom title option', () => {
      const markdown = MarkdownConverter.convertResponse(
        sampleResponse,
        sampleQuestionnaire,
        { title: 'Custom Title' }
      );
      
      expect(markdown).toContain('# Custom Title');
    });

    it('should include timestamps when requested', () => {
      const markdown = MarkdownConverter.convertResponse(
        sampleResponse,
        sampleQuestionnaire,
        { includeTimestamps: true }
      );
      
      expect(markdown).toContain('*Answered at:');
    });

    it('should handle multi-line text with blockquotes', () => {
      const responseWithMultiline: QuestionnaireResponse = {
        ...sampleResponse,
        answers: [
          {
            questionId: 'q1',
            value: 'Line 1\nLine 2\nLine 3',
            answeredAt: '2025-10-27T12:01:00.000Z'
          }
        ]
      };

      const markdown = MarkdownConverter.convertResponse(responseWithMultiline, sampleQuestionnaire);
      
      expect(markdown).toContain('> Line 1');
      expect(markdown).toContain('> Line 2');
      expect(markdown).toContain('> Line 3');
    });

    it('should show completion percentage', () => {
      const markdown = MarkdownConverter.convertResponse(sampleResponse, sampleQuestionnaire);
      
      expect(markdown).toContain('100%');
    });

    it('should calculate and display duration', () => {
      const markdown = MarkdownConverter.convertResponse(sampleResponse, sampleQuestionnaire);
      
      expect(markdown).toContain('**Duration**: 10m 0s');
    });

    it('should include custom metadata if present', () => {
      const responseWithMetadata: QuestionnaireResponse = {
        ...sampleResponse,
        metadata: {
          device: 'mobile',
          browser: 'Safari'
        }
      };

      const markdown = MarkdownConverter.convertResponse(responseWithMetadata, sampleQuestionnaire);
      
      expect(markdown).toContain('Device');
      expect(markdown).toContain('mobile');
      expect(markdown).toContain('Browser');
      expect(markdown).toContain('Safari');
    });

    it('should handle question descriptions', () => {
      const questionnaireWithDesc: Questionnaire = {
        ...sampleQuestionnaire,
        questions: [
          {
            id: 'q1',
            type: QuestionType.TEXT,
            text: 'Question text',
            description: 'This is a helpful description',
            required: true
          }
        ]
      };

      const markdown = MarkdownConverter.convertResponse(
        sampleResponse,
        questionnaireWithDesc
      );
      
      expect(markdown).toContain('*This is a helpful description*');
    });
  });
});
