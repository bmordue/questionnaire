/**
 * Flow Module
 * 
 * Main exports for the questionnaire flow system
 */

// Export flow engine
export {
  QuestionnaireFlowEngine,
  FlowError,
  FlowErrorCode
} from './flow-engine.js';

// Export conditional logic
export {
  ConditionalLogicEngine,
  ConditionEvaluationError
} from './conditional-logic.js';

// Export navigation
export { NavigationManager } from './navigation-manager.js';

// Export progress tracking
export { ProgressTracker } from './progress-tracker.js';

// Export types
export type {
  FlowEngine,
  FlowState,
  FlowResult,
  ProgressInfo,
  QuestionResult,
  FlowComplete
} from '../types/flow-types.js';

export type {
  NavigationAction,
  NavigationResult,
  NavigationActionType
} from '../types/navigation-types.js';

