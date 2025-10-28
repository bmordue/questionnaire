/**
 * Persistence Example
 * 
 * Demonstrates the complete persistence feature including:
 * - Creating and managing sessions
 * - Recording answers with metadata
 * - Auto-save functionality
 * - Session recovery
 * - Response completion
 * - Analytics
 * - Export functionality
 */

import { createStorageService } from './core/storage.js';
import { PersistenceManager } from './core/persistence/persistence-manager.js';
import { ResponseAnalytics } from './core/analytics/response-analytics.js';
import type { Questionnaire } from './core/schema.js';
import { QuestionType } from './core/schemas/question.js';

async function main() {
  console.log('=== Questionnaire Persistence Example ===\n');

  // Create storage service
  const storage = await createStorageService({
    dataDirectory: './data',
    backupEnabled: true,
    maxBackups: 5,
    compressionEnabled: false,
    encryptionEnabled: false
  });

  // Create a sample questionnaire
  const questionnaire: Questionnaire = {
    id: 'customer-feedback',
    version: '1.0.0',
    metadata: {
      title: 'Customer Feedback Survey',
      description: 'Help us improve our service',
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
        required: true,
        validation: {}
      },
      {
        id: 'q2',
        type: QuestionType.RATING,
        text: 'How satisfied are you with our service?',
        required: true,
        validation: { min: 1, max: 5 }
      },
      {
        id: 'q3',
        type: QuestionType.BOOLEAN,
        text: 'Would you recommend us to a friend?',
        required: true,
        validation: {}
      },
      {
        id: 'q4',
        type: QuestionType.TEXT,
        text: 'Any additional comments?',
        required: false,
        validation: {}
      }
    ],
    config: {
      allowBack: true,
      showProgress: true,
      shuffleQuestions: false,
      allowSkip: false
    }
  };

  // Save questionnaire
  await storage.saveQuestionnaire(questionnaire);
  console.log('✓ Questionnaire saved');

  // Create persistence manager with 5000ms auto-save interval
  const persistenceManager = new PersistenceManager(storage, 5000);

  // PART 1: Start a new session and record answers
  console.log('\n--- Part 1: Creating New Session ---');
  const session = await persistenceManager.startSession(questionnaire);
  console.log(`✓ Session started: ${session.sessionId}`);

  // Record answers with timing metadata
  console.log('\nRecording answers...');
  await session.responseBuilder.recordAnswer('q1', 'John Doe', { duration: 2000 });
  console.log('  ✓ Q1: Name recorded (2 seconds)');

  await session.responseBuilder.recordAnswer('q2', 5, { duration: 3000 });
  console.log('  ✓ Q2: Rating recorded (3 seconds)');

  await session.responseBuilder.recordAnswer('q3', true, { duration: 1500 });
  console.log('  ✓ Q3: Recommendation recorded (1.5 seconds)');

  await session.responseBuilder.skipQuestion('q4');
  console.log('  ✓ Q4: Skipped');

  // Check progress
  const progress = session.responseBuilder.getResponse().progress;
  console.log(`\nProgress: ${progress.answeredCount}/${progress.totalQuestions} answered (${progress.percentComplete}%)`);

  // Update an answer (simulating user changing their mind)
  console.log('\nUpdating answer...');
  await session.responseBuilder.updateAnswer('q2', 4, 1000);
  console.log('  ✓ Q2: Rating updated from 5 to 4');

  // Complete the response
  console.log('\nCompleting response...');
  const completedResponse = await session.responseBuilder.complete();
  console.log(`✓ Response completed`);
  console.log(`  Total duration: ${completedResponse.totalDuration}ms`);
  console.log(`  Started: ${completedResponse.startedAt}`);
  console.log(`  Completed: ${completedResponse.completedAt}`);

  // End the session
  await persistenceManager.endSession();
  console.log('✓ Session ended');

  // PART 2: Create multiple responses for analytics
  console.log('\n--- Part 2: Creating Sample Responses for Analytics ---');
  
  const responses = [
    { name: 'Alice Smith', rating: 5, recommend: true },
    { name: 'Bob Johnson', rating: 4, recommend: true },
    { name: 'Carol White', rating: 3, recommend: false },
    { name: 'David Brown', rating: 5, recommend: true },
    { name: 'Eve Davis', rating: 4, recommend: true }
  ];

  for (const data of responses) {
    const s = await persistenceManager.startSession(questionnaire);
    await s.responseBuilder.recordAnswer('q1', data.name, { duration: 2000 });
    await s.responseBuilder.recordAnswer('q2', data.rating, { duration: 2500 });
    await s.responseBuilder.recordAnswer('q3', data.recommend, { duration: 1500 });
    await s.responseBuilder.skipQuestion('q4');
    await s.responseBuilder.complete();
    await persistenceManager.endSession();
  }
  console.log(`✓ Created ${responses.length} sample responses`);

  // PART 3: Session Recovery
  console.log('\n--- Part 3: Session Recovery Demo ---');
  const newSession = await persistenceManager.startSession(questionnaire);
  await newSession.responseBuilder.recordAnswer('q1', 'Incomplete User', { duration: 2000 });
  console.log(`✓ Partial session created: ${newSession.sessionId}`);
  await persistenceManager.endSession();

  // Resume the incomplete session
  const resumedSession = await persistenceManager.resumeSession(newSession.sessionId);
  const resumedResponse = resumedSession.responseBuilder.getResponse();
  console.log(`✓ Session resumed: ${resumedSession.sessionId}`);
  console.log(`  Answers already recorded: ${resumedResponse.answers.length}`);
  console.log(`  First answer: ${resumedResponse.answers[0]?.value}`);
  await persistenceManager.endSession();

  // PART 4: Analytics
  console.log('\n--- Part 4: Analytics ---');
  const analytics = new ResponseAnalytics(storage);

  const completionStats = await analytics.getCompletionStats(questionnaire.id);
  console.log('\nCompletion Statistics:');
  console.log(`  Total responses: ${completionStats.totalResponses}`);
  console.log(`  Completed: ${completionStats.completedResponses}`);
  console.log(`  Completion rate: ${completionStats.completionRate.toFixed(1)}%`);
  console.log(`  Avg completion time: ${(completionStats.averageCompletionTime / 1000).toFixed(1)}s`);

  const ratingStats = await analytics.getQuestionStats(questionnaire.id, 'q2');
  console.log('\nRating Question Statistics:');
  console.log(`  Total responses: ${ratingStats.totalResponses}`);
  console.log(`  Answered: ${ratingStats.answeredCount}`);
  console.log(`  Skipped: ${ratingStats.skippedCount}`);
  console.log(`  Avg attempts: ${ratingStats.averageAttempts.toFixed(1)}`);
  console.log(`  Avg duration: ${(ratingStats.averageDuration / 1000).toFixed(1)}s`);
  
  console.log('\n  Rating distribution:');
  for (const item of ratingStats.responseDistribution.distribution) {
    console.log(`    ${item.value} stars: ${item.count} (${item.percentage.toFixed(1)}%)`);
  }

  // PART 5: Export
  console.log('\n--- Part 5: Export ---');
  
  // Export as JSON
  const jsonExport = await persistenceManager.exportResponse(session.sessionId, 'json');
  console.log('\nJSON Export (first 200 chars):');
  console.log(jsonExport.substring(0, 200) + '...');

  // Export as CSV
  const csvExport = await persistenceManager.exportResponse(session.sessionId, 'csv');
  console.log('\nCSV Export:');
  console.log(csvExport);

  console.log('\n=== Example Complete ===');
}

// Run the example
main().catch(error => {
  console.error('Error:', error);
  process.exit(1);
});
