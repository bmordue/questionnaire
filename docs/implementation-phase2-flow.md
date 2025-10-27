# Phase 2 Task 2: Implement Question Flow Logic

## Overview
Develop the core questionnaire execution engine that manages question flow, conditional logic, navigation, and state management throughout the questionnaire session.

## Goals
- Implement sequential and conditional question flow
- Support navigation (forward, backward, skip)
- Handle complex branching and conditional logic
- Manage questionnaire state and progress tracking
- Enable session persistence and recovery

## Technical Approach

### 1. Flow Engine Architecture

#### Core Components
```typescript
interface FlowEngine {
  start(questionnaire: Questionnaire): Promise<void>
  next(): Promise<QuestionResult | FlowComplete>
  previous(): Promise<Question | null>
  jumpTo(questionId: string): Promise<Question>
  getCurrentQuestion(): Question | null
  getProgress(): ProgressInfo
  saveState(): Promise<void>
  loadState(sessionId: string): Promise<void>
}
```

#### Question Flow State
```typescript
interface FlowState {
  questionnaireId: string
  sessionId: string
  currentQuestionIndex: number
  currentQuestionId: string
  responses: Map<string, any>
  visitedQuestions: Set<string>
  skippedQuestions: Set<string>
  questionHistory: string[]
  isCompleted: boolean
  startTime: Date
  lastUpdateTime: Date
}
```

### 2. Conditional Logic System

#### Condition Types
```typescript
type ConditionOperator = 
  | 'equals' | 'notEquals'
  | 'greaterThan' | 'lessThan'
  | 'greaterThanOrEqual' | 'lessThanOrEqual'
  | 'contains' | 'notContains'
  | 'in' | 'notIn'
  | 'isEmpty' | 'isNotEmpty'

interface Condition {
  questionId: string
  operator: ConditionOperator
  value: any
  values?: any[] // for 'in' and 'notIn' operators
}

interface ConditionalLogic {
  showIf?: Condition | Condition[]
  hideIf?: Condition | Condition[]
  skipIf?: Condition | Condition[]
  requiredIf?: Condition | Condition[]
}
```

## Implementation Tasks

### Task 2.1: Core Flow Engine (6 hours)
- [ ] Implement basic flow engine class
- [ ] Create question navigation logic
- [ ] Add state management and persistence
- [ ] Implement progress tracking

### Task 2.2: Conditional Logic Engine (5 hours)
- [ ] Create condition evaluation system
- [ ] Implement all condition operators
- [ ] Add support for complex conditional expressions
- [ ] Handle conditional validation rules

### Task 2.3: Navigation System (4 hours)
- [ ] Implement forward/backward navigation
- [ ] Add question skipping logic
- [ ] Create jump-to-question functionality
- [ ] Handle navigation edge cases

### Task 2.4: Session Management (3 hours)
- [ ] Implement session creation and recovery
- [ ] Add auto-save functionality
- [ ] Create session cleanup logic
- [ ] Handle session expiration

## Core Implementation

### 1. Flow Engine Class

```typescript
class QuestionnaireFlowEngine implements FlowEngine {
  private questionnaire: Questionnaire
  private state: FlowState
  private conditionalEngine: ConditionalLogicEngine
  private storage: StorageService

  constructor(storage: StorageService) {
    this.storage = storage
    this.conditionalEngine = new ConditionalLogicEngine()
  }

  async start(questionnaire: Questionnaire): Promise<void> {
    this.questionnaire = questionnaire
    this.state = {
      questionnaireId: questionnaire.id,
      sessionId: this.generateSessionId(),
      currentQuestionIndex: 0,
      currentQuestionId: questionnaire.questions[0].id,
      responses: new Map(),
      visitedQuestions: new Set(),
      skippedQuestions: new Set(),
      questionHistory: [],
      isCompleted: false,
      startTime: new Date(),
      lastUpdateTime: new Date()
    }

    await this.saveState()
  }

  async next(): Promise<QuestionResult | FlowComplete> {
    const currentQuestion = this.getCurrentQuestion()
    if (!currentQuestion) {
      throw new Error('No current question available')
    }

    // Mark current question as visited
    this.state.visitedQuestions.add(currentQuestion.id)
    this.state.questionHistory.push(currentQuestion.id)

    // Find next visible question
    const nextQuestion = await this.findNextVisibleQuestion()
    
    if (!nextQuestion) {
      // Questionnaire complete
      this.state.isCompleted = true
      await this.saveState()
      return { type: 'complete', responses: this.getResponses() }
    }

    // Update state to next question
    this.state.currentQuestionId = nextQuestion.id
    this.state.currentQuestionIndex = this.findQuestionIndex(nextQuestion.id)
    this.state.lastUpdateTime = new Date()
    
    await this.saveState()
    return { type: 'question', question: nextQuestion }
  }

  async previous(): Promise<Question | null> {
    if (this.state.questionHistory.length <= 1) {
      return null // Already at first question
    }

    // Remove current question from history
    this.state.questionHistory.pop()
    
    // Get previous question
    const previousQuestionId = this.state.questionHistory[this.state.questionHistory.length - 1]
    const previousQuestion = this.findQuestionById(previousQuestionId)
    
    if (previousQuestion) {
      this.state.currentQuestionId = previousQuestion.id
      this.state.currentQuestionIndex = this.findQuestionIndex(previousQuestion.id)
      this.state.lastUpdateTime = new Date()
      await this.saveState()
    }

    return previousQuestion
  }

  getCurrentQuestion(): Question | null {
    return this.findQuestionById(this.state.currentQuestionId)
  }

  getProgress(): ProgressInfo {
    const totalQuestions = this.questionnaire.questions.length
    const answeredQuestions = this.state.responses.size
    const currentIndex = this.state.currentQuestionIndex

    return {
      currentQuestion: currentIndex + 1,
      totalQuestions,
      answeredQuestions,
      percentComplete: Math.round((answeredQuestions / totalQuestions) * 100),
      isCompleted: this.state.isCompleted
    }
  }

  async recordResponse(questionId: string, answer: any): Promise<void> {
    this.state.responses.set(questionId, answer)
    this.state.lastUpdateTime = new Date()
    await this.saveState()
  }

  private async findNextVisibleQuestion(): Promise<Question | null> {
    const currentIndex = this.state.currentQuestionIndex
    
    for (let i = currentIndex + 1; i < this.questionnaire.questions.length; i++) {
      const question = this.questionnaire.questions[i]
      
      if (await this.isQuestionVisible(question)) {
        return question
      } else {
        // Mark as skipped
        this.state.skippedQuestions.add(question.id)
      }
    }
    
    return null // No more questions
  }
}
```

### 2. Conditional Logic Engine

```typescript
class ConditionalLogicEngine {
  evaluateCondition(condition: Condition, responses: Map<string, any>): boolean {
    const response = responses.get(condition.questionId)
    
    switch (condition.operator) {
      case 'equals':
        return response === condition.value
      
      case 'notEquals':
        return response !== condition.value
      
      case 'greaterThan':
        return typeof response === 'number' && response > condition.value
      
      case 'lessThan':
        return typeof response === 'number' && response < condition.value
      
      case 'greaterThanOrEqual':
        return typeof response === 'number' && response >= condition.value
      
      case 'lessThanOrEqual':
        return typeof response === 'number' && response <= condition.value
      
      case 'contains':
        return Array.isArray(response) && response.includes(condition.value)
      
      case 'notContains':
        return !Array.isArray(response) || !response.includes(condition.value)
      
      case 'in':
        return condition.values?.includes(response) || false
      
      case 'notIn':
        return !condition.values?.includes(response) || true
      
      case 'isEmpty':
        return response === null || response === undefined || 
               response === '' || (Array.isArray(response) && response.length === 0)
      
      case 'isNotEmpty':
        return response !== null && response !== undefined && 
               response !== '' && (!Array.isArray(response) || response.length > 0)
      
      default:
        throw new Error(`Unknown condition operator: ${condition.operator}`)
    }
  }

  evaluateConditionGroup(conditions: Condition | Condition[], responses: Map<string, any>): boolean {
    if (!Array.isArray(conditions)) {
      return this.evaluateCondition(conditions, responses)
    }

    // Multiple conditions are AND-ed together
    return conditions.every(condition => this.evaluateCondition(condition, responses))
  }

  shouldShowQuestion(question: Question, responses: Map<string, any>): boolean {
    const logic = question.conditional
    if (!logic) return true

    // Check showIf condition
    if (logic.showIf) {
      const shouldShow = this.evaluateConditionGroup(logic.showIf, responses)
      if (!shouldShow) return false
    }

    // Check hideIf condition
    if (logic.hideIf) {
      const shouldHide = this.evaluateConditionGroup(logic.hideIf, responses)
      if (shouldHide) return false
    }

    return true
  }

  shouldSkipQuestion(question: Question, responses: Map<string, any>): boolean {
    const logic = question.conditional
    if (!logic || !logic.skipIf) return false

    return this.evaluateConditionGroup(logic.skipIf, responses)
  }

  isQuestionRequired(question: Question, responses: Map<string, any>): boolean {
    // Base required flag
    if (question.required) return true

    // Check conditional required
    const logic = question.conditional
    if (logic?.requiredIf) {
      return this.evaluateConditionGroup(logic.requiredIf, responses)
    }

    return false
  }
}
```

### 3. Navigation Manager

```typescript
class NavigationManager {
  private flowEngine: QuestionnaireFlowEngine

  constructor(flowEngine: QuestionnaireFlowEngine) {
    this.flowEngine = flowEngine
  }

  async handleNavigation(action: NavigationAction): Promise<NavigationResult> {
    switch (action.type) {
      case 'next':
        return await this.handleNext(action.answer)
      
      case 'previous':
        return await this.handlePrevious()
      
      case 'skip':
        return await this.handleSkip()
      
      case 'jumpTo':
        return await this.handleJumpTo(action.questionId!)
      
      case 'exit':
        return await this.handleExit()
      
      default:
        throw new Error(`Unknown navigation action: ${action.type}`)
    }
  }

  private async handleNext(answer?: any): Promise<NavigationResult> {
    const currentQuestion = this.flowEngine.getCurrentQuestion()
    if (!currentQuestion) {
      throw new Error('No current question')
    }

    // Record answer if provided
    if (answer !== undefined) {
      await this.flowEngine.recordResponse(currentQuestion.id, answer)
    }

    // Move to next question
    const result = await this.flowEngine.next()
    
    return {
      success: true,
      result
    }
  }

  private async handlePrevious(): Promise<NavigationResult> {
    const previousQuestion = await this.flowEngine.previous()
    
    if (!previousQuestion) {
      return {
        success: false,
        error: 'Already at the first question'
      }
    }

    return {
      success: true,
      result: { type: 'question', question: previousQuestion }
    }
  }

  private async handleSkip(): Promise<NavigationResult> {
    // Skip current question and move to next
    const result = await this.flowEngine.next()
    
    return {
      success: true,
      result
    }
  }
}
```

### 4. Session Management

```typescript
class SessionManager {
  private storage: StorageService
  private autoSaveInterval: NodeJS.Timeout | null = null

  constructor(storage: StorageService) {
    this.storage = storage
  }

  async createSession(questionnaireId: string): Promise<string> {
    const sessionId = this.generateSessionId()
    const sessionData: SessionData = {
      id: sessionId,
      questionnaireId,
      createdAt: new Date(),
      lastActivityAt: new Date(),
      status: 'active'
    }

    await this.storage.saveSession(sessionId, sessionData)
    return sessionId
  }

  async saveSessionState(sessionId: string, state: FlowState): Promise<void> {
    const sessionData = await this.storage.loadSession(sessionId)
    sessionData.state = state
    sessionData.lastActivityAt = new Date()
    
    await this.storage.saveSession(sessionId, sessionData)
  }

  async loadSessionState(sessionId: string): Promise<FlowState | null> {
    try {
      const sessionData = await this.storage.loadSession(sessionId)
      return sessionData.state || null
    } catch (error) {
      return null
    }
  }

  startAutoSave(sessionId: string, state: () => FlowState): void {
    this.autoSaveInterval = setInterval(async () => {
      await this.saveSessionState(sessionId, state())
    }, 30000) // Auto-save every 30 seconds
  }

  stopAutoSave(): void {
    if (this.autoSaveInterval) {
      clearInterval(this.autoSaveInterval)
      this.autoSaveInterval = null
    }
  }

  async cleanupExpiredSessions(): Promise<void> {
    // Implementation for cleaning up old sessions
    const cutoffDate = new Date(Date.now() - 24 * 60 * 60 * 1000) // 24 hours ago
    // Logic to remove sessions older than cutoff
  }

  private generateSessionId(): string {
    return `session_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
  }
}
```

## File Structure
```
src/core/
├── flow/
│   ├── flow-engine.ts              # Main flow engine
│   ├── conditional-logic.ts        # Conditional logic engine
│   ├── navigation-manager.ts       # Navigation handling
│   ├── session-manager.ts          # Session management
│   └── progress-tracker.ts         # Progress tracking
├── types/
│   ├── flow-types.ts              # Flow engine types
│   ├── navigation-types.ts        # Navigation types
│   └── session-types.ts           # Session types
└── utils/
    ├── condition-evaluator.ts     # Condition evaluation utilities
    └── flow-helpers.ts            # Flow helper functions
```

## Error Handling

### Flow Errors
```typescript
class FlowError extends Error {
  constructor(
    message: string,
    public code: FlowErrorCode,
    public context?: any
  ) {
    super(message)
    this.name = 'FlowError'
  }
}

enum FlowErrorCode {
  QUESTION_NOT_FOUND = 'QUESTION_NOT_FOUND',
  INVALID_NAVIGATION = 'INVALID_NAVIGATION',
  CONDITION_ERROR = 'CONDITION_ERROR',
  SESSION_ERROR = 'SESSION_ERROR',
  STATE_CORRUPTION = 'STATE_CORRUPTION'
}
```

### Recovery Strategies
- Auto-recovery from corrupted state
- Fallback to previous known good state
- Graceful degradation for condition errors
- User notification of recoverable errors

## Testing Requirements

### Unit Tests
- Flow engine state management
- Conditional logic evaluation
- Navigation edge cases
- Session persistence

### Integration Tests
- Complete questionnaire flows
- Complex conditional scenarios
- Session recovery testing
- Error recovery testing

## Performance Considerations

### Optimization Strategies
- Lazy evaluation of conditions
- Efficient state serialization
- Minimal DOM updates for progress
- Debounced auto-save operations

### Memory Management
- Cleanup of completed sessions
- Efficient response storage
- Garbage collection of unused data

## Acceptance Criteria
- [ ] Sequential question flow works correctly
- [ ] Conditional logic handles all operators
- [ ] Navigation (forward/backward/skip) functions properly
- [ ] Session persistence works across app restarts
- [ ] Progress tracking is accurate
- [ ] Complex conditional scenarios are handled
- [ ] Error recovery works for all error types
- [ ] Performance is acceptable for large questionnaires
- [ ] State management is consistent and reliable
- [ ] All edge cases are handled gracefully

## Dependencies
- Storage service (from Phase 1)
- Schema types (from Phase 1)
- UUID generation
- Date/time utilities

