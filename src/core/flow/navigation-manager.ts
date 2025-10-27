/**
 * Navigation Manager
 * 
 * Handles navigation actions and coordinates with the flow engine
 */

import type { QuestionnaireFlowEngine } from './flow-engine.js';
import type {
  NavigationAction,
  NavigationResult
} from '../types/navigation-types.js';

/**
 * Manages navigation through questionnaires
 */
export class NavigationManager {
  private flowEngine: QuestionnaireFlowEngine;

  constructor(flowEngine: QuestionnaireFlowEngine) {
    this.flowEngine = flowEngine;
  }

  /**
   * Handle a navigation action
   */
  async handleNavigation(action: NavigationAction): Promise<NavigationResult> {
    try {
      switch (action.type) {
        case 'next':
          return await this.handleNext(action.answer);
        
        case 'previous':
          return await this.handlePrevious();
        
        case 'skip':
          return await this.handleSkip();
        
        case 'jumpTo':
          return await this.handleJumpTo(action.questionId!);
        
        case 'exit':
          return await this.handleExit();
        
        default: {
          const exhaustiveCheck: never = action.type;
          return {
            success: false,
            error: `Unknown navigation action: ${exhaustiveCheck}`
          };
        }
      }
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : String(error)
      };
    }
  }

  /**
   * Handle next navigation
   */
  private async handleNext(answer?: any): Promise<NavigationResult> {
    const currentQuestion = this.flowEngine.getCurrentQuestion();
    if (!currentQuestion) {
      return {
        success: false,
        error: 'No current question'
      };
    }

    // Record answer if provided
    if (answer !== undefined) {
      await this.flowEngine.recordResponse(currentQuestion.id, answer);
    }

    // Move to next question
    const result = await this.flowEngine.next();
    
    return {
      success: true,
      result
    };
  }

  /**
   * Handle previous navigation
   */
  private async handlePrevious(): Promise<NavigationResult> {
    const previousQuestion = await this.flowEngine.previous();
    
    if (!previousQuestion) {
      return {
        success: false,
        error: 'Already at the first question'
      };
    }

    return {
      success: true,
      result: { type: 'question', question: previousQuestion }
    };
  }

  /**
   * Handle skip navigation
   */
  private async handleSkip(): Promise<NavigationResult> {
    // Skip current question and move to next
    const result = await this.flowEngine.next();
    
    return {
      success: true,
      result
    };
  }

  /**
   * Handle jump to specific question
   */
  private async handleJumpTo(questionId: string): Promise<NavigationResult> {
    if (!questionId) {
      return {
        success: false,
        error: 'Question ID is required for jumpTo action'
      };
    }

    const question = await this.flowEngine.jumpTo(questionId);
    
    return {
      success: true,
      result: { type: 'question', question }
    };
  }

  /**
   * Handle exit navigation
   */
  private async handleExit(): Promise<NavigationResult> {
    // Save state before exiting
    await this.flowEngine.saveState();
    
    return {
      success: true
    };
  }
}
