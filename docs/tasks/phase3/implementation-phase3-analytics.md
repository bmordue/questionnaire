# Phase 3 Task 2: Response Viewing and Analytics

## Overview
Develop comprehensive response viewing and analytics capabilities that allow users to examine questionnaire responses, generate insights, and understand response patterns and trends.

## Goals
- Provide detailed response viewing with filtering and search
- Generate meaningful analytics and statistics
- Support data visualization and reporting
- Enable response comparison and trend analysis
- Offer export capabilities for further analysis

## Technical Approach

### 1. Response Viewing Architecture

#### Data Access Layer
```typescript
interface ResponseViewingService {
  getResponses(criteria: ResponseCriteria): Promise<ResponseList>
  getResponse(responseId: string): Promise<DetailedResponse>
  searchResponses(query: SearchQuery): Promise<ResponseList>
  getResponseSummary(responseId: string): Promise<ResponseSummary>
  compareResponses(responseIds: string[]): Promise<ResponseComparison>
}
```

#### Analytics Engine
```typescript
interface AnalyticsEngine {
  generateQuestionnaireStats(questionnaireId: string): Promise<QuestionnaireAnalytics>
  generateQuestionStats(questionnaireId: string, questionId: string): Promise<QuestionAnalytics>
  generateCompletionAnalytics(questionnaireId: string): Promise<CompletionAnalytics>
  generateTrendAnalysis(questionnaireId: string, timeRange: TimeRange): Promise<TrendAnalysis>
  generateCohortAnalysis(questionnaireId: string, cohortDefinition: CohortDefinition): Promise<CohortAnalysis>
}
```

## Implementation Tasks

### Task 2.1: Response Data Access (4 hours)
- [ ] Build response querying and filtering system
- [ ] Implement search functionality across responses
- [ ] Create response aggregation utilities
- [ ] Add response comparison capabilities

### Task 2.2: Analytics Engine (6 hours)
- [ ] Implement statistical analysis functions
- [ ] Create completion rate analytics
- [ ] Build question-level analytics
- [ ] Add trend analysis capabilities

### Task 2.3: Visualization Components (5 hours)
- [ ] Create response summary displays
- [ ] Build statistical charts and graphs
- [ ] Implement interactive data exploration
- [ ] Add responsive design for different screens

### Task 2.4: Export and Reporting (3 hours)
- [ ] Implement multiple export formats
- [ ] Create automated report generation
- [ ] Add scheduled reporting capabilities
- [ ] Build sharing and collaboration features

## Core Implementation

### 1. Response Viewing Service

```typescript
class ResponseViewingService {
  constructor(private storage: ResponseStorageService) {}

  async getResponses(criteria: ResponseCriteria): Promise<ResponseList> {
    const responses = await this.storage.queryResponses(criteria)
    
    return {
      responses: responses.map(r => this.createResponseSummary(r)),
      totalCount: responses.length,
      page: criteria.page || 0,
      pageSize: criteria.pageSize || 20,
      hasMore: responses.length === criteria.pageSize
    }
  }

  async getResponse(responseId: string): Promise<DetailedResponse> {
    const response = await this.storage.loadResponse(responseId)
    const questionnaire = await this.storage.loadQuestionnaire(response.questionnaireId)
    
    return {
      response,
      questionnaire,
      enrichedAnswers: this.enrichAnswers(response, questionnaire),
      metadata: this.calculateMetadata(response),
      analytics: await this.calculateResponseAnalytics(response)
    }
  }

  async searchResponses(query: SearchQuery): Promise<ResponseList> {
    const criteria: ResponseCriteria = {
      questionnaireId: query.questionnaireId,
      textSearch: query.text,
      answerFilters: query.answerFilters,
      dateRange: query.dateRange,
      completionStatus: query.completionStatus,
      page: query.page,
      pageSize: query.pageSize
    }

    const responses = await this.storage.queryResponses(criteria)
    const filteredResponses = this.applyAdvancedFilters(responses, query)

    return {
      responses: filteredResponses.map(r => this.createResponseSummary(r)),
      totalCount: filteredResponses.length,
      searchQuery: query,
      page: query.page || 0,
      pageSize: query.pageSize || 20
    }
  }

  async compareResponses(responseIds: string[]): Promise<ResponseComparison> {
    const responses = await Promise.all(
      responseIds.map(id => this.storage.loadResponse(id))
    )

    const questionnaire = await this.storage.loadQuestionnaire(responses[0].questionnaireId)

    return {
      responses,
      questionnaire,
      comparison: this.generateComparison(responses, questionnaire),
      similarities: this.findSimilarities(responses),
      differences: this.findDifferences(responses, questionnaire)
    }
  }

  private enrichAnswers(
    response: QuestionnaireResponse, 
    questionnaire: Questionnaire
  ): EnrichedAnswer[] {
    return questionnaire.questions.map(question => {
      const answer = response.responses[question.id]
      
      return {
        question,
        answer: answer || null,
        displayValue: this.formatAnswerForDisplay(answer?.value, question),
        metadata: answer ? {
          timestamp: answer.timestamp,
          duration: answer.duration,
          attempts: answer.attempts,
          skipped: answer.skipped
        } : null
      }
    })
  }

  private formatAnswerForDisplay(value: any, question: Question): string {
    if (value === null || value === undefined) {
      return 'No answer'
    }

    switch (question.type) {
      case 'single_choice':
      case 'multiple_choice':
        return Array.isArray(value) ? value.join(', ') : value

      case 'boolean':
        return value ? 'Yes' : 'No'

      case 'date':
        return new Date(value).toLocaleDateString()

      case 'rating':
        const min = question.validation?.min || 1
        const max = question.validation?.max || 5
        return `${value}/${max}`

      default:
        return String(value)
    }
  }
}
```

### 2. Analytics Engine

```typescript
class AnalyticsEngine {
  constructor(
    private storage: ResponseStorageService,
    private statisticsCalculator: StatisticsCalculator
  ) {}

  async generateQuestionnaireStats(questionnaireId: string): Promise<QuestionnaireAnalytics> {
    const responses = await this.storage.queryResponses({ questionnaireId })
    const questionnaire = await this.storage.loadQuestionnaire(questionnaireId)

    const completedResponses = responses.filter(r => r.progress.isCompleted)
    const totalResponses = responses.length

    return {
      questionnaireId,
      totalResponses,
      completedResponses: completedResponses.length,
      completionRate: totalResponses > 0 ? (completedResponses.length / totalResponses) * 100 : 0,
      averageCompletionTime: this.calculateAverageCompletionTime(completedResponses),
      abandonmentRate: totalResponses > 0 ? ((totalResponses - completedResponses.length) / totalResponses) * 100 : 0,
      responsesByDate: this.groupResponsesByDate(responses),
      questionStats: await this.generateAllQuestionStats(questionnaire, responses),
      topAbandonmentPoints: this.findAbandonmentPoints(responses, questionnaire)
    }
  }

  async generateQuestionStats(
    questionnaireId: string, 
    questionId: string
  ): Promise<QuestionAnalytics> {
    const responses = await this.storage.queryResponses({ questionnaireId })
    const questionnaire = await this.storage.loadQuestionnaire(questionnaireId)
    const question = questionnaire.questions.find(q => q.id === questionId)

    if (!question) {
      throw new Error(`Question not found: ${questionId}`)
    }

    const answeredResponses = responses.filter(
      r => r.responses[questionId] && !r.responses[questionId].skipped
    )

    const answers = answeredResponses.map(r => r.responses[questionId].value)
    const durations = answeredResponses.map(r => r.responses[questionId].duration)
    const attempts = answeredResponses.map(r => r.responses[questionId].attempts)

    return {
      questionId,
      question,
      totalResponses: responses.length,
      answeredCount: answeredResponses.length,
      skippedCount: responses.length - answeredResponses.length,
      answerRate: responses.length > 0 ? (answeredResponses.length / responses.length) * 100 : 0,
      averageDuration: this.statisticsCalculator.mean(durations),
      medianDuration: this.statisticsCalculator.median(durations),
      averageAttempts: this.statisticsCalculator.mean(attempts),
      answerDistribution: this.calculateAnswerDistribution(answers, question),
      statisticalAnalysis: this.generateStatisticalAnalysis(answers, question)
    }
  }

  async generateCompletionAnalytics(questionnaireId: string): Promise<CompletionAnalytics> {
    const responses = await this.storage.queryResponses({ questionnaireId })
    const questionnaire = await this.storage.loadQuestionnaire(questionnaireId)

    const completionByQuestion = this.calculateCompletionByQuestion(responses, questionnaire)
    const dropoffPoints = this.identifyDropoffPoints(completionByQuestion)
    const completionPaths = this.analyzeCompletionPaths(responses, questionnaire)

    return {
      questionnaireId,
      totalStarted: responses.length,
      totalCompleted: responses.filter(r => r.progress.isCompleted).length,
      completionByQuestion,
      dropoffPoints,
      completionPaths,
      averageQuestionsAnswered: this.calculateAverageQuestionsAnswered(responses),
      completionTimeDistribution: this.calculateCompletionTimeDistribution(responses)
    }
  }

  async generateTrendAnalysis(
    questionnaireId: string, 
    timeRange: TimeRange
  ): Promise<TrendAnalysis> {
    const responses = await this.storage.queryResponses({
      questionnaireId,
      dateRange: timeRange
    })

    const timeSeriesData = this.createTimeSeriesData(responses, timeRange.granularity)
    const trends = this.calculateTrends(timeSeriesData)

    return {
      questionnaireId,
      timeRange,
      responseVolumeTrend: trends.volume,
      completionRateTrend: trends.completionRate,
      averageTimeTrend: trends.averageTime,
      abandonmentTrend: trends.abandonment,
      seasonalPatterns: this.identifySeasonalPatterns(timeSeriesData),
      anomalies: this.detectAnomalies(timeSeriesData)
    }
  }

  private calculateAnswerDistribution(answers: any[], question: Question): AnswerDistribution {
    const distribution = new Map<string, number>()
    const total = answers.length

    answers.forEach(answer => {
      const key = this.getDistributionKey(answer, question)
      distribution.set(key, (distribution.get(key) || 0) + 1)
    })

    const distributionArray = Array.from(distribution.entries()).map(([value, count]) => ({
      value,
      count,
      percentage: (count / total) * 100
    }))

    return {
      total,
      distribution: distributionArray.sort((a, b) => b.count - a.count),
      uniqueValues: distribution.size,
      mostCommon: distributionArray[0]?.value || null,
      leastCommon: distributionArray[distributionArray.length - 1]?.value || null
    }
  }

  private generateStatisticalAnalysis(answers: any[], question: Question): StatisticalAnalysis {
    if (question.type === 'number' || question.type === 'rating') {
      const numericAnswers = answers.filter(a => typeof a === 'number')
      
      return {
        type: 'numeric',
        count: numericAnswers.length,
        mean: this.statisticsCalculator.mean(numericAnswers),
        median: this.statisticsCalculator.median(numericAnswers),
        mode: this.statisticsCalculator.mode(numericAnswers),
        standardDeviation: this.statisticsCalculator.standardDeviation(numericAnswers),
        min: Math.min(...numericAnswers),
        max: Math.max(...numericAnswers),
        quartiles: this.statisticsCalculator.quartiles(numericAnswers),
        outliers: this.statisticsCalculator.findOutliers(numericAnswers)
      }
    }

    if (question.type === 'text' || question.type === 'email') {
      const textAnswers = answers.filter(a => typeof a === 'string')
      const lengths = textAnswers.map(a => a.length)
      
      return {
        type: 'text',
        count: textAnswers.length,
        averageLength: this.statisticsCalculator.mean(lengths),
        medianLength: this.statisticsCalculator.median(lengths),
        minLength: Math.min(...lengths),
        maxLength: Math.max(...lengths),
        commonWords: this.extractCommonWords(textAnswers),
        sentiment: this.analyzeSentiment(textAnswers)
      }
    }

    return {
      type: 'categorical',
      count: answers.length,
      uniqueValues: new Set(answers).size,
      distribution: this.calculateAnswerDistribution(answers, question)
    }
  }
}
```

### 3. Visualization Components

```typescript
class VisualizationRenderer {
  renderResponseSummary(response: QuestionnaireResponse): string {
    const output: string[] = []
    
    output.push(chalk.bold.blue(`Response Summary: ${response.id}`))
    output.push(`Questionnaire: ${response.questionnaireId}`)
    output.push(`Started: ${new Date(response.metadata.startedAt).toLocaleString()}`)
    
    if (response.metadata.completedAt) {
      output.push(`Completed: ${new Date(response.metadata.completedAt).toLocaleString()}`)
      output.push(`Duration: ${this.formatDuration(response.metadata.totalDuration || 0)}`)
    } else {
      output.push(chalk.yellow('Status: Incomplete'))
    }

    output.push(`Progress: ${response.progress.percentComplete}% (${response.progress.answeredQuestions}/${response.progress.totalQuestions} questions)`)

    return output.join('\n')
  }

  renderQuestionnaireAnalytics(analytics: QuestionnaireAnalytics): string {
    const output: string[] = []

    output.push(chalk.bold.green('Questionnaire Analytics'))
    output.push('=' * 50)
    output.push(`Total Responses: ${analytics.totalResponses}`)
    output.push(`Completed: ${analytics.completedResponses} (${analytics.completionRate.toFixed(1)}%)`)
    output.push(`Average Completion Time: ${this.formatDuration(analytics.averageCompletionTime)}`)
    output.push(`Abandonment Rate: ${analytics.abandonmentRate.toFixed(1)}%`)

    if (analytics.topAbandonmentPoints.length > 0) {
      output.push('\nTop Abandonment Points:')
      analytics.topAbandonmentPoints.slice(0, 5).forEach((point, index) => {
        output.push(`  ${index + 1}. ${point.questionId}: ${point.abandonmentRate.toFixed(1)}%`)
      })
    }

    return output.join('\n')
  }

  renderQuestionAnalytics(analytics: QuestionAnalytics): string {
    const output: string[] = []

    output.push(chalk.bold.yellow(`Question Analytics: ${analytics.question.text}`))
    output.push('=' * 60)
    output.push(`Response Rate: ${analytics.answerRate.toFixed(1)}% (${analytics.answeredCount}/${analytics.totalResponses})`)
    output.push(`Average Time: ${this.formatDuration(analytics.averageDuration)}`)
    output.push(`Average Attempts: ${analytics.averageAttempts.toFixed(1)}`)

    // Show distribution
    output.push('\nAnswer Distribution:')
    analytics.answerDistribution.distribution.slice(0, 10).forEach(item => {
      const bar = '█'.repeat(Math.round(item.percentage / 5))
      output.push(`  ${item.value}: ${item.count} (${item.percentage.toFixed(1)}%) ${bar}`)
    })

    // Show statistical analysis for numeric questions
    if (analytics.statisticalAnalysis.type === 'numeric') {
      const stats = analytics.statisticalAnalysis as NumericStatistics
      output.push('\nStatistical Analysis:')
      output.push(`  Mean: ${stats.mean.toFixed(2)}`)
      output.push(`  Median: ${stats.median.toFixed(2)}`)
      output.push(`  Standard Deviation: ${stats.standardDeviation.toFixed(2)}`)
      output.push(`  Range: ${stats.min} - ${stats.max}`)
    }

    return output.join('\n')
  }

  renderCompletionChart(analytics: CompletionAnalytics): string {
    const output: string[] = []

    output.push(chalk.bold.cyan('Completion Funnel'))
    output.push('=' * 40)

    const maxWidth = 50
    const maxResponses = Math.max(...analytics.completionByQuestion.map(c => c.responseCount))

    analytics.completionByQuestion.forEach((completion, index) => {
      const width = Math.round((completion.responseCount / maxResponses) * maxWidth)
      const bar = '█'.repeat(width)
      const percentage = (completion.responseCount / analytics.totalStarted * 100).toFixed(1)
      
      output.push(`Q${index + 1}: ${bar} ${completion.responseCount} (${percentage}%)`)
    })

    return output.join('\n')
  }

  private formatDuration(milliseconds: number): string {
    const seconds = Math.floor(milliseconds / 1000)
    const minutes = Math.floor(seconds / 60)
    const hours = Math.floor(minutes / 60)

    if (hours > 0) {
      return `${hours}h ${minutes % 60}m ${seconds % 60}s`
    } else if (minutes > 0) {
      return `${minutes}m ${seconds % 60}s`
    } else {
      return `${seconds}s`
    }
  }
}
```

### 4. Export Service

```typescript
class ResponseExportService {
  async exportResponses(
    questionnaireId: string, 
    format: ExportFormat, 
    options: ExportOptions = {}
  ): Promise<string> {
    const responses = await this.storage.queryResponses({
      questionnaireId,
      ...options.filters
    })

    const questionnaire = await this.storage.loadQuestionnaire(questionnaireId)

    switch (format) {
      case 'csv':
        return this.exportAsCSV(responses, questionnaire, options)
      case 'json':
        return this.exportAsJSON(responses, questionnaire, options)
      case 'excel':
        return this.exportAsExcel(responses, questionnaire, options)
      case 'pdf':
        return this.exportAsPDF(responses, questionnaire, options)
      default:
        throw new Error(`Unsupported export format: ${format}`)
    }
  }

  async generateReport(
    questionnaireId: string, 
    reportType: ReportType
  ): Promise<string> {
    const analytics = await this.analyticsEngine.generateQuestionnaireStats(questionnaireId)

    switch (reportType) {
      case 'summary':
        return this.generateSummaryReport(analytics)
      case 'detailed':
        return this.generateDetailedReport(analytics)
      case 'executive':
        return this.generateExecutiveReport(analytics)
      default:
        throw new Error(`Unknown report type: ${reportType}`)
    }
  }

  private exportAsCSV(
    responses: QuestionnaireResponse[], 
    questionnaire: Questionnaire, 
    options: ExportOptions
  ): string {
    const headers = ['ResponseID', 'StartTime', 'CompletionTime', 'Duration']
    
    // Add question headers
    questionnaire.questions.forEach(question => {
      headers.push(question.id)
      if (options.includeMetadata) {
        headers.push(`${question.id}_Duration`)
        headers.push(`${question.id}_Attempts`)
      }
    })

    const rows = responses.map(response => {
      const row = [
        response.id,
        response.metadata.startedAt,
        response.metadata.completedAt || '',
        response.metadata.totalDuration || ''
      ]

      questionnaire.questions.forEach(question => {
        const answer = response.responses[question.id]
        row.push(answer ? this.formatAnswerForCSV(answer.value) : '')
        
        if (options.includeMetadata && answer) {
          row.push(answer.duration.toString())
          row.push(answer.attempts.toString())
        }
      })

      return row
    })

    return [headers, ...rows].map(row => 
      row.map(cell => `"${String(cell).replace(/"/g, '""')}"`).join(',')
    ).join('\n')
  }

  private formatAnswerForCSV(value: any): string {
    if (Array.isArray(value)) {
      return value.join('; ')
    }
    return String(value)
  }
}
```

## File Structure
```
src/analytics/
├── viewing/
│   ├── response-viewer.ts          # Response viewing service
│   ├── search-service.ts           # Response search functionality
│   ├── comparison-service.ts       # Response comparison
│   └── enrichment-service.ts       # Data enrichment
├── analytics/
│   ├── analytics-engine.ts         # Main analytics engine
│   ├── statistics-calculator.ts    # Statistical calculations
│   ├── trend-analyzer.ts           # Trend analysis
│   └── cohort-analyzer.ts          # Cohort analysis
├── visualization/
│   ├── chart-renderer.ts           # Chart rendering
│   ├── table-renderer.ts           # Table rendering
│   ├── summary-renderer.ts         # Summary displays
│   └── visualization-utils.ts      # Visualization utilities
├── export/
│   ├── export-service.ts           # Main export service
│   ├── csv-exporter.ts             # CSV export
│   ├── json-exporter.ts            # JSON export
│   ├── pdf-exporter.ts             # PDF export
│   └── report-generator.ts         # Report generation
└── types/
    ├── analytics-types.ts          # Analytics type definitions
    ├── visualization-types.ts      # Visualization types
    └── export-types.ts             # Export types
```

## Testing Requirements

### Unit Tests
- Analytics calculation accuracy
- Export format correctness
- Visualization rendering
- Search functionality

### Integration Tests
- End-to-end analytics workflows
- Export with large datasets
- Real-time analytics updates

### Performance Tests
- Large dataset handling
- Export performance
- Visualization rendering speed

## Acceptance Criteria
- [ ] Response viewing supports filtering and pagination
- [ ] Analytics provide meaningful insights
- [ ] Statistical calculations are accurate
- [ ] Visualizations are clear and informative
- [ ] Export functionality works for all formats
- [ ] Search capabilities are comprehensive
- [ ] Performance is acceptable for large datasets
- [ ] Reports are well-formatted and useful
- [ ] Comparison features work correctly
- [ ] Trend analysis provides valuable insights

## Dependencies
- Statistical calculation libraries
- Chart rendering libraries (ASCII charts for CLI)
- CSV/Excel processing libraries
- PDF generation libraries
- Date/time utilities

