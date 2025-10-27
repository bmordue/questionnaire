/**
 * Navigation Types
 * 
 * Type definitions for navigation actions and results
 */

import type { FlowResult } from './flow-types.js';

/**
 * Navigation action types
 */
export type NavigationActionType = 'next' | 'previous' | 'skip' | 'jumpTo' | 'exit';

/**
 * Navigation action with optional data
 */
export interface NavigationAction {
  type: NavigationActionType;
  answer?: any;
  questionId?: string;
}

/**
 * Result of a navigation action
 */
export interface NavigationResult {
  success: boolean;
  result?: FlowResult;
  error?: string;
}
