# Phase 2 Task 1: Build TUI Components for Each Question Type

## Overview
Create reusable Terminal User Interface (TUI) components for each question type using Inquirer.js, ensuring consistent user experience and proper validation handling.

## Goals
- Develop interactive UI components for all question types
- Implement consistent styling and user experience
- Handle real-time validation and error display
- Support accessibility and keyboard navigation

## Technical Approach

### 1. Component Architecture

#### Base Component Interface
```typescript
interface QuestionComponent {
  render(question: Question, currentAnswer?: any): Promise<any>
  validate(answer: any, question: Question): ValidationResult
  format(answer: any): string
  getPromptConfig(question: Question): InquirerPromptConfig
}
```

#### Component Types Mapping
- **Text Questions** → Input prompt with validation
- **Number Questions** → Number input with range validation  
- **Email Questions** → Input with email validation
- **Single Choice** → List prompt with single selection
- **Multiple Choice** → Checkbox prompt with multi-selection
- **Boolean Questions** → Confirm prompt (Y/N)
- **Date Questions** → Date input with format validation
- **Rating Questions** → List prompt with numeric scale

### 2. Inquirer.js Integration

#### Custom Prompt Types
```typescript
// Register custom prompts
inquirer.registerPrompt('rating', RatingPrompt)
inquirer.registerPrompt('date-input', DateInputPrompt)
inquirer.registerPrompt('validated-input', ValidatedInputPrompt)
```

## Implementation Tasks

### Task 1.1: Base Component Framework (4 hours)
- [ ] Create base component interface and abstract class
- [ ] Implement common validation handling
- [ ] Set up Inquirer.js prompt registration system
- [ ] Create component factory pattern

### Task 1.2: Text and Input Components (5 hours)
- [ ] Text input component with length validation
- [ ] Number input component with range validation
- [ ] Email input component with format validation
- [ ] Multi-line text input component

### Task 1.3: Choice Components (4 hours)
- [ ] Single choice list component
- [ ] Multiple choice checkbox component
- [ ] Boolean confirm component
- [ ] Custom choice input handling

### Task 1.4: Specialized Components (5 hours)
- [ ] Date input component with calendar picker
- [ ] Rating scale component (1-5, 1-10)
- [ ] Custom validation message display
- [ ] Progress indicator component

## Component Specifications

### 1. Text Input Component

#### Features
- Real-time character counting
- Min/max length validation
- Pattern/regex validation
- Multi-line support for long text

#### Implementation
```typescript
class TextInputComponent implements QuestionComponent {
  async render(question: TextQuestion, currentAnswer?: string): Promise<string> {
    const promptConfig = {
      type: 'input',
      name: 'answer',
      message: this.formatMessage(question),
      default: currentAnswer,
      validate: (input: string) => this.validate(input, question),
      transformer: (input: string) => this.formatDisplay(input, question)
    }
    
    const result = await inquirer.prompt([promptConfig])
    return result.answer
  }

  validate(answer: string, question: TextQuestion): ValidationResult {
    const rules = question.validation
    if (!rules) return { isValid: true }

    if (question.required && (!answer || answer.trim().length === 0)) {
      return { isValid: false, message: 'This field is required' }
    }

    if (rules.minLength && answer.length < rules.minLength) {
      return { 
        isValid: false, 
        message: `Minimum length is ${rules.minLength} characters` 
      }
    }

    if (rules.maxLength && answer.length > rules.maxLength) {
      return { 
        isValid: false, 
        message: `Maximum length is ${rules.maxLength} characters` 
      }
    }

    if (rules.pattern && !new RegExp(rules.pattern).test(answer)) {
      return { 
        isValid: false, 
        message: rules.patternMessage || 'Invalid format' 
      }
    }

    return { isValid: true }
  }
}
```

### 2. Choice Components

#### Single Choice List
```typescript
class SingleChoiceComponent implements QuestionComponent {
  async render(question: ChoiceQuestion, currentAnswer?: string): Promise<string> {
    const choices = question.options.map(option => ({
      name: option,
      value: option
    }))

    if (question.allowOther) {
      choices.push({ name: 'Other (specify)', value: '__other__' })
    }

    const promptConfig = {
      type: 'list',
      name: 'answer',
      message: this.formatMessage(question),
      choices,
      default: currentAnswer,
      pageSize: 10
    }

    let result = await inquirer.prompt([promptConfig])
    
    if (result.answer === '__other__') {
      const otherPrompt = {
        type: 'input',
        name: 'otherValue',
        message: 'Please specify:'
      }
      const otherResult = await inquirer.prompt([otherPrompt])
      result.answer = otherResult.otherValue
    }

    return result.answer
  }
}
```

#### Multiple Choice Checkbox
```typescript
class MultipleChoiceComponent implements QuestionComponent {
  async render(question: ChoiceQuestion, currentAnswer?: string[]): Promise<string[]> {
    const choices = question.options.map(option => ({
      name: option,
      value: option,
      checked: currentAnswer?.includes(option) || false
    }))

    const promptConfig = {
      type: 'checkbox',
      name: 'answer',
      message: this.formatMessage(question),
      choices,
      validate: (input: string[]) => this.validate(input, question)
    }

    const result = await inquirer.prompt([promptConfig])
    return result.answer
  }

  validate(answer: string[], question: ChoiceQuestion): ValidationResult {
    const rules = question.validation

    if (question.required && answer.length === 0) {
      return { isValid: false, message: 'Please select at least one option' }
    }

    if (rules?.minSelections && answer.length < rules.minSelections) {
      return { 
        isValid: false, 
        message: `Please select at least ${rules.minSelections} options` 
      }
    }

    if (rules?.maxSelections && answer.length > rules.maxSelections) {
      return { 
        isValid: false, 
        message: `Please select no more than ${rules.maxSelections} options` 
      }
    }

    return { isValid: true }
  }
}
```

### 3. Number Input Component

#### Implementation
```typescript
class NumberInputComponent implements QuestionComponent {
  async render(question: NumberQuestion, currentAnswer?: number): Promise<number> {
    const promptConfig = {
      type: 'input',
      name: 'answer',
      message: this.formatMessage(question),
      default: currentAnswer?.toString(),
      validate: (input: string) => this.validate(input, question),
      filter: (input: string) => {
        const num = parseFloat(input)
        return isNaN(num) ? input : num
      }
    }

    const result = await inquirer.prompt([promptConfig])
    return result.answer
  }

  validate(input: string, question: NumberQuestion): ValidationResult {
    const num = parseFloat(input)
    
    if (isNaN(num)) {
      return { isValid: false, message: 'Please enter a valid number' }
    }

    const rules = question.validation
    if (!rules) return { isValid: true }

    if (rules.integer && !Number.isInteger(num)) {
      return { isValid: false, message: 'Please enter a whole number' }
    }

    if (rules.min !== undefined && num < rules.min) {
      return { 
        isValid: false, 
        message: `Minimum value is ${rules.min}` 
      }
    }

    if (rules.max !== undefined && num > rules.max) {
      return { 
        isValid: false, 
        message: `Maximum value is ${rules.max}` 
      }
    }

    return { isValid: true }
  }
}
```

### 4. Date Input Component

#### Implementation
```typescript
class DateInputComponent implements QuestionComponent {
  async render(question: DateQuestion, currentAnswer?: string): Promise<string> {
    const promptConfig = {
      type: 'input',
      name: 'answer',
      message: `${this.formatMessage(question)} (YYYY-MM-DD)`,
      default: currentAnswer,
      validate: (input: string) => this.validate(input, question),
      transformer: (input: string) => this.formatDateDisplay(input)
    }

    const result = await inquirer.prompt([promptConfig])
    return result.answer
  }

  validate(input: string, question: DateQuestion): ValidationResult {
    if (!input && question.required) {
      return { isValid: false, message: 'Date is required' }
    }

    if (!input) return { isValid: true }

    // Validate date format
    const dateRegex = /^\d{4}-\d{2}-\d{2}$/
    if (!dateRegex.test(input)) {
      return { 
        isValid: false, 
        message: 'Please enter date in YYYY-MM-DD format' 
      }
    }

    const date = new Date(input)
    if (isNaN(date.getTime())) {
      return { isValid: false, message: 'Please enter a valid date' }
    }

    const rules = question.validation
    if (rules) {
      if (rules.minDate) {
        const minDate = rules.minDate === 'today' ? new Date() : new Date(rules.minDate)
        if (date < minDate) {
          return { 
            isValid: false, 
            message: `Date must be after ${minDate.toISOString().split('T')[0]}` 
          }
        }
      }

      if (rules.maxDate && date > new Date(rules.maxDate)) {
        return { 
          isValid: false, 
          message: `Date must be before ${rules.maxDate}` 
        }
      }
    }

    return { isValid: true }
  }
}
```

### 5. Rating Component

#### Implementation
```typescript
class RatingComponent implements QuestionComponent {
  async render(question: RatingQuestion, currentAnswer?: number): Promise<number> {
    const min = question.validation?.min || 1
    const max = question.validation?.max || 5
    
    const choices = []
    for (let i = min; i <= max; i++) {
      choices.push({
        name: `${i} ${this.getRatingLabel(i, min, max)}`,
        value: i
      })
    }

    const promptConfig = {
      type: 'list',
      name: 'answer',
      message: this.formatMessage(question),
      choices,
      default: currentAnswer
    }

    const result = await inquirer.prompt([promptConfig])
    return result.answer
  }

  private getRatingLabel(value: number, min: number, max: number): string {
    if (value === min) return '(Poor)'
    if (value === max) return '(Excellent)'
    if (value === Math.floor((min + max) / 2)) return '(Average)'
    return ''
  }
}
```

## Component Factory

### Component Registration
```typescript
class ComponentFactory {
  private static components = new Map<QuestionType, QuestionComponent>()

  static register(type: QuestionType, component: QuestionComponent): void {
    this.components.set(type, component)
  }

  static create(question: Question): QuestionComponent {
    const component = this.components.get(question.type)
    if (!component) {
      throw new Error(`No component registered for question type: ${question.type}`)
    }
    return component
  }

  static init(): void {
    this.register(QuestionType.TEXT, new TextInputComponent())
    this.register(QuestionType.NUMBER, new NumberInputComponent())
    this.register(QuestionType.EMAIL, new EmailInputComponent())
    this.register(QuestionType.SINGLE_CHOICE, new SingleChoiceComponent())
    this.register(QuestionType.MULTIPLE_CHOICE, new MultipleChoiceComponent())
    this.register(QuestionType.BOOLEAN, new BooleanComponent())
    this.register(QuestionType.DATE, new DateInputComponent())
    this.register(QuestionType.RATING, new RatingComponent())
  }
}
```

## File Structure
```
src/ui/
├── components/
│   ├── base/
│   │   ├── question-component.ts    # Base component interface
│   │   ├── component-factory.ts     # Component factory
│   │   └── validation-helpers.ts    # Validation utilities
│   ├── inputs/
│   │   ├── text-input.ts           # Text input component
│   │   ├── number-input.ts         # Number input component
│   │   ├── email-input.ts          # Email input component
│   │   └── date-input.ts           # Date input component
│   ├── choices/
│   │   ├── single-choice.ts        # Single choice component
│   │   ├── multiple-choice.ts      # Multiple choice component
│   │   ├── boolean.ts              # Boolean component
│   │   └── rating.ts               # Rating component
│   └── display/
│       ├── progress.ts             # Progress indicator
│       ├── message-formatter.ts    # Message formatting
│       └── theme.ts                # UI theme configuration
```

## Testing Requirements

### Component Testing
- Unit tests for each component
- Validation testing with various inputs
- Error handling scenarios
- User interaction simulation

### Integration Testing
- Component factory testing
- Prompt registration testing
- End-to-end question flow testing

## Styling and Theming

### Color Scheme
```typescript
const theme = {
  primary: chalk.blue,
  success: chalk.green,
  warning: chalk.yellow,
  error: chalk.red,
  info: chalk.cyan,
  muted: chalk.gray
}
```

### Message Formatting
```typescript
class MessageFormatter {
  static formatQuestion(question: Question): string {
    let message = theme.primary(question.text)
    
    if (question.description) {
      message += `\n${theme.muted(question.description)}`
    }
    
    if (question.required) {
      message += theme.error(' *')
    }
    
    return message
  }

  static formatError(message: string): string {
    return theme.error(`✗ ${message}`)
  }

  static formatSuccess(message: string): string {
    return theme.success(`✓ ${message}`)
  }
}
```

## Accessibility Features

### Keyboard Navigation
- Full keyboard support for all components
- Clear focus indicators
- Skip and navigation options

### Screen Reader Support
- Descriptive labels and messages
- Progress announcements
- Error message clarity

## Acceptance Criteria
- [ ] All question types have working UI components
- [ ] Real-time validation works for all input types
- [ ] Components follow consistent design patterns
- [ ] Error messages are clear and helpful
- [ ] Keyboard navigation works properly
- [ ] Component factory creates correct components
- [ ] All components are thoroughly tested
- [ ] UI is responsive and works in different terminal sizes
- [ ] Styling is consistent across all components
- [ ] Performance is acceptable for complex forms

## Dependencies
- Inquirer.js (prompting framework)
- Chalk (terminal styling)
- Validator.js (input validation)
- Date-fns (date handling)

## Estimated Duration: 18 hours