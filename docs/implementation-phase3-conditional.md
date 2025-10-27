# Phase 3 Task 1: Conditional Logic Engine

## Overview
Develop a sophisticated conditional logic engine that enables complex question branching, dynamic questionnaire flows, and advanced conditional behaviors based on user responses.

## Goals
- Support complex conditional expressions with multiple operators
- Enable dynamic question visibility and requirement changes
- Implement efficient condition evaluation and caching
- Support nested and chained conditionals
- Provide debugging and validation tools for complex logic

## Technical Approach

### 1. Conditional Logic Architecture

#### Expression System
```typescript
interface ConditionalExpression {
  type: 'condition' | 'group' | 'function'
  operator?: LogicalOperator
  conditions?: ConditionalExpression[]
  condition?: SimpleCondition
  function?: ConditionalFunction
}

interface SimpleCondition {
  questionId: string
  operator: ComparisonOperator
  value: any
  values?: any[]
}

type LogicalOperator = 'AND' | 'OR' | 'NOT'
type ComparisonOperator = 
  | 'equals' | 'notEquals'
  | 'greaterThan' | 'lessThan' 
  | 'greaterThanOrEqual' | 'lessThanOrEqual'
  | 'contains' | 'notContains'
  | 'in' | 'notIn'
  | 'matches' | 'notMatches'
  | 'isEmpty' | 'isNotEmpty'
  | 'hasLength' | 'hasMinLength' | 'hasMaxLength'
```

#### Advanced Conditional Features
- **Nested Groups**: Support AND/OR grouping with parentheses
- **Functions**: Built-in functions for complex evaluations
- **Variables**: Support for calculated values and constants
- **Time-based**: Conditions based on time, date, or duration
- **Cross-reference**: Conditions referencing multiple questions

## Implementation Tasks

### Task 1.1: Expression Parser (6 hours)
- [ ] Build conditional expression parser
- [ ] Implement operator precedence handling
- [ ] Create expression tree structure
- [ ] Add syntax validation and error reporting

### Task 1.2: Evaluation Engine (5 hours)
- [ ] Implement condition evaluation algorithms
- [ ] Create response context management
- [ ] Add caching for performance optimization
- [ ] Build evaluation result tracking

### Task 1.3: Advanced Features (4 hours)
- [ ] Implement conditional functions
- [ ] Add variable and constant support
- [ ] Create time-based condition support
- [ ] Build cross-reference validation

### Task 1.4: Debugging and Tools (3 hours)
- [ ] Create condition debugging utilities
- [ ] Implement logic validation tools
- [ ] Add performance monitoring
- [ ] Build condition testing framework

## Core Implementation

### 1. Expression Parser

```typescript
class ConditionalExpressionParser {
  parse(expression: string): ConditionalExpression {
    const tokens = this.tokenize(expression)
    return this.parseExpression(tokens)
  }

  private tokenize(expression: string): Token[] {
    const tokenRegex = /(\(|\)|AND|OR|NOT|[a-zA-Z_][a-zA-Z0-9_]*|[><=!]+|'[^']*'|"[^"]*"|\d+\.?\d*|\S)/g
    const matches = expression.match(tokenRegex) || []
    
    return matches.map((match, index) => ({
      type: this.getTokenType(match),
      value: match,
      position: index
    }))
  }

  private parseExpression(tokens: Token[]): ConditionalExpression {
    return this.parseOrExpression(tokens, { index: 0 })
  }

  private parseOrExpression(tokens: Token[], cursor: ParseCursor): ConditionalExpression {
    let left = this.parseAndExpression(tokens, cursor)

    while (cursor.index < tokens.length && tokens[cursor.index].value === 'OR') {
      cursor.index++ // consume OR
      const right = this.parseAndExpression(tokens, cursor)
      
      left = {
        type: 'group',
        operator: 'OR',
        conditions: [left, right]
      }
    }

    return left
  }

  private parseAndExpression(tokens: Token[], cursor: ParseCursor): ConditionalExpression {
    let left = this.parseNotExpression(tokens, cursor)

    while (cursor.index < tokens.length && tokens[cursor.index].value === 'AND') {
      cursor.index++ // consume AND
      const right = this.parseNotExpression(tokens, cursor)
      
      left = {
        type: 'group',
        operator: 'AND',
        conditions: [left, right]
      }
    }

    return left
  }

  private parseNotExpression(tokens: Token[], cursor: ParseCursor): ConditionalExpression {
    if (cursor.index < tokens.length && tokens[cursor.index].value === 'NOT') {
      cursor.index++ // consume NOT
      const expression = this.parsePrimaryExpression(tokens, cursor)
      
      return {
        type: 'group',
        operator: 'NOT',
        conditions: [expression]
      }
    }

    return this.parsePrimaryExpression(tokens, cursor)
  }

  private parsePrimaryExpression(tokens: Token[], cursor: ParseCursor): ConditionalExpression {
    if (cursor.index >= tokens.length) {
      throw new ParseError('Unexpected end of expression')
    }

    const token = tokens[cursor.index]

    // Parenthesized expression
    if (token.value === '(') {
      cursor.index++ // consume (
      const expression = this.parseOrExpression(tokens, cursor)
      
      if (cursor.index >= tokens.length || tokens[cursor.index].value !== ')') {
        throw new ParseError('Expected closing parenthesis')
      }
      cursor.index++ // consume )
      
      return expression
    }

    // Function call
    if (this.isFunction(token.value)) {
      return this.parseFunction(tokens, cursor)
    }

    // Simple condition
    return this.parseSimpleCondition(tokens, cursor)
  }

  private parseSimpleCondition(tokens: Token[], cursor: ParseCursor): ConditionalExpression {
    const questionId = this.consumeToken(tokens, cursor, 'IDENTIFIER').value
    const operatorToken = this.consumeToken(tokens, cursor, 'OPERATOR')
    const operator = operatorToken.value as ComparisonOperator

    let value: any
    let values: any[] | undefined

    // Handle different operator types
    if (operator === 'in' || operator === 'notIn') {
      // Expect array of values: question in ['value1', 'value2']
      this.consumeToken(tokens, cursor, 'BRACKET_OPEN')
      values = this.parseValueArray(tokens, cursor)
      this.consumeToken(tokens, cursor, 'BRACKET_CLOSE')
    } else if (operator === 'isEmpty' || operator === 'isNotEmpty') {
      // No value needed for these operators
      value = null
    } else {
      // Single value
      value = this.parseValue(tokens, cursor)
    }

    return {
      type: 'condition',
      condition: {
        questionId,
        operator,
        value,
        values
      }
    }
  }
}
```

### 2. Conditional Evaluation Engine

```typescript
class ConditionalEvaluationEngine {
  private cache = new Map<string, EvaluationResult>()
  private functions = new Map<string, ConditionalFunction>()

  constructor() {
    this.registerBuiltinFunctions()
  }

  evaluate(
    expression: ConditionalExpression, 
    context: EvaluationContext
  ): EvaluationResult {
    const cacheKey = this.getCacheKey(expression, context)
    
    if (this.cache.has(cacheKey)) {
      return this.cache.get(cacheKey)!
    }

    const result = this.evaluateExpression(expression, context)
    this.cache.set(cacheKey, result)
    
    return result
  }

  private evaluateExpression(
    expression: ConditionalExpression, 
    context: EvaluationContext
  ): EvaluationResult {
    switch (expression.type) {
      case 'condition':
        return this.evaluateCondition(expression.condition!, context)
      
      case 'group':
        return this.evaluateGroup(expression, context)
      
      case 'function':
        return this.evaluateFunction(expression.function!, context)
      
      default:
        throw new EvaluationError(`Unknown expression type: ${expression.type}`)
    }
  }

  private evaluateCondition(
    condition: SimpleCondition, 
    context: EvaluationContext
  ): EvaluationResult {
    const questionValue = context.responses.get(condition.questionId)
    const result = this.compareValues(questionValue, condition.operator, condition.value, condition.values)

    return {
      result,
      dependencies: [condition.questionId],
      evaluatedAt: new Date()
    }
  }

  private evaluateGroup(
    expression: ConditionalExpression, 
    context: EvaluationContext
  ): EvaluationResult {
    const conditions = expression.conditions!
    const operator = expression.operator!

    switch (operator) {
      case 'AND': {
        const results = conditions.map(cond => this.evaluateExpression(cond, context))
        const allTrue = results.every(r => r.result)
        const dependencies = results.flatMap(r => r.dependencies)
        
        return {
          result: allTrue,
          dependencies: [...new Set(dependencies)],
          evaluatedAt: new Date()
        }
      }

      case 'OR': {
        const results = conditions.map(cond => this.evaluateExpression(cond, context))
        const anyTrue = results.some(r => r.result)
        const dependencies = results.flatMap(r => r.dependencies)
        
        return {
          result: anyTrue,
          dependencies: [...new Set(dependencies)],
          evaluatedAt: new Date()
        }
      }

      case 'NOT': {
        if (conditions.length !== 1) {
          throw new EvaluationError('NOT operator expects exactly one condition')
        }
        
        const result = this.evaluateExpression(conditions[0], context)
        return {
          result: !result.result,
          dependencies: result.dependencies,
          evaluatedAt: new Date()
        }
      }

      default:
        throw new EvaluationError(`Unknown logical operator: ${operator}`)
    }
  }

  private compareValues(
    questionValue: any, 
    operator: ComparisonOperator, 
    expectedValue: any, 
    expectedValues?: any[]
  ): boolean {
    switch (operator) {
      case 'equals':
        return questionValue === expectedValue

      case 'notEquals':
        return questionValue !== expectedValue

      case 'greaterThan':
        return typeof questionValue === 'number' && 
               typeof expectedValue === 'number' && 
               questionValue > expectedValue

      case 'lessThan':
        return typeof questionValue === 'number' && 
               typeof expectedValue === 'number' && 
               questionValue < expectedValue

      case 'greaterThanOrEqual':
        return typeof questionValue === 'number' && 
               typeof expectedValue === 'number' && 
               questionValue >= expectedValue

      case 'lessThanOrEqual':
        return typeof questionValue === 'number' && 
               typeof expectedValue === 'number' && 
               questionValue <= expectedValue

      case 'contains':
        return Array.isArray(questionValue) && questionValue.includes(expectedValue)

      case 'notContains':
        return !Array.isArray(questionValue) || !questionValue.includes(expectedValue)

      case 'in':
        return expectedValues ? expectedValues.includes(questionValue) : false

      case 'notIn':
        return expectedValues ? !expectedValues.includes(questionValue) : true

      case 'matches':
        return typeof questionValue === 'string' && 
               new RegExp(expectedValue).test(questionValue)

      case 'notMatches':
        return typeof questionValue !== 'string' || 
               !new RegExp(expectedValue).test(questionValue)

      case 'isEmpty':
        return questionValue === null || 
               questionValue === undefined || 
               questionValue === '' || 
               (Array.isArray(questionValue) && questionValue.length === 0)

      case 'isNotEmpty':
        return questionValue !== null && 
               questionValue !== undefined && 
               questionValue !== '' && 
               (!Array.isArray(questionValue) || questionValue.length > 0)

      case 'hasLength':
        return (typeof questionValue === 'string' || Array.isArray(questionValue)) &&
               questionValue.length === expectedValue

      case 'hasMinLength':
        return (typeof questionValue === 'string' || Array.isArray(questionValue)) &&
               questionValue.length >= expectedValue

      case 'hasMaxLength':
        return (typeof questionValue === 'string' || Array.isArray(questionValue)) &&
               questionValue.length <= expectedValue

      default:
        throw new EvaluationError(`Unknown comparison operator: ${operator}`)
    }
  }
}
```

### 3. Conditional Functions

```typescript
class ConditionalFunctionRegistry {
  private functions = new Map<string, ConditionalFunction>()

  constructor() {
    this.registerBuiltinFunctions()
  }

  register(name: string, func: ConditionalFunction): void {
    this.functions.set(name, func)
  }

  execute(name: string, args: any[], context: EvaluationContext): any {
    const func = this.functions.get(name)
    if (!func) {
      throw new Error(`Unknown function: ${name}`)
    }

    return func.execute(args, context)
  }

  private registerBuiltinFunctions(): void {
    // Count function: count(questionId, value)
    this.register('count', {
      execute: (args: any[], context: EvaluationContext) => {
        const [questionId, value] = args
        const questionValue = context.responses.get(questionId)
        
        if (!Array.isArray(questionValue)) {
          return 0
        }

        return questionValue.filter(v => v === value).length
      }
    })

    // Sum function: sum(questionId1, questionId2, ...)
    this.register('sum', {
      execute: (args: any[], context: EvaluationContext) => {
        return args.reduce((total, questionId) => {
          const value = context.responses.get(questionId)
          return total + (typeof value === 'number' ? value : 0)
        }, 0)
      }
    })

    // Average function: avg(questionId1, questionId2, ...)
    this.register('avg', {
      execute: (args: any[], context: EvaluationContext) => {
        const validValues = args
          .map(questionId => context.responses.get(questionId))
          .filter(value => typeof value === 'number')
        
        if (validValues.length === 0) return 0
        
        const sum = validValues.reduce((a, b) => a + b, 0)
        return sum / validValues.length
      }
    })

    // Date comparison: daysAgo(questionId)
    this.register('daysAgo', {
      execute: (args: any[], context: EvaluationContext) => {
        const [questionId] = args
        const dateValue = context.responses.get(questionId)
        
        if (!dateValue) return null
        
        const date = new Date(dateValue)
        const now = new Date()
        const diffTime = Math.abs(now.getTime() - date.getTime())
        const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24))
        
        return diffDays
      }
    })

    // Text length: length(questionId)
    this.register('length', {
      execute: (args: any[], context: EvaluationContext) => {
        const [questionId] = args
        const value = context.responses.get(questionId)
        
        if (typeof value === 'string' || Array.isArray(value)) {
          return value.length
        }
        
        return 0
      }
    })

    // Answered count: answeredCount(questionId1, questionId2, ...)
    this.register('answeredCount', {
      execute: (args: any[], context: EvaluationContext) => {
        return args.filter(questionId => {
          const value = context.responses.get(questionId)
          return value !== null && value !== undefined && value !== ''
        }).length
      }
    })
  }
}
```

### 4. Advanced Conditional Logic Manager

```typescript
class ConditionalLogicManager {
  private parser: ConditionalExpressionParser
  private evaluator: ConditionalEvaluationEngine
  private functionRegistry: ConditionalFunctionRegistry
  private dependencyGraph: DependencyGraph

  constructor() {
    this.parser = new ConditionalExpressionParser()
    this.evaluator = new ConditionalEvaluationEngine()
    this.functionRegistry = new ConditionalFunctionRegistry()
    this.dependencyGraph = new DependencyGraph()
  }

  async evaluateQuestionVisibility(
    question: Question,
    context: EvaluationContext
  ): Promise<VisibilityResult> {
    if (!question.conditional) {
      return { visible: true, dependencies: [] }
    }

    let visible = true
    const dependencies: string[] = []

    // Evaluate showIf condition
    if (question.conditional.showIf) {
      const showResult = await this.evaluateConditionString(
        question.conditional.showIf,
        context
      )
      visible = visible && showResult.result
      dependencies.push(...showResult.dependencies)
    }

    // Evaluate hideIf condition
    if (question.conditional.hideIf) {
      const hideResult = await this.evaluateConditionString(
        question.conditional.hideIf,
        context
      )
      visible = visible && !hideResult.result
      dependencies.push(...hideResult.dependencies)
    }

    return {
      visible,
      dependencies: [...new Set(dependencies)]
    }
  }

  async evaluateQuestionRequirement(
    question: Question,
    context: EvaluationContext
  ): Promise<RequirementResult> {
    let required = question.required || false
    const dependencies: string[] = []

    // Evaluate requiredIf condition
    if (question.conditional?.requiredIf) {
      const result = await this.evaluateConditionString(
        question.conditional.requiredIf,
        context
      )
      required = required || result.result
      dependencies.push(...result.dependencies)
    }

    // Evaluate notRequiredIf condition
    if (question.conditional?.notRequiredIf) {
      const result = await this.evaluateConditionString(
        question.conditional.notRequiredIf,
        context
      )
      required = required && !result.result
      dependencies.push(...result.dependencies)
    }

    return {
      required,
      dependencies: [...new Set(dependencies)]
    }
  }

  buildDependencyGraph(questionnaire: Questionnaire): DependencyGraph {
    const graph = new DependencyGraph()

    for (const question of questionnaire.questions) {
      if (question.conditional) {
        const dependencies = this.extractDependencies(question.conditional)
        
        for (const dependency of dependencies) {
          graph.addDependency(question.id, dependency)
        }
      }
    }

    return graph
  }

  validateConditionalLogic(questionnaire: Questionnaire): ValidationResult {
    const errors: string[] = []
    const warnings: string[] = []

    // Check for circular dependencies
    const dependencyGraph = this.buildDependencyGraph(questionnaire)
    const cycles = dependencyGraph.findCycles()
    
    if (cycles.length > 0) {
      errors.push(`Circular dependencies found: ${cycles.map(c => c.join(' -> ')).join(', ')}`)
    }

    // Validate all conditional expressions
    for (const question of questionnaire.questions) {
      if (question.conditional) {
        try {
          this.validateConditionalExpressions(question.conditional)
        } catch (error) {
          errors.push(`Invalid conditional logic in question ${question.id}: ${error.message}`)
        }
      }
    }

    // Check for unreachable questions
    const unreachableQuestions = this.findUnreachableQuestions(questionnaire)
    if (unreachableQuestions.length > 0) {
      warnings.push(`Potentially unreachable questions: ${unreachableQuestions.join(', ')}`)
    }

    return {
      isValid: errors.length === 0,
      errors,
      warnings
    }
  }

  private async evaluateConditionString(
    conditionString: string,
    context: EvaluationContext
  ): Promise<EvaluationResult> {
    const expression = this.parser.parse(conditionString)
    return this.evaluator.evaluate(expression, context)
  }
}
```

### 5. Dependency Graph

```typescript
class DependencyGraph {
  private dependencies = new Map<string, Set<string>>()
  private reverseDependencies = new Map<string, Set<string>>()

  addDependency(dependent: string, dependency: string): void {
    if (!this.dependencies.has(dependent)) {
      this.dependencies.set(dependent, new Set())
    }
    this.dependencies.get(dependent)!.add(dependency)

    if (!this.reverseDependencies.has(dependency)) {
      this.reverseDependencies.set(dependency, new Set())
    }
    this.reverseDependencies.get(dependency)!.add(dependent)
  }

  getDependencies(node: string): string[] {
    return Array.from(this.dependencies.get(node) || [])
  }

  getDependents(node: string): string[] {
    return Array.from(this.reverseDependencies.get(node) || [])
  }

  findCycles(): string[][] {
    const cycles: string[][] = []
    const visited = new Set<string>()
    const recursionStack = new Set<string>()

    for (const node of this.dependencies.keys()) {
      if (!visited.has(node)) {
        const cycle = this.detectCycleFromNode(node, visited, recursionStack, [])
        if (cycle) {
          cycles.push(cycle)
        }
      }
    }

    return cycles
  }

  private detectCycleFromNode(
    node: string,
    visited: Set<string>,
    recursionStack: Set<string>,
    path: string[]
  ): string[] | null {
    visited.add(node)
    recursionStack.add(node)
    path.push(node)

    const dependencies = this.dependencies.get(node) || new Set()
    
    for (const dependency of dependencies) {
      if (!visited.has(dependency)) {
        const cycle = this.detectCycleFromNode(dependency, visited, recursionStack, path)
        if (cycle) return cycle
      } else if (recursionStack.has(dependency)) {
        // Found cycle
        const cycleStart = path.indexOf(dependency)
        return path.slice(cycleStart).concat([dependency])
      }
    }

    recursionStack.delete(node)
    path.pop()
    return null
  }
}
```

## File Structure
```
src/core/
├── conditional/
│   ├── expression-parser.ts        # Conditional expression parsing
│   ├── evaluation-engine.ts        # Condition evaluation
│   ├── function-registry.ts        # Conditional functions
│   ├── logic-manager.ts           # Main conditional logic coordinator
│   ├── dependency-graph.ts        # Dependency tracking
│   └── validators.ts              # Logic validation tools
├── types/
│   ├── conditional-types.ts       # Conditional logic types
│   ├── expression-types.ts        # Expression types
│   └── evaluation-types.ts        # Evaluation types
└── utils/
    ├── condition-helpers.ts        # Utility functions
    └── debug-tools.ts             # Debugging utilities
```

## Testing Requirements

### Unit Tests
- Expression parsing accuracy
- Evaluation engine correctness
- Function execution
- Dependency graph operations

### Integration Tests
- Complex conditional scenarios
- Performance with large questionnaires
- Edge cases and error handling

### Validation Tests
- Circular dependency detection
- Expression syntax validation
- Logic consistency checking

## Performance Optimization

### Caching Strategies
- Expression parse result caching
- Evaluation result caching
- Dependency graph caching
- Function result memoization

### Optimization Techniques
- Lazy evaluation of conditions
- Short-circuit evaluation for AND/OR
- Efficient dependency tracking
- Minimal re-evaluation on changes

## Acceptance Criteria
- [ ] Complex conditional expressions parse correctly
- [ ] All comparison operators work accurately
- [ ] Logical operators (AND/OR/NOT) function properly
- [ ] Built-in functions execute correctly
- [ ] Dependency tracking is accurate
- [ ] Circular dependency detection works
- [ ] Performance is acceptable for complex logic
- [ ] Error handling is comprehensive
- [ ] Debugging tools are effective
- [ ] Validation catches all logic errors

## Dependencies
- Expression parsing libraries
- Date/time utilities
- Performance monitoring tools
- Graph algorithm libraries

