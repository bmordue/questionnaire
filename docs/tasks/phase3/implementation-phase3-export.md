# Phase 3 Task 3: Export Functionality

## Overview
Develop comprehensive export functionality that allows users to export questionnaire responses, analytics, and reports in multiple formats for external analysis, sharing, and archival purposes.

## Goals
- Support multiple export formats (JSON, CSV, Excel, PDF)
- Enable flexible data selection and filtering
- Provide customizable export templates and layouts
- Support batch exports and scheduled exports
- Ensure data integrity and security in exports

## Technical Approach

### 1. Export Architecture

#### Export Service Interface
```typescript
interface ExportService {
  exportResponses(criteria: ExportCriteria): Promise<ExportResult>
  exportAnalytics(analyticsId: string, format: ExportFormat): Promise<ExportResult>
  exportQuestionnaire(questionnaireId: string, format: ExportFormat): Promise<ExportResult>
  exportCustomReport(reportDefinition: ReportDefinition): Promise<ExportResult>
  scheduleExport(schedule: ExportSchedule): Promise<string>
  getExportHistory(): Promise<ExportHistoryItem[]>
}
```

#### Export Format Support
- **JSON**: Complete data with metadata
- **CSV**: Tabular data for spreadsheet analysis
- **Excel**: Enhanced spreadsheet with formatting
- **PDF**: Professional reports and summaries
- **XML**: Structured data exchange
- **HTML**: Web-viewable reports

## Implementation Tasks

### Task 3.1: Core Export Framework (4 hours)
- [ ] Build base export service architecture
- [ ] Implement export format detection and routing
- [ ] Create export result management
- [ ] Add export validation and verification

### Task 3.2: Format-Specific Exporters (8 hours)
- [ ] Implement JSON exporter with metadata
- [ ] Build CSV exporter with customization
- [ ] Create Excel exporter with formatting
- [ ] Develop PDF report generator

### Task 3.3: Advanced Export Features (4 hours)
- [ ] Add export filtering and selection
- [ ] Implement export templates and layouts
- [ ] Create batch export capabilities
- [ ] Build export scheduling system

### Task 3.4: Export Management (2 hours)
- [ ] Implement export history tracking
- [ ] Add export file management
- [ ] Create export sharing capabilities
- [ ] Build export cleanup and archival

## Core Implementation

### 1. Export Service

```typescript
class ExportService {
  private exporters = new Map<ExportFormat, DataExporter>()
  private templateManager: ExportTemplateManager
  private historyManager: ExportHistoryManager

  constructor(
    private storage: ResponseStorageService,
    private analyticsEngine: AnalyticsEngine
  ) {
    this.templateManager = new ExportTemplateManager()
    this.historyManager = new ExportHistoryManager()
    this.registerExporters()
  }

  async exportResponses(criteria: ExportCriteria): Promise<ExportResult> {
    const startTime = Date.now()
    
    try {
      // Validate criteria
      this.validateExportCriteria(criteria)

      // Fetch data based on criteria
      const data = await this.fetchExportData(criteria)

      // Get appropriate exporter
      const exporter = this.getExporter(criteria.format)

      // Apply template if specified
      let processedData = data
      if (criteria.templateId) {
        const template = await this.templateManager.getTemplate(criteria.templateId)
        processedData = this.applyTemplate(data, template)
      }

      // Perform export
      const exportResult = await exporter.export(processedData, criteria.options || {})

      // Save to file if requested
      let filePath: string | undefined
      if (criteria.saveToFile) {
        filePath = await this.saveExportToFile(exportResult, criteria)
      }

      // Record in history
      const historyItem: ExportHistoryItem = {
        id: this.generateExportId(),
        criteria,
        timestamp: new Date(),
        duration: Date.now() - startTime,
        filePath,
        recordCount: data.responses.length,
        status: 'completed'
      }
      await this.historyManager.recordExport(historyItem)

      return {
        success: true,
        data: exportResult.content,
        metadata: {
          recordCount: data.responses.length,
          exportTime: new Date(),
          format: criteria.format,
          filePath
        },
        historyId: historyItem.id
      }

    } catch (error) {
      // Record failed export
      await this.historyManager.recordExport({
        id: this.generateExportId(),
        criteria,
        timestamp: new Date(),
        duration: Date.now() - startTime,
        status: 'failed',
        error: error.message
      })

      throw new ExportError(`Export failed: ${error.message}`, error)
    }
  }

  async exportAnalytics(
    questionnaireId: string, 
    format: ExportFormat, 
    options: AnalyticsExportOptions = {}
  ): Promise<ExportResult> {
    const analytics = await this.analyticsEngine.generateQuestionnaireStats(questionnaireId)
    
    const criteria: ExportCriteria = {
      type: 'analytics',
      questionnaireId,
      format,
      data: { analytics },
      options
    }

    return this.exportCustomData(criteria)
  }

  async exportQuestionnaire(
    questionnaireId: string, 
    format: ExportFormat
  ): Promise<ExportResult> {
    const questionnaire = await this.storage.loadQuestionnaire(questionnaireId)
    
    const criteria: ExportCriteria = {
      type: 'questionnaire',
      questionnaireId,
      format,
      data: { questionnaire }
    }

    return this.exportCustomData(criteria)
  }

  private async fetchExportData(criteria: ExportCriteria): Promise<ExportData> {
    const responses = await this.storage.queryResponses({
      questionnaireId: criteria.questionnaireId,
      dateRange: criteria.dateRange,
      completionStatus: criteria.completionStatus,
      filters: criteria.filters
    })

    const questionnaire = await this.storage.loadQuestionnaire(criteria.questionnaireId!)

    return {
      responses,
      questionnaire,
      metadata: {
        exportTime: new Date(),
        totalResponses: responses.length,
        criteria
      }
    }
  }

  private registerExporters(): void {
    this.exporters.set('json', new JSONExporter())
    this.exporters.set('csv', new CSVExporter())
    this.exporters.set('excel', new ExcelExporter())
    this.exporters.set('pdf', new PDFExporter())
    this.exporters.set('xml', new XMLExporter())
    this.exporters.set('html', new HTMLExporter())
  }

  private getExporter(format: ExportFormat): DataExporter {
    const exporter = this.exporters.get(format)
    if (!exporter) {
      throw new Error(`No exporter available for format: ${format}`)
    }
    return exporter
  }
}
```

### 2. Format-Specific Exporters

#### JSON Exporter
```typescript
class JSONExporter implements DataExporter {
  async export(data: ExportData, options: JSONExportOptions): Promise<ExportOutput> {
    const exportObject: JSONExportStructure = {
      metadata: {
        exportVersion: '1.0',
        exportTime: new Date().toISOString(),
        questionnaire: {
          id: data.questionnaire.id,
          title: data.questionnaire.title,
          version: data.questionnaire.version
        },
        responseCount: data.responses.length
      },
      questionnaire: data.questionnaire,
      responses: data.responses.map(response => this.formatResponse(response, options))
    }

    if (options.includeAnalytics) {
      exportObject.analytics = await this.generateAnalytics(data)
    }

    if (options.minify) {
      return {
        content: JSON.stringify(exportObject),
        mimeType: 'application/json',
        filename: this.generateFilename(data, 'json')
      }
    }

    return {
      content: JSON.stringify(exportObject, null, 2),
      mimeType: 'application/json',
      filename: this.generateFilename(data, 'json')
    }
  }

  private formatResponse(response: QuestionnaireResponse, options: JSONExportOptions): any {
    const formatted: any = {
      id: response.id,
      sessionId: response.sessionId,
      metadata: response.metadata,
      progress: response.progress
    }

    if (options.includeAnswerMetadata) {
      formatted.responses = response.responses
    } else {
      // Only include answer values
      formatted.responses = Object.fromEntries(
        Object.entries(response.responses).map(([questionId, answer]) => [
          questionId,
          answer.value
        ])
      )
    }

    return formatted
  }
}
```

#### CSV Exporter
```typescript
class CSVExporter implements DataExporter {
  async export(data: ExportData, options: CSVExportOptions): Promise<ExportOutput> {
    const csvContent = await this.generateCSV(data, options)
    
    return {
      content: csvContent,
      mimeType: 'text/csv',
      filename: this.generateFilename(data, 'csv')
    }
  }

  private async generateCSV(data: ExportData, options: CSVExportOptions): Promise<string> {
    const headers = this.buildHeaders(data, options)
    const rows = await this.buildRows(data, options)

    // Combine headers and rows
    const csvRows = [headers, ...rows]

    // Convert to CSV format
    return csvRows.map(row => 
      row.map(cell => this.escapeCsvCell(cell)).join(options.delimiter || ',')
    ).join(options.lineEnding || '\n')
  }

  private buildHeaders(data: ExportData, options: CSVExportOptions): string[] {
    const headers = ['Response ID', 'Session ID', 'Start Time', 'Completion Time', 'Duration', 'Status']

    // Add question headers
    data.questionnaire.questions.forEach(question => {
      headers.push(question.text)

      if (options.includeMetadata) {
        headers.push(`${question.text} - Duration (ms)`)
        headers.push(`${question.text} - Attempts`)
        headers.push(`${question.text} - Timestamp`)
      }
    })

    return headers
  }

  private async buildRows(data: ExportData, options: CSVExportOptions): Promise<string[][]> {
    return data.responses.map(response => {
      const row = [
        response.id,
        response.sessionId,
        response.metadata.startedAt.toISOString(),
        response.metadata.completedAt?.toISOString() || '',
        response.metadata.totalDuration?.toString() || '',
        response.progress.isCompleted ? 'Completed' : 'Incomplete'
      ]

      // Add answer data
      data.questionnaire.questions.forEach(question => {
        const answer = response.responses[question.id]
        
        if (answer) {
          row.push(this.formatAnswerForCSV(answer.value, question))

          if (options.includeMetadata) {
            row.push(answer.duration.toString())
            row.push(answer.attempts.toString())
            row.push(answer.timestamp.toISOString())
          }
        } else {
          row.push('')
          if (options.includeMetadata) {
            row.push('', '', '')
          }
        }
      })

      return row
    })
  }

  private formatAnswerForCSV(value: any, question: Question): string {
    if (value === null || value === undefined) {
      return ''
    }

    if (Array.isArray(value)) {
      return value.join('; ')
    }

    if (question.type === 'boolean') {
      return value ? 'Yes' : 'No'
    }

    if (question.type === 'date') {
      return new Date(value).toLocaleDateString()
    }

    return String(value)
  }

  private escapeCsvCell(cell: string): string {
    if (cell.includes(',') || cell.includes('"') || cell.includes('\n')) {
      return `"${cell.replace(/"/g, '""')}"`
    }
    return cell
  }
}
```

#### PDF Exporter
```typescript
class PDFExporter implements DataExporter {
  async export(data: ExportData, options: PDFExportOptions): Promise<ExportOutput> {
    const pdfDocument = await this.generatePDF(data, options)
    
    return {
      content: pdfDocument,
      mimeType: 'application/pdf',
      filename: this.generateFilename(data, 'pdf')
    }
  }

  private async generatePDF(data: ExportData, options: PDFExportOptions): Promise<Buffer> {
    const doc = new PDFDocument()
    const chunks: Buffer[] = []

    doc.on('data', chunk => chunks.push(chunk))

    // Title page
    this.addTitlePage(doc, data)

    // Executive summary
    if (options.includeSummary) {
      await this.addExecutiveSummary(doc, data)
    }

    // Response data
    if (options.includeResponses) {
      await this.addResponseData(doc, data, options)
    }

    // Analytics
    if (options.includeAnalytics) {
      await this.addAnalytics(doc, data)
    }

    doc.end()

    return new Promise(resolve => {
      doc.on('end', () => {
        resolve(Buffer.concat(chunks))
      })
    })
  }

  private addTitlePage(doc: PDFDocument, data: ExportData): void {
    doc.fontSize(24).text(data.questionnaire.title, { align: 'center' })
    doc.fontSize(16).text('Response Export Report', { align: 'center' })
    doc.fontSize(12).text(`Generated: ${new Date().toLocaleDateString()}`, { align: 'center' })
    
    doc.moveDown(2)
    
    doc.fontSize(14).text('Summary', { underline: true })
    doc.fontSize(12)
      .text(`Total Responses: ${data.responses.length}`)
      .text(`Completed Responses: ${data.responses.filter(r => r.progress.isCompleted).length}`)
      .text(`Date Range: ${this.formatDateRange(data.responses)}`)
      
    doc.addPage()
  }

  private async addResponseData(
    doc: PDFDocument, 
    data: ExportData, 
    options: PDFExportOptions
  ): Promise<void> {
    doc.fontSize(16).text('Response Data', { underline: true })
    doc.moveDown()

    const itemsPerPage = options.responsesPerPage || 5
    
    for (let i = 0; i < data.responses.length; i += itemsPerPage) {
      const pageResponses = data.responses.slice(i, i + itemsPerPage)
      
      for (const response of pageResponses) {
        this.addResponseSection(doc, response, data.questionnaire)
        doc.moveDown()
      }
      
      if (i + itemsPerPage < data.responses.length) {
        doc.addPage()
      }
    }
  }

  private addResponseSection(
    doc: PDFDocument, 
    response: QuestionnaireResponse, 
    questionnaire: Questionnaire
  ): void {
    doc.fontSize(14).text(`Response: ${response.id}`, { underline: true })
    doc.fontSize(10)
      .text(`Started: ${response.metadata.startedAt.toLocaleString()}`)
      .text(`Status: ${response.progress.isCompleted ? 'Completed' : 'Incomplete'}`)

    doc.moveDown(0.5)

    questionnaire.questions.forEach(question => {
      const answer = response.responses[question.id]
      
      doc.fontSize(12).text(`${question.text}`, { continued: false })
      
      if (answer) {
        const displayValue = this.formatAnswerForPDF(answer.value, question)
        doc.fontSize(10).text(`Answer: ${displayValue}`, { indent: 20 })
      } else {
        doc.fontSize(10).text('Answer: No response', { indent: 20 })
      }
      
      doc.moveDown(0.3)
    })
  }
}
```

### 3. Export Templates

```typescript
class ExportTemplateManager {
  private templates = new Map<string, ExportTemplate>()

  constructor() {
    this.loadBuiltinTemplates()
  }

  async createTemplate(template: ExportTemplate): Promise<string> {
    const templateId = this.generateTemplateId()
    template.id = templateId
    template.createdAt = new Date()
    
    this.templates.set(templateId, template)
    await this.saveTemplate(template)
    
    return templateId
  }

  async getTemplate(templateId: string): Promise<ExportTemplate> {
    const template = this.templates.get(templateId)
    if (!template) {
      throw new Error(`Template not found: ${templateId}`)
    }
    return template
  }

  private loadBuiltinTemplates(): void {
    // Basic response export template
    this.templates.set('basic-responses', {
      id: 'basic-responses',
      name: 'Basic Responses',
      description: 'Standard response export with basic metadata',
      fields: [
        { id: 'responseId', name: 'Response ID', type: 'metadata' },
        { id: 'startTime', name: 'Start Time', type: 'metadata' },
        { id: 'completionTime', name: 'Completion Time', type: 'metadata' },
        { id: 'answers', name: 'Answers', type: 'responses' }
      ],
      formatting: {
        dateFormat: 'ISO',
        includeEmpty: false,
        flattenArrays: true
      }
    })

    // Analytics summary template
    this.templates.set('analytics-summary', {
      id: 'analytics-summary',
      name: 'Analytics Summary',
      description: 'High-level analytics and statistics',
      fields: [
        { id: 'completionRate', name: 'Completion Rate', type: 'analytics' },
        { id: 'averageTime', name: 'Average Completion Time', type: 'analytics' },
        { id: 'responseVolume', name: 'Response Volume', type: 'analytics' },
        { id: 'topAnswers', name: 'Most Common Answers', type: 'analytics' }
      ],
      formatting: {
        percentages: true,
        roundNumbers: 2,
        includeCharts: true
      }
    })

    // Detailed audit template
    this.templates.set('detailed-audit', {
      id: 'detailed-audit',
      name: 'Detailed Audit Trail',
      description: 'Complete audit trail with all metadata',
      fields: [
        { id: 'responseId', name: 'Response ID', type: 'metadata' },
        { id: 'sessionId', name: 'Session ID', type: 'metadata' },
        { id: 'startTime', name: 'Start Time', type: 'metadata' },
        { id: 'answers', name: 'Answers', type: 'responses' },
        { id: 'timings', name: 'Answer Timings', type: 'metadata' },
        { id: 'attempts', name: 'Answer Attempts', type: 'metadata' }
      ],
      formatting: {
        includeEmpty: true,
        detailedMetadata: true,
        auditTrail: true
      }
    })
  }
}
```

### 4. Export Scheduling

```typescript
class ExportScheduler {
  private schedules = new Map<string, ExportSchedule>()
  private activeJobs = new Map<string, NodeJS.Timeout>()

  async scheduleExport(schedule: ExportSchedule): Promise<string> {
    const scheduleId = this.generateScheduleId()
    schedule.id = scheduleId
    schedule.createdAt = new Date()
    schedule.status = 'active'

    this.schedules.set(scheduleId, schedule)
    this.activateSchedule(schedule)

    return scheduleId
  }

  private activateSchedule(schedule: ExportSchedule): void {
    const nextRun = this.calculateNextRun(schedule)
    const delay = nextRun.getTime() - Date.now()

    const timeout = setTimeout(async () => {
      await this.executeScheduledExport(schedule)
      
      // Schedule next run if recurring
      if (schedule.recurring) {
        this.activateSchedule(schedule)
      }
    }, delay)

    this.activeJobs.set(schedule.id, timeout)
  }

  private async executeScheduledExport(schedule: ExportSchedule): Promise<void> {
    try {
      const exportService = new ExportService(this.storage, this.analyticsEngine)
      const result = await exportService.exportResponses(schedule.exportCriteria)

      // Handle delivery
      if (schedule.delivery) {
        await this.deliverExport(result, schedule.delivery)
      }

      // Update schedule
      schedule.lastRun = new Date()
      schedule.lastStatus = 'success'
      schedule.runCount = (schedule.runCount || 0) + 1

    } catch (error) {
      schedule.lastRun = new Date()
      schedule.lastStatus = 'failed'
      schedule.lastError = error.message

      // Handle failure notifications
      if (schedule.notifications?.onFailure) {
        await this.sendFailureNotification(schedule, error)
      }
    }
  }

  private calculateNextRun(schedule: ExportSchedule): Date {
    const now = new Date()
    
    switch (schedule.frequency) {
      case 'daily':
        return new Date(now.getTime() + 24 * 60 * 60 * 1000)
      case 'weekly':
        return new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000)
      case 'monthly':
        const nextMonth = new Date(now)
        nextMonth.setMonth(now.getMonth() + 1)
        return nextMonth
      case 'custom':
        return new Date(now.getTime() + (schedule.customInterval || 0))
      default:
        throw new Error(`Unknown frequency: ${schedule.frequency}`)
    }
  }
}
```

## File Structure
```
src/export/
├── core/
│   ├── export-service.ts           # Main export service
│   ├── export-manager.ts           # Export coordination
│   ├── template-manager.ts         # Export templates
│   └── scheduler.ts                # Export scheduling
├── exporters/
│   ├── json-exporter.ts           # JSON export
│   ├── csv-exporter.ts            # CSV export
│   ├── excel-exporter.ts          # Excel export
│   ├── pdf-exporter.ts            # PDF export
│   ├── xml-exporter.ts            # XML export
│   └── html-exporter.ts           # HTML export
├── templates/
│   ├── builtin-templates.ts       # Built-in export templates
│   ├── custom-templates.ts        # Custom template management
│   └── template-validator.ts      # Template validation
├── delivery/
│   ├── file-delivery.ts           # File system delivery
│   ├── email-delivery.ts          # Email delivery
│   ├── cloud-delivery.ts          # Cloud storage delivery
│   └── webhook-delivery.ts        # Webhook delivery
└── types/
    ├── export-types.ts            # Export type definitions
    ├── template-types.ts          # Template types
    └── delivery-types.ts          # Delivery types
```

## Testing Requirements

### Unit Tests
- Export format correctness
- Template application
- Data transformation accuracy
- File generation

### Integration Tests
- End-to-end export workflows
- Scheduled export execution
- Large dataset exports
- Error handling scenarios

### Performance Tests
- Export speed with large datasets
- Memory usage during exports
- Concurrent export handling

## Security Considerations

### Data Protection
- Sensitive data filtering
- Export access controls
- Audit trail for exports
- Data anonymization options

### File Security
- Secure file generation
- Encrypted export options
- Access control for export files
- Automatic cleanup of temporary files

## Acceptance Criteria
- [ ] All export formats work correctly
- [ ] Templates can be applied successfully
- [ ] Scheduled exports execute reliably
- [ ] Large datasets export without issues
- [ ] Export history is maintained
- [ ] Error handling is comprehensive
- [ ] Security measures are implemented
- [ ] Performance is acceptable
- [ ] File delivery works for all methods
- [ ] Export customization options work

## Dependencies
- PDF generation library (PDFKit)
- Excel generation library (ExcelJS)
- Email delivery (Nodemailer)
- Cloud storage SDKs
- Compression libraries (for large exports)

