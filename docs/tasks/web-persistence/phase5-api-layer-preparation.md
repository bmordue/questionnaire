# Phase 5: API Layer Preparation

**Status**: Not Started  
**Estimated Effort**: 2-3 days  
**Dependencies**: Phase 1, Phase 2, Phase 4

## Overview

Extract business logic into a service layer and define DTOs for web API integration. This phase prepares the codebase for a web framework (Express/Fastify) without adding the framework itself.

---

## Objectives

1. Define request/response DTOs for all web operations
2. Extract business logic from TUI runner into services
3. Standardize error handling and validation

---

## 5.1 Request/Response Models (DTOs)

### Questionnaire DTOs

Create `src/web/dtos/questionnaire.ts`:

```typescript
// Create questionnaire
export interface CreateQuestionnaireRequest {
  title: string;
  description?: string;
  questions: CreateQuestionRequest[];
  config?: QuestionnaireConfigInput;
  tags?: string[];
}

export interface CreateQuestionRequest {
  type: QuestionType;
  text: string;
  required?: boolean;
  options?: CreateQuestionOptionRequest[];
  validation?: QuestionValidationInput;
}

export interface CreateQuestionOptionRequest {
  value: string;
  label: string;
  description?: string;
}

// Questionnaire responses
export interface QuestionnaireResponse {
  id: string;
  title: string;
  description?: string;
  state: QuestionnaireState;
  questionCount: number;
  responseCount: number;
  createdAt: string;
  updatedAt: string;
  owner: UserSummary;
}

export interface QuestionnaireDetailResponse extends QuestionnaireResponse {
  questions: QuestionResponse[];
  config: QuestionnaireConfig;
  tags: string[];
  version: number;
}

export interface QuestionnaireListResponse {
  questionnaires: QuestionnaireResponse[];
  total: number;
  page: number;
  pageSize: number;
}

// Update questionnaire
export interface UpdateQuestionnaireRequest {
  title?: string;
  description?: string;
  questions?: CreateQuestionRequest[];
  config?: QuestionnaireConfigInput;
  tags?: string[];
}
```

### Response DTOs

Create `src/web/dtos/response.ts`:

```typescript
// Submit answer
export interface SubmitAnswerRequest {
  questionId: string;
  value: AnswerValue;
}

export interface SubmitAnswersRequest {
  answers: SubmitAnswerRequest[];
}

// Response responses
export interface QuestionnaireResponseSummary {
  id: string;
  questionnaireId: string;
  status: ResponseStatus;
  progress: number;  // 0-100
  answeredCount: number;
  totalQuestions: number;
  startedAt: string;
  completedAt?: string;
  respondent?: UserSummary;
}

export interface QuestionnaireResponseDetail extends QuestionnaireResponseSummary {
  answers: AnswerResponse[];
  metadata: ResponseMetadata;
}

export interface AnswerResponse {
  questionId: string;
  questionText: string;
  value: AnswerValue;
  answeredAt: string;
  isValid: boolean;
  validationErrors?: string[];
}

export interface ResponseListResponse {
  responses: QuestionnaireResponseSummary[];
  total: number;
  page: number;
  pageSize: number;
}
```

### User DTOs

Create `src/web/dtos/user.ts`:

```typescript
// Registration
export interface RegisterRequest {
  email: string;
  password: string;
  displayName?: string;
}

export interface RegisterResponse {
  user: UserSummary;
  sessionId: string;
}

// Login
export interface LoginRequest {
  email: string;
  password: string;
}

export interface LoginResponse {
  user: UserSummary;
  sessionId: string;
  expiresAt: string;
}

// User responses
export interface UserSummary {
  id: string;
  email: string;
  displayName?: string;
  role: UserRole;
}

export interface UserProfileResponse extends UserSummary {
  createdAt: string;
  lastLoginAt?: string;
  emailVerified: boolean;
  questionnairesCreated: number;
  responsesSubmitted: number;
}

// Password management
export interface ChangePasswordRequest {
  currentPassword: string;
  newPassword: string;
}

export interface RequestPasswordResetRequest {
  email: string;
}

export interface ResetPasswordRequest {
  token: string;
  newPassword: string;
}
```

### Common DTOs

Create `src/web/dtos/common.ts`:

```typescript
// Pagination
export interface PaginationParams {
  page?: number;      // default: 1
  pageSize?: number;  // default: 20, max: 100
}

// Sorting
export interface SortParams<T extends string> {
  sortBy?: T;
  sortOrder?: 'asc' | 'desc';
}

// Success response wrapper
export interface SuccessResponse<T> {
  success: true;
  data: T;
  meta?: ResponseMeta;
}

export interface ResponseMeta {
  requestId: string;
  timestamp: string;
  pagination?: PaginationMeta;
}

export interface PaginationMeta {
  page: number;
  pageSize: number;
  total: number;
  totalPages: number;
  hasNext: boolean;
  hasPrevious: boolean;
}

// Error response
export interface ErrorResponse {
  success: false;
  error: {
    code: string;
    message: string;
    details?: Record<string, string[]>;
    stack?: string;  // Only in development
  };
  meta?: {
    requestId: string;
    timestamp: string;
  };
}
```

### Input Validation Schemas

Create `src/web/dtos/validation.ts`:

```typescript
import { z } from 'zod';

// Extend existing Zod schemas for API input validation
export const CreateQuestionnaireRequestSchema = z.object({
  title: z.string().min(1).max(200),
  description: z.string().max(2000).optional(),
  questions: z.array(CreateQuestionRequestSchema).min(1).max(100),
  config: QuestionnaireConfigSchema.partial().optional(),
  tags: z.array(z.string().max(50)).max(10).optional(),
});

export const RegisterRequestSchema = z.object({
  email: z.string().email(),
  password: z.string()
    .min(8, 'Password must be at least 8 characters')
    .regex(/[A-Z]/, 'Password must contain an uppercase letter')
    .regex(/[a-z]/, 'Password must contain a lowercase letter')
    .regex(/[0-9]/, 'Password must contain a digit'),
  displayName: z.string().min(1).max(100).optional(),
});

export const LoginRequestSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
});

export const PaginationParamsSchema = z.object({
  page: z.coerce.number().int().positive().default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(20),
});
```

---

## 5.2 Service Layer Extraction

### QuestionnaireService

Create `src/core/services/questionnaire-service.ts`:

```typescript
export interface QuestionnaireService {
  // CRUD
  create(input: CreateQuestionnaireInput, userId: string): Promise<Questionnaire>;
  getById(id: string, userId?: string): Promise<Questionnaire | null>;
  update(id: string, input: UpdateQuestionnaireInput, userId: string): Promise<Questionnaire>;
  delete(id: string, userId: string): Promise<void>;
  
  // Listing
  list(filter: QuestionnaireFilter, pagination: PaginationParams, userId?: string): Promise<PaginatedResult<Questionnaire>>;
  listByUser(userId: string, pagination: PaginationParams): Promise<PaginatedResult<Questionnaire>>;
  
  // State management
  publish(id: string, userId: string): Promise<Questionnaire>;
  unpublish(id: string, userId: string): Promise<Questionnaire>;
  close(id: string, userId: string): Promise<Questionnaire>;
  archive(id: string, userId: string): Promise<Questionnaire>;
  
  // Versioning
  getVersions(id: string): Promise<QuestionnaireVersion[]>;
  revertToVersion(id: string, version: number, userId: string): Promise<Questionnaire>;
}
```

### ResponseService

Create `src/core/services/response-service.ts`:

```typescript
export interface ResponseService {
  // Response lifecycle
  startResponse(questionnaireId: string, sessionId: string, userId?: string): Promise<QuestionnaireResponse>;
  submitAnswer(responseId: string, answer: SubmitAnswerInput): Promise<QuestionnaireResponse>;
  submitAnswers(responseId: string, answers: SubmitAnswerInput[]): Promise<QuestionnaireResponse>;
  completeResponse(responseId: string): Promise<QuestionnaireResponse>;
  abandonResponse(responseId: string): Promise<QuestionnaireResponse>;
  
  // Retrieval
  getById(id: string): Promise<QuestionnaireResponse | null>;
  getBySession(sessionId: string, questionnaireId: string): Promise<QuestionnaireResponse | null>;
  
  // Validation
  validateAnswer(questionnaireId: string, questionId: string, value: AnswerValue): Promise<ValidationResult>;
  
  // Resume
  getResumeToken(responseId: string): Promise<string>;
  resumeByToken(token: string, sessionId: string): Promise<QuestionnaireResponse>;
}
```

### UserService

Create `src/core/services/user-service.ts`:

```typescript
export interface UserService {
  // CRUD
  create(input: CreateUserInput): Promise<SafeUser>;
  getById(id: string): Promise<SafeUser | null>;
  getByEmail(email: string): Promise<SafeUser | null>;
  update(id: string, input: UpdateUserInput): Promise<SafeUser>;
  delete(id: string): Promise<void>;
  
  // Profile
  getProfile(userId: string): Promise<UserProfile>;
  updateProfile(userId: string, input: UpdateProfileInput): Promise<UserProfile>;
  
  // Stats
  getStats(userId: string): Promise<UserStats>;
}

export interface UserStats {
  questionnairesCreated: number;
  questionnairesPublished: number;
  responsesReceived: number;
  responsesSubmitted: number;
}
```

---

## 5.3 Error Standardization

### Error Codes

Create `src/web/errors/error-codes.ts`:

```typescript
export const ErrorCodes = {
  // Authentication (1xxx)
  INVALID_CREDENTIALS: 'AUTH_1001',
  SESSION_EXPIRED: 'AUTH_1002',
  UNAUTHORIZED: 'AUTH_1003',
  RATE_LIMITED: 'AUTH_1004',
  
  // Validation (2xxx)
  VALIDATION_ERROR: 'VAL_2001',
  INVALID_INPUT: 'VAL_2002',
  MISSING_REQUIRED_FIELD: 'VAL_2003',
  
  // Resources (3xxx)
  NOT_FOUND: 'RES_3001',
  ALREADY_EXISTS: 'RES_3002',
  CONFLICT: 'RES_3003',
  
  // Questionnaire (4xxx)
  QUESTIONNAIRE_NOT_FOUND: 'QUEST_4001',
  QUESTIONNAIRE_NOT_PUBLISHED: 'QUEST_4002',
  QUESTIONNAIRE_CLOSED: 'QUEST_4003',
  INVALID_STATE_TRANSITION: 'QUEST_4004',
  
  // Response (5xxx)
  RESPONSE_NOT_FOUND: 'RESP_5001',
  RESPONSE_ALREADY_COMPLETED: 'RESP_5002',
  DUPLICATE_RESPONSE: 'RESP_5003',
  INVALID_ANSWER: 'RESP_5004',
  
  // System (9xxx)
  INTERNAL_ERROR: 'SYS_9001',
  SERVICE_UNAVAILABLE: 'SYS_9002',
} as const;
```

### Application Errors

Create `src/web/errors/application-errors.ts`:

```typescript
export class ApplicationError extends Error {
  constructor(
    message: string,
    public code: string,
    public statusCode: number = 500,
    public details?: Record<string, string[]>
  ) {
    super(message);
    this.name = 'ApplicationError';
  }
}

export class ValidationError extends ApplicationError {
  constructor(message: string, details?: Record<string, string[]>) {
    super(message, ErrorCodes.VALIDATION_ERROR, 400, details);
    this.name = 'ValidationError';
  }
}

export class NotFoundError extends ApplicationError {
  constructor(resource: string, id: string) {
    super(`${resource} with id ${id} not found`, ErrorCodes.NOT_FOUND, 404);
    this.name = 'NotFoundError';
  }
}

export class UnauthorizedError extends ApplicationError {
  constructor(message: string = 'Unauthorized') {
    super(message, ErrorCodes.UNAUTHORIZED, 401);
    this.name = 'UnauthorizedError';
  }
}

export class ForbiddenError extends ApplicationError {
  constructor(message: string = 'Forbidden') {
    super(message, ErrorCodes.UNAUTHORIZED, 403);
    this.name = 'ForbiddenError';
  }
}

export class ConflictError extends ApplicationError {
  constructor(message: string) {
    super(message, ErrorCodes.CONFLICT, 409);
    this.name = 'ConflictError';
  }
}
```

### Error Handler

Create `src/web/errors/error-handler.ts`:

```typescript
export interface ErrorHandler {
  handle(error: Error): ErrorResponse;
  toHttpStatus(error: Error): number;
  shouldLog(error: Error): boolean;
}

export function handleError(error: Error, isDevelopment: boolean = false): ErrorResponse {
  if (error instanceof ApplicationError) {
    return {
      success: false,
      error: {
        code: error.code,
        message: error.message,
        details: error.details,
        stack: isDevelopment ? error.stack : undefined,
      },
    };
  }
  
  // Unknown error
  return {
    success: false,
    error: {
      code: ErrorCodes.INTERNAL_ERROR,
      message: isDevelopment ? error.message : 'Internal server error',
      stack: isDevelopment ? error.stack : undefined,
    },
  };
}
```

---

## File Structure

```
src/web/
├── dtos/
│   ├── questionnaire.ts      # Questionnaire DTOs
│   ├── response.ts           # Response DTOs
│   ├── user.ts               # User DTOs
│   ├── common.ts             # Shared DTOs
│   └── validation.ts         # Zod validation schemas
├── errors/
│   ├── error-codes.ts        # Error code constants
│   ├── application-errors.ts # Error classes
│   └── error-handler.ts      # Error handling utilities
└── index.ts                  # Barrel export

src/core/services/
├── questionnaire-service.ts  # Questionnaire business logic
├── response-service.ts       # Response business logic
├── user-service.ts           # User business logic
└── index.ts                  # Barrel export
```

---

## Tasks

| Task ID | Description | Estimated Hours |
|---------|-------------|-----------------|
| 5.1.1 | Define questionnaire DTOs | 2 |
| 5.1.2 | Define response DTOs | 2 |
| 5.1.3 | Define user DTOs | 2 |
| 5.1.4 | Define common DTOs and pagination | 1 |
| 5.1.5 | Create Zod validation schemas for DTOs | 2 |
| 5.2.1 | Implement QuestionnaireService | 4 |
| 5.2.2 | Implement ResponseService | 4 |
| 5.2.3 | Implement UserService | 2 |
| 5.2.4 | Extract logic from TUI runner | 3 |
| 5.3.1 | Define error codes | 1 |
| 5.3.2 | Create application error classes | 2 |
| 5.3.3 | Implement error handler | 1 |

**Total**: ~26 hours (2-3 days)

---

## Testing Requirements

### Unit Tests

- DTO validation with edge cases
- Service method business logic
- Error handling for each error type
- Error code consistency

### Integration Tests

- Service layer with repository integration
- Full request -> service -> repository flow
- Error propagation through layers

---

## Acceptance Criteria

- [ ] All DTOs defined with TypeScript interfaces
- [ ] All DTOs have corresponding Zod validation schemas
- [ ] QuestionnaireService implements full CRUD + state management
- [ ] ResponseService implements answer submission and validation
- [ ] UserService implements profile management
- [ ] Error codes cover all known error cases
- [ ] Error handler produces consistent error responses
- [ ] TUI runner uses service layer (no direct storage access)
- [ ] All existing tests pass

---

## Notes

- DTOs should be serializable (no functions, no circular references)
- Services should be stateless (all state in repositories)
- Consider dependency injection for services
- Error messages should be safe to show to users (no internal details)
- This phase does NOT add Express/Fastify - that's a separate future task
