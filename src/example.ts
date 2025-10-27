/**
 * Example demonstrating schema usage
 * 
 * This file demonstrates how to use the questionnaire schemas
 * for creating and validating questionnaires and responses.
 */

import {
  QuestionType,
  QuestionnaireSchema,
  validateQuestionnaire,
  createResponse,
  ResponseStatus
} from './core/schema.js';

// Example: Create a sample questionnaire
const sampleQuestionnaire = {
  id: 'survey-001',
  version: '1.0.0',
  metadata: {
    title: 'Customer Satisfaction Survey',
    description: 'A brief survey to gather customer feedback',
    author: 'Survey Team',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    tags: ['customer', 'feedback', 'satisfaction']
  },
  questions: [
    {
      id: 'q1',
      type: QuestionType.TEXT,
      text: 'What is your name?',
      required: true,
      validation: {
        minLength: 2,
        maxLength: 100
      }
    },
    {
      id: 'q2',
      type: QuestionType.EMAIL,
      text: 'What is your email address?',
      required: true
    },
    {
      id: 'q3',
      type: QuestionType.RATING,
      text: 'How satisfied are you with our service?',
      description: 'Rate from 1 (very dissatisfied) to 5 (very satisfied)',
      required: true,
      validation: {
        min: 1,
        max: 5
      }
    },
    {
      id: 'q4',
      type: QuestionType.SINGLE_CHOICE,
      text: 'How did you hear about us?',
      required: false,
      options: [
        { value: 'search', label: 'Search Engine' },
        { value: 'social', label: 'Social Media' },
        { value: 'friend', label: 'Friend/Referral' },
        { value: 'other', label: 'Other' }
      ]
    },
    {
      id: 'q5',
      type: QuestionType.MULTIPLE_CHOICE,
      text: 'Which features do you use most? (Select all that apply)',
      required: false,
      options: [
        { value: 'feature1', label: 'Feature 1' },
        { value: 'feature2', label: 'Feature 2' },
        { value: 'feature3', label: 'Feature 3' }
      ],
      validation: {
        maxSelections: 3
      }
    },
    {
      id: 'q6',
      type: QuestionType.BOOLEAN,
      text: 'Would you recommend us to a friend?',
      required: true
    }
  ],
  config: {
    allowBack: true,
    allowSkip: false,
    showProgress: true,
    shuffleQuestions: false
  }
};

// Validate the questionnaire
try {
  const validatedQuestionnaire = validateQuestionnaire(sampleQuestionnaire);
  console.log('✓ Questionnaire validation successful!');
  console.log(`  - Title: ${validatedQuestionnaire.metadata.title}`);
  console.log(`  - Questions: ${validatedQuestionnaire.questions.length}`);
  console.log(`  - Version: ${validatedQuestionnaire.version}`);
} catch (error) {
  console.error('✗ Questionnaire validation failed:', error);
}

// Example: Create a response
const response = createResponse(
  sampleQuestionnaire.id,
  sampleQuestionnaire.version,
  'session-' + Date.now(),
  sampleQuestionnaire.questions.length
);

console.log('\n✓ Response created successfully!');
console.log(`  - Response ID: ${response.id}`);
console.log(`  - Session ID: ${response.sessionId}`);
console.log(`  - Status: ${response.status}`);
console.log(`  - Progress: ${response.progress.currentQuestionIndex}/${response.progress.totalQuestions}`);

// Example: Add an answer to the response
response.answers.push({
  questionId: 'q1',
  value: 'John Doe',
  answeredAt: new Date().toISOString()
});

response.progress.currentQuestionIndex = 1;
response.progress.answeredCount = 1;

console.log('\n✓ Answer added to response');
console.log(`  - Progress: ${response.progress.answeredCount}/${response.progress.totalQuestions} answered`);

console.log('\n✓ Schema demonstration complete!');
