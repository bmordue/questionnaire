/**
 * Storage Example
 * 
 * Demonstrates how to use the storage service
 */

import { createStorageService } from './core/storage.js';
import { QuestionType } from './core/schema.js';
import type { Questionnaire } from './core/schema.js';

async function main() {
  console.log('Storage Service Example\n');

  // Create storage service
  console.log('1. Creating storage service...');
  const storage = await createStorageService({
    dataDirectory: './example-data',
    backupEnabled: true,
    maxBackups: 3
  });
  console.log('   ✓ Storage service initialized\n');

  // Create a sample questionnaire
  console.log('2. Creating sample questionnaire...');
  const questionnaire: Questionnaire = {
    id: 'customer-feedback-v1',
    version: '1.0.0',
    metadata: {
      title: 'Customer Feedback Survey',
      description: 'Help us improve our products and services',
      author: 'Product Team',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      tags: ['feedback', 'customer-satisfaction']
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
        type: QuestionType.EMAIL,
        text: 'What is your email address?',
        required: true
      },
      {
        id: 'q3',
        type: QuestionType.RATING,
        text: 'How would you rate our service?',
        required: true,
        validation: {
          min: 1,
          max: 5
        }
      },
      {
        id: 'q4',
        type: QuestionType.SINGLE_CHOICE,
        text: 'Would you recommend us to a friend?',
        required: true,
        options: [
          { value: 'yes', label: 'Yes, definitely' },
          { value: 'maybe', label: 'Maybe' },
          { value: 'no', label: 'No' }
        ]
      },
      {
        id: 'q5',
        type: QuestionType.TEXT,
        text: 'Any additional comments?',
        required: false,
        validation: {
          maxLength: 500
        }
      }
    ],
    config: {
      allowBack: true,
      allowSkip: false,
      showProgress: true,
      shuffleQuestions: false
    }
  };

  await storage.saveQuestionnaire(questionnaire);
  console.log('   ✓ Questionnaire saved\n');

  // List questionnaires
  console.log('3. Listing questionnaires...');
  const questionnaires = await storage.listQuestionnaires();
  console.log(`   Found ${questionnaires.length} questionnaire(s):`);
  for (const q of questionnaires) {
    console.log(`   - ${q.title} (${q.id})`);
  }
  console.log();

  // Create a session
  console.log('4. Creating a session...');
  const sessionId = await storage.createSession(questionnaire.id);
  console.log(`   ✓ Session created: ${sessionId}\n`);

  // Load and update response
  console.log('5. Updating response...');
  const response = await storage.loadResponse(sessionId);
  
  // Simulate answering questions
  response.answers.push({
    questionId: 'q1',
    value: 'John Doe',
    answeredAt: new Date().toISOString()
  });
  
  response.answers.push({
    questionId: 'q2',
    value: 'john.doe@example.com',
    answeredAt: new Date().toISOString()
  });
  
  response.answers.push({
    questionId: 'q3',
    value: 5,
    answeredAt: new Date().toISOString()
  });

  response.progress.currentQuestionIndex = 3;
  response.progress.answeredCount = 3;

  await storage.saveResponse(response);
  console.log('   ✓ Response updated with 3 answers\n');

  // List active sessions
  console.log('6. Listing active sessions...');
  const activeSessions = await storage.listActiveSessions();
  console.log(`   Found ${activeSessions.length} active session(s)\n`);

  // Complete the session
  console.log('7. Completing session...');
  response.status = 'completed' as any;
  response.completedAt = new Date().toISOString();
  response.progress.currentQuestionIndex = questionnaire.questions.length;
  await storage.saveResponse(response);
  
  await storage.updateSession(sessionId, { status: 'completed' });
  console.log('   ✓ Session completed\n');

  // List responses
  console.log('8. Listing responses...');
  const responses = await storage.listResponses(questionnaire.id);
  console.log(`   Found ${responses.length} response(s) for this questionnaire\n`);

  console.log('✓ Example completed successfully!');
  console.log(`\nData saved to: ${storage.getDataDirectory()}`);
}

main().catch(console.error);
