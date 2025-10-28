/**
 * Advanced Conditional Logic Example
 * 
 * Demonstrates the enhanced conditional logic engine with:
 * - New comparison operators
 * - Conditional functions
 * - Dependency tracking
 * - Validation tools
 */

import {
  ConditionalLogicEngine,
  ConditionalFunctionRegistry,
  DependencyGraph,
  type EvaluationContext
} from './core/flow/index.js';
import type { Questionnaire, Question } from './core/schema.js';
import { QuestionType } from './core/schema.js';

// Example questionnaire with advanced conditional logic
const advancedQuestionnaire: Questionnaire = {
  id: 'health-survey',
  version: '1.0.0',
  metadata: {
    title: 'Health Survey with Advanced Logic',
    description: 'Demonstrates conditional logic features',
    author: 'System',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  },
  questions: [
    {
      id: 'age',
      type: QuestionType.NUMBER,
      text: 'What is your age?',
      required: true,
      validation: { min: 18, max: 120 }
    },
    {
      id: 'exercise_frequency',
      type: QuestionType.SINGLE_CHOICE,
      text: 'How often do you exercise?',
      required: true,
      options: [
        { value: 'never', label: 'Never' },
        { value: 'sometimes', label: '1-2 times per week' },
        { value: 'often', label: '3-4 times per week' },
        { value: 'daily', label: 'Daily' }
      ]
    },
    {
      id: 'exercise_types',
      type: QuestionType.MULTIPLE_CHOICE,
      text: 'What types of exercise do you do?',
      required: false,
      options: [
        { value: 'cardio', label: 'Cardio' },
        { value: 'strength', label: 'Strength Training' },
        { value: 'yoga', label: 'Yoga' },
        { value: 'sports', label: 'Sports' }
      ],
      // Only show if they exercise at all
      conditional: {
        showIf: {
          questionId: 'exercise_frequency',
          operator: 'notEquals',
          value: 'never'
        }
      }
    },
    {
      id: 'exercise_duration',
      type: QuestionType.TEXT,
      text: 'How long do you typically exercise per session?',
      required: false,
      validation: {
        pattern: '^\\d+\\s*(min|minutes|hour|hours)$',
        patternMessage: 'Please specify duration (e.g., "30 min" or "1 hour")'
      },
      // Show if they exercise often or daily
      conditional: {
        showIf: {
          questionId: 'exercise_frequency',
          operator: 'in',
          values: ['often', 'daily']
        }
      }
    },
    {
      id: 'health_conditions',
      type: QuestionType.MULTIPLE_CHOICE,
      text: 'Do you have any of these health conditions?',
      required: false,
      options: [
        { value: 'diabetes', label: 'Diabetes' },
        { value: 'hypertension', label: 'High Blood Pressure' },
        { value: 'heart_disease', label: 'Heart Disease' },
        { value: 'none', label: 'None of the above' }
      ]
    },
    {
      id: 'medical_supervision',
      type: QuestionType.BOOLEAN,
      text: 'Are you under medical supervision for your exercise routine?',
      required: false,
      // Required if they're over 65 OR have health conditions
      conditional: {
        requiredIf: [
          { questionId: 'age', operator: 'greaterThan', value: 65 },
          { questionId: 'health_conditions', operator: 'notContains', value: 'none' }
        ]
      }
    },
    {
      id: 'fitness_goals',
      type: QuestionType.TEXT,
      text: 'What are your fitness goals?',
      required: false,
      validation: {
        minLength: 10,
        maxLength: 500
      },
      // Only show if response length is adequate (using hasMinLength)
      conditional: {
        showIf: {
          questionId: 'exercise_types',
          operator: 'hasMinLength',
          value: 1
        }
      }
    },
    {
      id: 'recent_workout_date',
      type: QuestionType.DATE,
      text: 'When was your last workout?',
      required: false,
      validation: {
        maxDate: new Date().toISOString().split('T')[0]
      },
      conditional: {
        showIf: {
          questionId: 'exercise_frequency',
          operator: 'notEquals',
          value: 'never'
        }
      }
    },
    {
      id: 'activity_level',
      type: QuestionType.RATING,
      text: 'Rate your overall activity level',
      required: true,
      validation: { min: 1, max: 10 }
    },
    {
      id: 'feedback',
      type: QuestionType.TEXT,
      text: 'Any additional feedback about your health and fitness?',
      required: false,
      validation: {
        maxLength: 1000
      }
    }
  ]
};

async function demonstrateAdvancedConditionalLogic() {
  console.log('='.repeat(80));
  console.log('Advanced Conditional Logic Demonstration');
  console.log('='.repeat(80));
  console.log();

  const engine = new ConditionalLogicEngine();

  // 1. Validate the questionnaire
  console.log('1. VALIDATING QUESTIONNAIRE STRUCTURE');
  console.log('-'.repeat(80));
  
  const validationResult = engine.validateConditionalLogic(advancedQuestionnaire);
  console.log(`Validation Status: ${validationResult.isValid ? '✓ VALID' : '✗ INVALID'}`);
  
  if (validationResult.errors.length > 0) {
    console.log('\nErrors:');
    validationResult.errors.forEach(error => console.log(`  - ${error}`));
  }
  
  if (validationResult.warnings.length > 0) {
    console.log('\nWarnings:');
    validationResult.warnings.forEach(warning => console.log(`  - ${warning}`));
  }
  
  console.log();

  // 2. Build and analyze dependency graph
  console.log('2. DEPENDENCY GRAPH ANALYSIS');
  console.log('-'.repeat(80));
  
  const dependencyGraph = engine.buildDependencyGraph(advancedQuestionnaire);
  console.log(`Total questions with dependencies: ${dependencyGraph.size()}`);
  console.log(`All nodes in graph: ${dependencyGraph.getAllNodes().join(', ')}`);
  
  // Show dependencies for each question
  for (const question of advancedQuestionnaire.questions) {
    const deps = dependencyGraph.getDependencies(question.id);
    if (deps.length > 0) {
      console.log(`\n  ${question.id} depends on: ${deps.join(', ')}`);
    }
  }
  
  const cycles = dependencyGraph.findCycles();
  console.log(`\nCircular dependencies found: ${cycles.length === 0 ? 'None ✓' : cycles.length}`);
  console.log();

  // 3. Simulate user responses and evaluate conditions
  console.log('3. SIMULATING USER RESPONSES');
  console.log('-'.repeat(80));
  
  const responses = new Map<string, any>();
  responses.set('age', 68);
  responses.set('exercise_frequency', 'often');
  responses.set('exercise_types', ['cardio', 'yoga', 'strength']);
  responses.set('exercise_duration', '45 min');
  responses.set('health_conditions', ['hypertension', 'diabetes']);
  responses.set('recent_workout_date', '2025-10-25');
  responses.set('activity_level', 7);
  
  console.log('User responses:');
  for (const [key, value] of responses.entries()) {
    console.log(`  ${key}: ${JSON.stringify(value)}`);
  }
  console.log();

  // 4. Evaluate conditional logic for each question
  console.log('4. EVALUATING CONDITIONAL LOGIC');
  console.log('-'.repeat(80));
  
  for (const question of advancedQuestionnaire.questions) {
    const shouldShow = engine.shouldShowQuestion(question, responses);
    const isRequired = engine.isQuestionRequired(question, responses);
    const shouldSkip = engine.shouldSkipQuestion(question, responses);
    
    console.log(`\n${question.id}:`);
    console.log(`  Show: ${shouldShow ? '✓ Yes' : '✗ No'}`);
    console.log(`  Required: ${isRequired ? '✓ Yes' : '✗ No'}`);
    console.log(`  Skip: ${shouldSkip ? '✓ Yes' : '✗ No'}`);
    
    if (question.conditional) {
      console.log(`  Has conditional logic: Yes`);
    }
  }
  console.log();

  // 5. Demonstrate conditional functions
  console.log('5. DEMONSTRATING CONDITIONAL FUNCTIONS');
  console.log('-'.repeat(80));
  
  const functionRegistry = engine.getFunctionRegistry();
  const context: EvaluationContext = { responses };
  
  // Count function
  const cardioCount = functionRegistry.execute('count', ['exercise_types', 'cardio'], context);
  console.log(`\ncount(exercise_types, 'cardio'): ${cardioCount}`);
  
  // Length function
  const exerciseTypesLength = functionRegistry.execute('length', ['exercise_types'], context);
  console.log(`length(exercise_types): ${exerciseTypesLength}`);
  
  // Sum function (if we had multiple numeric answers)
  responses.set('calories_breakfast', 400);
  responses.set('calories_lunch', 600);
  responses.set('calories_dinner', 700);
  const totalCalories = functionRegistry.execute('sum', ['calories_breakfast', 'calories_lunch', 'calories_dinner'], context);
  console.log(`sum(calories_*): ${totalCalories}`);
  
  // Average function
  const avgCalories = functionRegistry.execute('avg', ['calories_breakfast', 'calories_lunch', 'calories_dinner'], context);
  console.log(`avg(calories_*): ${avgCalories.toFixed(1)}`);
  
  // Min/Max functions
  const minCalories = functionRegistry.execute('min', ['calories_breakfast', 'calories_lunch', 'calories_dinner'], context);
  const maxCalories = functionRegistry.execute('max', ['calories_breakfast', 'calories_lunch', 'calories_dinner'], context);
  console.log(`min(calories_*): ${minCalories}`);
  console.log(`max(calories_*): ${maxCalories}`);
  
  // DaysAgo function
  const daysSinceWorkout = functionRegistry.execute('daysAgo', ['recent_workout_date'], context);
  console.log(`daysAgo(recent_workout_date): ${daysSinceWorkout} days`);
  
  // AnsweredCount function
  const answeredCount = functionRegistry.execute('answeredCount', 
    ['age', 'exercise_frequency', 'exercise_types', 'health_conditions'], 
    context
  );
  console.log(`answeredCount(age, exercise_frequency, exercise_types, health_conditions): ${answeredCount}`);
  
  console.log();

  // 6. Test new comparison operators
  console.log('6. TESTING NEW COMPARISON OPERATORS');
  console.log('-'.repeat(80));
  
  // matches operator
  responses.set('email', 'test@example.com');
  const emailMatches = engine.evaluateCondition(
    { questionId: 'email', operator: 'matches', value: '^[^@]+@[^@]+\\.[^@]+$' },
    responses
  );
  console.log(`\nemail matches email pattern: ${emailMatches ? '✓ Yes' : '✗ No'}`);
  
  // hasLength operator
  const exerciseTypesHasLength = engine.evaluateCondition(
    { questionId: 'exercise_types', operator: 'hasLength', value: 3 },
    responses
  );
  console.log(`exercise_types has length 3: ${exerciseTypesHasLength ? '✓ Yes' : '✗ No'}`);
  
  // hasMinLength operator
  const exerciseTypesMinLength = engine.evaluateCondition(
    { questionId: 'exercise_types', operator: 'hasMinLength', value: 2 },
    responses
  );
  console.log(`exercise_types has min length 2: ${exerciseTypesMinLength ? '✓ Yes' : '✗ No'}`);
  
  // hasMaxLength operator
  const exerciseTypesMaxLength = engine.evaluateCondition(
    { questionId: 'exercise_types', operator: 'hasMaxLength', value: 5 },
    responses
  );
  console.log(`exercise_types has max length 5: ${exerciseTypesMaxLength ? '✓ Yes' : '✗ No'}`);
  
  console.log();

  console.log('='.repeat(80));
  console.log('Demonstration Complete!');
  console.log('='.repeat(80));
}

// Run the demonstration
demonstrateAdvancedConditionalLogic().catch(console.error);
