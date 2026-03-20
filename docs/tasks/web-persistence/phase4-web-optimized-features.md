# Phase 4: Web-Optimized Features

**Status**: Not Started  
**Estimated Effort**: 4-5 days  
**Dependencies**: Phase 1, Phase 2, Phase 3

## Overview

Implement web-specific features for questionnaire creation, answering, and response review. This phase delivers the core web application functionality.

---

## Objectives

1. Enable questionnaire creation and management via web
2. Support questionnaire answering with auto-save and resume
3. Provide response review with filtering and export

---

## 4.1 Questionnaire Creation (Web)

### Questionnaire Lifecycle

```
draft -> published -> closed -> archived
  ^         |
  |         v
  +-- unpublished (back to draft)
```

### Version History

Create `src/core/storage/questionnaire-versions.ts`:

```typescript
export interface QuestionnaireVersion {
  versionId: string;
  questionnaireId: string;
  versionNumber: number;
  createdAt: string;
  createdBy: string;
  changeDescription?: string;
  snapshot: Questionnaire;
  diff?: QuestionnaireChangeDiff;
}

export interface QuestionnaireChangeDiff {
  questionsAdded: string[];
  questionsRemoved: string[];
  questionsModified: string[];
  metadataChanged: string[];
}

export interface VersionHistoryService {
  createVersion(questionnaire: Questionnaire, userId: string, description?: string): Promise<QuestionnaireVersion>;
  getVersions(questionnaireId: string): Promise<QuestionnaireVersion[]>;
  getVersion(questionnaireId: string, versionNumber: number): Promise<QuestionnaireVersion | null>;
  revertToVersion(questionnaireId: string, versionNumber: number, userId: string): Promise<Questionnaire>;
  getDiff(questionnaireId: string, fromVersion: number, toVersion: number): Promise<QuestionnaireChangeDiff>;
}
```

Storage: `data/questionnaires/{questionnaireId}/versions/` directory.

### Draft Preview

```typescript
export interface PreviewService {
  createPreviewSession(questionnaireId: string, userId: string): Promise<string>;
  getPreviewData(previewSessionId: string): Promise<Questionnaire>;
  invalidatePreview(previewSessionId: string): Promise<void>;
}
```

Preview sessions are temporary and auto-expire after 1 hour.

### Template System

Create `src/core/templates/`:

```typescript
export interface QuestionnaireTemplate {
  templateId: string;
  name: string;
  description: string;
  category: string;
  isPublic: boolean;
  ownerId: string;
  questionnaire: Omit<Questionnaire, 'id' | 'metadata.author' | 'metadata.createdAt'>;
  createdAt: string;
  updatedAt: string;
  usageCount: number;
}

export interface TemplateService {
  createTemplate(questionnaire: Questionnaire, name: string, category: string): Promise<QuestionnaireTemplate>;
  listTemplates(category?: string, publicOnly?: boolean): Promise<QuestionnaireTemplate[]>;
  getTemplate(templateId: string): Promise<QuestionnaireTemplate | null>;
  createFromTemplate(templateId: string, userId: string, customizations?: Partial<Questionnaire>): Promise<Questionnaire>;
  deleteTemplate(templateId: string): Promise<void>;
}
```

Storage: `data/templates/` directory.

### Collaboration (Single Editor)

Extend conflict detection from Phase 3:
- Only one user can edit at a time
- Show "currently being edited by X" message
- Auto-release edit lock after 10 minutes of inactivity

---

## 4.2 Questionnaire Answering (Web)

### Response Modes

```typescript
export const ResponseModeSchema = z.enum([
  'anonymous',      // No user account required
  'authenticated',  // Must be logged in
  'verified',       // Logged in + email verified
]);

export type ResponseMode = z.infer<typeof ResponseModeSchema>;
```

### Response Deduplication

```typescript
export interface DeduplicationConfig {
  enabled: boolean;
  strategy: 'none' | 'per_user' | 'per_session' | 'per_ip';
  allowUpdate: boolean;  // If true, user can update their existing response
}

export interface DeduplicationService {
  canRespond(questionnaireId: string, identifier: DeduplicationIdentifier): Promise<boolean>;
  getExistingResponse(questionnaireId: string, identifier: DeduplicationIdentifier): Promise<QuestionnaireResponse | null>;
  recordResponse(response: QuestionnaireResponse, identifier: DeduplicationIdentifier): Promise<void>;
}

export interface DeduplicationIdentifier {
  userId?: string;
  sessionId?: string;
  ipAddress?: string;
}
```

### Partial Response Saving

Extend response schema:

```typescript
export const PartialResponseSchema = QuestionnaireResponseSchema.extend({
  isPartial: z.boolean().default(false),
  resumeToken: z.string().optional(),
  abandonedAt: z.string().datetime().optional(),
});
```

Resume functionality:

```typescript
export interface ResumeService {
  generateResumeToken(responseId: string): Promise<string>;
  findByResumeToken(token: string): Promise<PartialResponse | null>;
  resumeResponse(token: string, sessionId: string): Promise<PartialResponse>;
  expireResumeToken(token: string): Promise<void>;
}
```

### Progress Persistence

```typescript
export interface WebProgressTracker {
  // Extends base progress tracking
  saveProgress(responseId: string, progress: ResponseProgress): Promise<void>;
  restoreProgress(responseId: string): Promise<ResponseProgress | null>;
  
  // Web-specific
  saveToLocalStorage(progress: ResponseProgress): void;  // Client-side
  syncFromLocalStorage(responseId: string): Promise<void>;
  
  // Cross-device resume
  enableCrossDeviceResume(responseId: string, userId: string): Promise<string>;
}
```

---

## 4.3 Response Review (Web)

### Response Listing

Create `src/core/services/review-service.ts`:

```typescript
export interface ResponseFilter {
  questionnaireId?: string;
  userId?: string;
  status?: ResponseStatus[];
  dateFrom?: string;
  dateTo?: string;
  hasAnswerFor?: string;  // question ID
}

export interface ResponseSort {
  field: 'createdAt' | 'updatedAt' | 'completedAt' | 'status';
  direction: 'asc' | 'desc';
}

export interface PaginatedResult<T> {
  items: T[];
  total: number;
  page: number;
  pageSize: number;
  hasMore: boolean;
}

export interface ReviewService {
  listResponses(filter: ResponseFilter, sort: ResponseSort, page: number, pageSize: number): Promise<PaginatedResult<QuestionnaireResponse>>;
  getResponse(responseId: string): Promise<QuestionnaireResponse | null>;
  getResponseWithNavigation(responseId: string): Promise<ResponseWithNavigation>;
  deleteResponse(responseId: string): Promise<void>;
  bulkDeleteResponses(responseIds: string[]): Promise<number>;
}

export interface ResponseWithNavigation {
  response: QuestionnaireResponse;
  previousId: string | null;
  nextId: string | null;
  currentIndex: number;
  totalCount: number;
}
```

### Bulk Export

```typescript
export type ExportFormat = 'json' | 'csv';

export interface ExportOptions {
  format: ExportFormat;
  includeMetadata: boolean;
  includeTimestamps: boolean;
  questionIds?: string[];  // Subset of questions to export
  dateRange?: { from: string; to: string };
}

export interface ExportService {
  exportResponses(questionnaireId: string, options: ExportOptions): Promise<string>;
  exportToFile(questionnaireId: string, options: ExportOptions, filePath: string): Promise<void>;
  scheduleExport(questionnaireId: string, options: ExportOptions): Promise<string>;  // Returns job ID
  getExportStatus(jobId: string): Promise<ExportStatus>;
}

export interface ExportStatus {
  jobId: string;
  status: 'pending' | 'processing' | 'completed' | 'failed';
  progress: number;  // 0-100
  resultPath?: string;
  error?: string;
}
```

### Analytics Dashboard

```typescript
export interface QuestionnaireAnalytics {
  questionnaireId: string;
  generatedAt: string;
  
  // Overall metrics
  totalResponses: number;
  completedResponses: number;
  abandonedResponses: number;
  completionRate: number;
  
  // Timing
  averageCompletionTime: number;
  medianCompletionTime: number;
  
  // Per-question analytics
  questionAnalytics: QuestionAnalytics[];
}

export interface QuestionAnalytics {
  questionId: string;
  questionText: string;
  responseCount: number;
  skipCount: number;
  
  // For choice questions
  choiceDistribution?: Record<string, number>;
  
  // For numeric questions
  numericStats?: {
    min: number;
    max: number;
    mean: number;
    median: number;
  };
  
  // For text questions
  averageLength?: number;
}

export interface AnalyticsService {
  generateAnalytics(questionnaireId: string): Promise<QuestionnaireAnalytics>;
  getCachedAnalytics(questionnaireId: string): Promise<QuestionnaireAnalytics | null>;
  invalidateCache(questionnaireId: string): Promise<void>;
}
```

Storage: `data/questionnaires/{questionnaireId}/analytics.json` (cached).

---

## File Structure

```
src/core/
├── storage/
│   └── questionnaire-versions.ts    # Version history
├── templates/
│   └── template-service.ts          # Template management
├── services/
│   ├── questionnaire-service.ts     # CRUD + lifecycle
│   ├── response-service.ts          # Answer processing
│   ├── review-service.ts            # Response review
│   ├── export-service.ts            # Bulk export
│   ├── analytics-service.ts         # Dashboard data
│   ├── preview-service.ts           # Draft preview
│   ├── resume-service.ts            # Response resume
│   └── deduplication-service.ts     # Response deduplication
```

---

## Tasks

| Task ID | Description | Estimated Hours |
|---------|-------------|-----------------|
| 4.1.1 | Implement questionnaire state transitions | 3 |
| 4.1.2 | Implement version history service | 4 |
| 4.1.3 | Implement diff generation for versions | 3 |
| 4.1.4 | Implement preview service | 2 |
| 4.1.5 | Implement template service | 4 |
| 4.2.1 | Implement response mode enforcement | 2 |
| 4.2.2 | Implement deduplication service | 3 |
| 4.2.3 | Implement partial response saving | 3 |
| 4.2.4 | Implement resume service with tokens | 3 |
| 4.2.5 | Implement cross-device progress sync | 2 |
| 4.3.1 | Implement review service with filtering | 4 |
| 4.3.2 | Implement response navigation | 2 |
| 4.3.3 | Implement JSON export | 2 |
| 4.3.4 | Implement CSV export | 3 |
| 4.3.5 | Implement analytics service | 4 |

**Total**: ~44 hours (4-5 days)

---

## Testing Requirements

### Unit Tests

- State transition validation
- Version diff calculation
- Filter logic for response listing
- CSV generation correctness
- Analytics calculation accuracy

### Integration Tests

- Full questionnaire lifecycle (draft -> publish -> close)
- Version creation and revert
- Template creation and use
- Export with various filters
- Analytics generation with real data

### Performance Tests

- Response listing with 1000+ responses
- Export performance with large datasets
- Analytics calculation timing

---

## Acceptance Criteria

- [ ] Questionnaires can be created, edited, published, closed
- [ ] Version history tracks all changes
- [ ] Users can revert to previous versions
- [ ] Templates can be created and reused
- [ ] Anonymous and authenticated response modes work
- [ ] Response deduplication prevents duplicates
- [ ] Partial responses can be saved and resumed
- [ ] Resume tokens work cross-device
- [ ] Response listing supports filtering and sorting
- [ ] Responses can be navigated sequentially
- [ ] JSON and CSV export work correctly
- [ ] Analytics dashboard shows accurate metrics
- [ ] All existing tests pass

---

## Notes

- Version history can grow large; consider pruning old versions
- CSV export should handle special characters and commas
- Analytics caching improves dashboard performance
- Consider pagination for large response exports
