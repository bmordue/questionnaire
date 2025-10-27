/**
 * Flow Engine Example
 * 
 * Demonstrates the questionnaire flow engine with conditional logic
 */

import { QuestionnaireFlowEngine } from './core/flow/flow-engine.js';
import { NavigationManager } from './core/flow/navigation-manager.js';
import { createStorageService } from './core/storage.js';
import { QuestionType } from './core/schema.js';
import type { Questionnaire } from './core/schema.js';

async function demonstrateFlowEngine() {
  console.log('=== Questionnaire Flow Engine Demo ===\n');

  // Create storage service
  const storage = await createStorageService({
    dataDirectory: './demo-data',
    backupEnabled: false
  });

  // Create a sample questionnaire with conditional logic
  const questionnaire: Questionnaire = {
    id: 'demo-questionnaire',
    version: '1.0.0',
    metadata: {
      title: 'Customer Satisfaction Survey',
      description: 'A demo questionnaire with conditional logic',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    },
    questions: [
      {
        id: 'q1',
        type: QuestionType.BOOLEAN,
        text: 'Are you satisfied with our service?',
        required: true
      },
      {
        id: 'q2-satisfied',
        type: QuestionType.TEXT,
        text: 'What did you like most?',
        required: false,
        conditional: {
          showIf: {
            questionId: 'q1',
            operator: 'equals',
            value: true
          }
        }
      },
      {
        id: 'q2-dissatisfied',
        type: QuestionType.TEXT,
        text: 'What could we improve?',
        required: true,
        conditional: {
          showIf: {
            questionId: 'q1',
            operator: 'equals',
            value: false
          }
        }
      },
      {
        id: 'q3',
        type: QuestionType.RATING,
        text: 'How likely are you to recommend us?',
        required: true,
        validation: {
          min: 1,
          max: 10
        }
      }
    ]
  };

  // Save questionnaire
  await storage.saveQuestionnaire(questionnaire);
  console.log('✓ Created questionnaire:', questionnaire.metadata.title);

  // Create flow engine and navigation manager
  const engine = new QuestionnaireFlowEngine(storage);
  const navManager = new NavigationManager(engine);

  // Start the questionnaire
  await engine.start(questionnaire.id);
  console.log('✓ Started questionnaire session\n');

  // Simulate answering questions
  console.log('--- Question 1 ---');
  const q1 = engine.getCurrentQuestion();
  console.log('Q:', q1?.text);
  console.log('A: Yes (true)\n');

  // Answer and navigate
  await navManager.handleNavigation({
    type: 'next',
    answer: true
  });

  // Show progress
  let progress = engine.getProgress();
  console.log(`Progress: ${progress.percentComplete}% (${progress.answeredQuestions}/${progress.totalQuestions} questions)`);
  console.log('');

  // Next question (should be q2-satisfied because we answered true)
  console.log('--- Question 2 ---');
  const q2 = engine.getCurrentQuestion();
  console.log('Q:', q2?.text);
  console.log('A: The excellent customer service\n');

  await navManager.handleNavigation({
    type: 'next',
    answer: 'The excellent customer service'
  });

  progress = engine.getProgress();
  console.log(`Progress: ${progress.percentComplete}% (${progress.answeredQuestions}/${progress.totalQuestions} questions)`);
  console.log('');

  // Final question
  console.log('--- Question 3 ---');
  const q3 = engine.getCurrentQuestion();
  console.log('Q:', q3?.text);
  console.log('A: 9\n');

  const result = await navManager.handleNavigation({
    type: 'next',
    answer: 9
  });

  // Check completion
  if (result.result?.type === 'complete') {
    console.log('✓ Questionnaire completed!');
    progress = engine.getProgress();
    console.log(`Final progress: ${progress.percentComplete}% (${progress.answeredQuestions}/${progress.totalQuestions} questions)`);
    console.log('\n=== Responses ===');
    result.result.responses.forEach((value, questionId) => {
      console.log(`${questionId}: ${value}`);
    });
  }

  console.log('\n✓ Demo complete!');
}

// Run the demo
demonstrateFlowEngine().catch(console.error);
