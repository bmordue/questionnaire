# Phase 2 Task 4: Implement Response Persistence

## Overview
Develop a robust response persistence system that saves questionnaire responses with metadata, supports session recovery, handles data integrity, and provides efficient storage and retrieval mechanisms.

## Goals
- Save responses with comprehensive metadata
- Support incremental and final response persistence
- Enable session recovery and continuation
- Ensure data integrity and consistency
- Provide efficient querying and export capabilities

## Technical Approach

### 1. Response Storage Architecture

#### Response Data Structure
```typescript
interface QuestionnaireResponse {
  id: string                           // Unique response ID
  questionnaireId: string              // Reference to questionnaire
  sessionId: string                    // Session identifier
  responses: ResponseAnswers           // Question answers
  metadata: ResponseMetadata           // Response metadata
  progress: ProgressInformation        // Completion status
  version: string                      // Response schema version
}

interface ResponseAnswers {
  [questionId: string]: {
    value: any                         // Answer value
    timestamp: Date                    // When answered
    duration: number                   // Time spent on question (ms)
    attempts: number                   // Number of attempts/edits
    skipped: boolean                   // Whether question was skipped
  }
}

interface ResponseMetadata {
  startedAt: Date                      // Session start time
  lastSavedAt: Date                    // Last save timestamp  
  completedAt?: Date                   // Completion timestamp
  totalDuration?: number               // Total time spent (ms)
  userAgent?: string                   // Browser/environment info
  ipAddress?: string                   // Client IP (if applicable)
  locale?: string                      // User locale
  timezone?: string                    // User timezone
}
```

#### Storage Strategy
- **Incremental saves**: Save after each question
- **Session persistence**: Maintain session state
- **Final submission**: Complete response with validation
- **Backup strategy**: Multiple save points for recovery

## Implementation Tasks

### Task 4.1: Response Data Model (4 hours)
- [x] Define response schema and types
- [x] Implement response builder class
- [x] Create response validation logic
- [x] Add response versioning support

### Task 4.2: Incremental Persistence (5 hours)
- [x] Implement auto-save functionality
- [x] Create session state management
- [x] Add conflict resolution for concurrent edits
- [x] Handle partial response storage

### Task 4.3: Response Completion (3 hours)
- [x] Implement final submission process
- [x] Add response validation and verification
- [x] Create completion metadata tracking
- [x] Handle submission error scenarios

### Task 4.4: Recovery and Querying (4 hours)
- [x] Build session recovery system
- [x] Implement response querying capabilities
- [x] Create export functionality
- [x] Add response analytics utilities

## Core Implementation

### 1. Response Builder

```typescript
class ResponseBuilder {
  private response: QuestionnaireResponse
  private storage: StorageService

  constructor(questionnaire: Questionnaire, sessionId: string, storage: StorageService) {
    this.storage = storage
    this.response = {
      id: this.generateResponseId(),
      questionnaireId: questionnaire.id,
      sessionId,
      responses: {},
      metadata: {
        startedAt: new Date(),
        lastSavedAt: new Date()
      },
      progress: {
        currentQuestionIndex: 0,
        totalQuestions: questionnaire.questions.length,
        answeredQuestions: 0,
        skippedQuestions: 0,
        percentComplete: 0,
        isCompleted: false
      },
      version: '1.0'
    }
  }

  async recordAnswer(
    questionId: string, 
    answer: any, 
    metadata: AnswerMetadata = {}
  ): Promise<void> {
    const questionResponse: QuestionResponse = {
      value: answer,
      timestamp: new Date(),
      duration: metadata.duration || 0,
      attempts: (this.response.responses[questionId]?.attempts || 0) + 1,
      skipped: false
    }

    this.response.responses[questionId] = questionResponse
    this.updateProgress()
    await this.saveIncremental()
  }

  async skipQuestion(questionId: string): Promise<void> {
    const questionResponse: QuestionResponse = {
      value: null,
      timestamp: new Date(),
      duration: 0,
      attempts: 0,
      skipped: true
    }

    this.response.responses[questionId] = questionResponse
    this.updateProgress()
    await this.saveIncremental()
  }

  async updateAnswer(
    questionId: string, 
    newAnswer: any, 
    duration: number = 0
  ): Promise<void> {
    const existingResponse = this.response.responses[questionId]
    
    if (existingResponse) {
      existingResponse.value = newAnswer
      existingResponse.timestamp = new Date()
      existingResponse.duration += duration
      existingResponse.attempts += 1
      existingResponse.skipped = false
    } else {
      await this.recordAnswer(questionId, newAnswer, { duration })
    }

    await this.saveIncremental()
  }

  async complete(): Promise<QuestionnaireResponse> {
    this.response.metadata.completedAt = new Date()
    this.response.metadata.totalDuration = this.calculateTotalDuration()
    this.response.progress.isCompleted = true
    this.response.progress.percentComplete = 100

    // Validate complete response
    const validationResult = await this.validateResponse()
    if (!validationResult.isValid) {
      throw new ResponseValidationError(
        'Response validation failed',
        validationResult.errors
      )
    }

    // Save final response
    await this.saveFinal()
    return this.response
  }

  private updateProgress(): void {
    const answeredCount = Object.values(this.response.responses)
      .filter(r => !r.skipped && r.value !== null).length
    
    const skippedCount = Object.values(this.response.responses)
      .filter(r => r.skipped).length

    this.response.progress.answeredQuestions = answeredCount
    this.response.progress.skippedQuestions = skippedCount
    this.response.progress.percentComplete = Math.round(
      (answeredCount / this.response.progress.totalQuestions) * 100
    )

    this.response.metadata.lastSavedAt = new Date()
  }

  private async saveIncremental(): Promise<void> {
    try {
      await this.storage.saveResponseIncremental(this.response)
    } catch (error) {
      // Handle save errors gracefully
      console.warn('Failed to save incremental response:', error)
    }
  }

  private async saveFinal(): Promise<void> {
    await this.storage.saveResponseFinal(this.response)
  }

  private calculateTotalDuration(): number {
    return Object.values(this.response.responses)
      .reduce((total, response) => total + response.duration, 0)
  }
}
```

### 2. Response Persistence Manager

```typescript
class ResponsePersistenceManager {
  private storage: StorageService
  private autoSaveInterval: number = 30000 // 30 seconds
  private autoSaveTimer: NodeJS.Timeout | null = null

  constructor(storage: StorageService) {
    this.storage = storage
  }

  async startSession(
    questionnaire: Questionnaire, 
    sessionId?: string
  ): Promise<ResponseSession> {
    const actualSessionId = sessionId || this.generateSessionId()
    
    // Check for existing session
    let responseBuilder: ResponseBuilder
    
    try {
      const existingResponse = await this.storage.loadResponseBySession(actualSessionId)
      responseBuilder = await this.resumeSession(existingResponse)
    } catch (error) {
      // Create new session
      responseBuilder = new ResponseBuilder(questionnaire, actualSessionId, this.storage)
    }

    // Start auto-save
    this.startAutoSave(responseBuilder)

    return {
      sessionId: actualSessionId,
      responseBuilder,
      questionnaire
    }
  }

  async resumeSession(response: QuestionnaireResponse): Promise<ResponseBuilder> {
    // Recreate response builder from saved state
    const builder = new ResponseBuilder(
      await this.storage.loadQuestionnaire(response.questionnaireId),
      response.sessionId,
      this.storage
    )

    // Restore state
    await builder.loadFromResponse(response)
    return builder
  }

  async endSession(sessionId: string): Promise<void> {
    this.stopAutoSave()
    
    // Cleanup session data if desired
    await this.storage.cleanupSession(sessionId)
  }

  async exportResponse(responseId: string, format: ExportFormat): Promise<string> {
    const response = await this.storage.loadResponse(responseId)
    
    switch (format) {
      case 'json':
        return this.exportAsJSON(response)
      case 'csv':
        return this.exportAsCSV(response)
      case 'pdf':
        return this.exportAsPDF(response)
      default:
        throw new Error(`Unsupported export format: ${format}`)
    }
  }

  private startAutoSave(responseBuilder: ResponseBuilder): void {
    this.autoSaveTimer = setInterval(() => {
      responseBuilder.saveIncremental().catch(error => {
        console.warn('Auto-save failed:', error)
      })
    }, this.autoSaveInterval)
  }

  private stopAutoSave(): void {
    if (this.autoSaveTimer) {
      clearInterval(this.autoSaveTimer)
      this.autoSaveTimer = null
    }
  }

  private exportAsJSON(response: QuestionnaireResponse): string {
    return JSON.stringify(response, null, 2)
  }

  private exportAsCSV(response: QuestionnaireResponse): string {
    const headers = ['questionId', 'answer', 'timestamp', 'duration', 'attempts', 'skipped']
    const rows = Object.entries(response.responses).map(([questionId, answer]) => [
      questionId,
      JSON.stringify(answer.value),
      answer.timestamp.toISOString(),
      answer.duration.toString(),
      answer.attempts.toString(),
      answer.skipped.toString()
    ])

    return [headers, ...rows].map(row => row.join(',')).join('\n')
  }
}
```

### 3. Response Storage Service

```typescript
class ResponseStorageService {
  private basePath: string

  constructor(basePath: string = './data/responses') {
    this.basePath = basePath
    this.ensureDirectories()
  }

  async saveResponseIncremental(response: QuestionnaireResponse): Promise<void> {
    const filePath = this.getIncrementalPath(response.sessionId)
    
    // Use atomic write with backup
    await this.atomicWrite(filePath, JSON.stringify(response, null, 2))
    
    // Update session index
    await this.updateSessionIndex(response)
  }

  async saveResponseFinal(response: QuestionnaireResponse): Promise<void> {
    const filePath = this.getFinalPath(response.id)
    
    // Save final response
    await this.atomicWrite(filePath, JSON.stringify(response, null, 2))
    
    // Create backup
    await this.createBackup(response)
    
    // Update response index
    await this.updateResponseIndex(response)
    
    // Cleanup incremental saves
    await this.cleanupIncremental(response.sessionId)
  }

  async loadResponseBySession(sessionId: string): Promise<QuestionnaireResponse> {
    const filePath = this.getIncrementalPath(sessionId)
    
    if (!await this.fileExists(filePath)) {
      throw new Error(`No session found: ${sessionId}`)
    }

    const content = await fs.readFile(filePath, 'utf-8')
    return JSON.parse(content)
  }

  async loadResponse(responseId: string): Promise<QuestionnaireResponse> {
    const filePath = this.getFinalPath(responseId)
    
    if (!await this.fileExists(filePath)) {
      throw new Error(`Response not found: ${responseId}`)
    }

    const content = await fs.readFile(filePath, 'utf-8')
    return JSON.parse(content)
  }

  async queryResponses(criteria: ResponseQueryCriteria): Promise<QuestionnaireResponse[]> {
    const index = await this.loadResponseIndex()
    let filteredResponses = index.responses

    // Apply filters
    if (criteria.questionnaireId) {
      filteredResponses = filteredResponses.filter(
        r => r.questionnaireId === criteria.questionnaireId
      )
    }

    if (criteria.dateRange) {
      filteredResponses = filteredResponses.filter(r => {
        const date = new Date(r.completedAt)
        return date >= criteria.dateRange!.start && date <= criteria.dateRange!.end
      })
    }

    if (criteria.completed !== undefined) {
      filteredResponses = filteredResponses.filter(
        r => r.isCompleted === criteria.completed
      )
    }

    // Apply pagination
    const start = (criteria.page || 0) * (criteria.pageSize || 10)
    const end = start + (criteria.pageSize || 10)
    const paginatedResponses = filteredResponses.slice(start, end)

    // Load full response data
    const responses = await Promise.all(
      paginatedResponses.map(meta => this.loadResponse(meta.id))
    )

    return responses
  }

  private async atomicWrite(filePath: string, content: string): Promise<void> {
    const tempPath = `${filePath}.tmp`
    
    try {
      await fs.writeFile(tempPath, content, 'utf-8')
      await fs.rename(tempPath, filePath)
    } catch (error) {
      // Cleanup temp file if it exists
      try {
        await fs.unlink(tempPath)
      } catch {}
      throw error
    }
  }

  private async updateSessionIndex(response: QuestionnaireResponse): Promise<void> {
    const indexPath = path.join(this.basePath, 'sessions', 'index.json')
    
    let index: SessionIndex
    try {
      const content = await fs.readFile(indexPath, 'utf-8')
      index = JSON.parse(content)
    } catch {
      index = { sessions: [] }
    }

    // Update or add session
    const existingIndex = index.sessions.findIndex(s => s.sessionId === response.sessionId)
    const sessionMeta: SessionMetadata = {
      sessionId: response.sessionId,
      questionnaireId: response.questionnaireId,
      lastSavedAt: response.metadata.lastSavedAt,
      isCompleted: response.progress.isCompleted,
      percentComplete: response.progress.percentComplete
    }

    if (existingIndex >= 0) {
      index.sessions[existingIndex] = sessionMeta
    } else {
      index.sessions.push(sessionMeta)
    }

    await this.atomicWrite(indexPath, JSON.stringify(index, null, 2))
  }

  private getIncrementalPath(sessionId: string): string {
    return path.join(this.basePath, 'sessions', `${sessionId}.json`)
  }

  private getFinalPath(responseId: string): string {
    return path.join(this.basePath, 'final', `${responseId}.json`)
  }
}
```

### 4. Response Analytics

```typescript
class ResponseAnalytics {
  constructor(private storage: ResponseStorageService) {}

  async getCompletionStats(questionnaireId: string): Promise<CompletionStats> {
    const responses = await this.storage.queryResponses({ questionnaireId })
    
    const total = responses.length
    const completed = responses.filter(r => r.progress.isCompleted).length
    const averageTime = this.calculateAverageCompletionTime(
      responses.filter(r => r.progress.isCompleted)
    )

    return {
      totalResponses: total,
      completedResponses: completed,
      completionRate: total > 0 ? (completed / total) * 100 : 0,
      averageCompletionTime: averageTime,
      abandonmentRate: total > 0 ? ((total - completed) / total) * 100 : 0
    }
  }

  async getQuestionStats(questionnaireId: string, questionId: string): Promise<QuestionStats> {
    const responses = await this.storage.queryResponses({ questionnaireId })
    const answeredResponses = responses.filter(
      r => r.responses[questionId] && !r.responses[questionId].skipped
    )

    const values = answeredResponses.map(r => r.responses[questionId].value)
    const attempts = answeredResponses.map(r => r.responses[questionId].attempts)
    const durations = answeredResponses.map(r => r.responses[questionId].duration)

    return {
      questionId,
      totalResponses: responses.length,
      answeredCount: answeredResponses.length,
      skippedCount: responses.length - answeredResponses.length,
      averageAttempts: attempts.length > 0 ? attempts.reduce((a, b) => a + b, 0) / attempts.length : 0,
      averageDuration: durations.length > 0 ? durations.reduce((a, b) => a + b, 0) / durations.length : 0,
      responseDistribution: this.analyzeResponseDistribution(values)
    }
  }

  private calculateAverageCompletionTime(responses: QuestionnaireResponse[]): number {
    if (responses.length === 0) return 0

    const totalTime = responses.reduce((sum, response) => {
      const startTime = new Date(response.metadata.startedAt).getTime()
      const endTime = new Date(response.metadata.completedAt!).getTime()
      return sum + (endTime - startTime)
    }, 0)

    return totalTime / responses.length
  }

  private analyzeResponseDistribution(values: any[]): ResponseDistribution {
    const distribution: { [key: string]: number } = {}
    
    values.forEach(value => {
      const key = JSON.stringify(value)
      distribution[key] = (distribution[key] || 0) + 1
    })

    const total = values.length
    const distributionWithPercentages = Object.entries(distribution).map(([value, count]) => ({
      value: JSON.parse(value),
      count,
      percentage: (count / total) * 100
    }))

    return {
      totalResponses: total,
      uniqueValues: Object.keys(distribution).length,
      distribution: distributionWithPercentages
    }
  }
}
```

## File Structure
```
src/core/
├── persistence/
│   ├── response-builder.ts         # Response building and tracking
│   ├── persistence-manager.ts      # Main persistence coordinator
│   ├── storage-service.ts          # Response storage operations
│   ├── recovery-service.ts         # Session recovery functionality
│   └── export-service.ts           # Response export utilities
├── analytics/
│   ├── response-analytics.ts       # Response analysis tools
│   ├── completion-stats.ts         # Completion statistics
│   └── question-stats.ts           # Question-level analytics
└── types/
    ├── response-types.ts           # Response data types
    ├── persistence-types.ts        # Persistence-related types
    └── analytics-types.ts          # Analytics types
```

## Data Recovery and Backup

### Recovery Strategies
```typescript
class ResponseRecoveryService {
  async recoverFromCorruption(sessionId: string): Promise<QuestionnaireResponse | null> {
    // Try backup files
    const backupPaths = await this.getBackupPaths(sessionId)
    
    for (const backupPath of backupPaths) {
      try {
        const response = await this.loadAndValidateResponse(backupPath)
        if (response) {
          console.log(`Recovered from backup: ${backupPath}`)
          return response
        }
      } catch (error) {
        continue // Try next backup
      }
    }

    return null
  }

  async createEmergencyBackup(response: QuestionnaireResponse): Promise<void> {
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-')
    const backupPath = `./data/emergency-backups/${response.sessionId}-${timestamp}.json`
    
    await fs.writeFile(backupPath, JSON.stringify(response, null, 2))
  }
}
```

## Testing Requirements

### Unit Tests
- Response builder functionality
- Persistence operations
- Recovery scenarios
- Export functionality

### Integration Tests
- End-to-end response saving
- Session recovery across restarts
- Concurrent access scenarios
- Data corruption recovery

### Performance Tests
- Large response handling
- Auto-save performance
- Query performance with many responses

## Acceptance Criteria
- [x] Responses are saved incrementally during questionnaire
- [x] Session recovery works reliably across app restarts
- [x] Final submission process validates and saves correctly
- [x] Data integrity is maintained under all conditions
- [x] Export functionality works for all supported formats
- [x] Analytics provide meaningful insights
- [x] Performance is acceptable for expected load
- [x] Error scenarios are handled gracefully
- [x] Backup and recovery systems work effectively
- [x] Storage is efficient and well-organized

## Dependencies
- Node.js fs/promises (file operations)
- Path utilities
- JSON validation libraries
- Date/time utilities
- CSV/PDF export libraries

