# Questionnaire Schema Design

## 1 Core Schema Structure

```typescript
interface Questionnaire {
  id: string;
  version: string;
  metadata: QuestionnaireMetadata;
  questions: Question[];
  config?: QuestionnaireConfig;
}

interface QuestionnaireMetadata {
  title: string;
  description?: string;
  author?: string;
  createdAt: string;
  updatedAt: string;
  tags?: string[];
}

interface QuestionnaireConfig {
  allowBack?: boolean;
  allowSkip?: boolean;
  shuffleQuestions?: boolean;
  showProgress?: boolean;
}
```

## 2 Question Types

```typescript
type QuestionType = 
  | 'text'           // Short text input
  | 'textarea'       // Long text input
  | 'number'         // Numeric input
  | 'select'         // Single choice from list
  | 'multiselect'    // Multiple choices from list
  | 'boolean'        // Yes/No
  | 'rating'         // Numeric scale (1-5, 1-10, etc.)
  | 'date'           // Date picker
  | 'email'          // Email with validation
  | 'url'            // URL with validation

interface Question {
  id: string;
  type: QuestionType;
  text: string;
  description?: string;
  required?: boolean;
  validation?: ValidationRule[];
  options?: QuestionOption[];  // For select/multiselect
  conditional?: ConditionalLogic;
  metadata?: Record<string, any>;
}

interface QuestionOption {
  value: string;
  label: string;
  description?: string;
}
```

## 3 Validation & Conditional Logic

```typescript
interface ValidationRule {
  type: 'min' | 'max' | 'pattern' | 'custom';
  value: any;
  message?: string;
}

interface ConditionalLogic {
  dependsOn: string;  // Question ID
  operator: 'equals' | 'notEquals' | 'contains' | 'greaterThan' | 'lessThan';
  value: any;
  action: 'show' | 'hide' | 'require';
}
```

## 4 Response Schema

```typescript
interface QuestionnaireResponse {
  id: string;
  questionnaireId: string;
  questionnaireVersion: string;
  sessionId: string;
  startedAt: string;
  completedAt?: string;
  status: 'in_progress' | 'completed' | 'abandoned';
  answers: Answer[];
  metadata?: Record<string, any>;
}

interface Answer {
  questionId: string;
  value: any;
  answeredAt: string;
}
```
