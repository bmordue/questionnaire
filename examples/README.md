# Markdown Conversion Examples

This directory contains sample questionnaire responses and their converted markdown outputs.

## Sample Files

### Basic Example
- **Response**: `sample-response.json` - A completed response to the simple text survey
- **Questionnaire**: `../fixtures/basic/simple-text-survey.json`
- **Output**: `sample-response.md` - Generated markdown document

### Advanced Example
- **Response**: `sample-customer-response.json` - Customer satisfaction survey response
- **Questionnaire**: `../fixtures/advanced/customer-feedback.json`
- **Output**: `sample-customer-response.md` - Generated markdown document

## How to Generate

To generate markdown from a response:

```bash
npm run markdown-convert -- <response.json> <questionnaire.json> [output.md]
```

### Examples

Convert to stdout:
```bash
npm run markdown-convert -- examples/sample-response.json fixtures/basic/simple-text-survey.json
```

Convert to file:
```bash
npm run markdown-convert -- examples/sample-response.json fixtures/basic/simple-text-survey.json examples/output.md
```

## Output Format

The generated markdown includes:

1. **Title** - From the questionnaire metadata
2. **Metadata** - Response ID, status, timestamps, duration, session info
3. **Progress** - Questions answered, completion percentage
4. **Responses** - All questions with their answers formatted appropriately:
   - Text: Plain text or blockquotes for multi-line
   - Numbers: Numeric values
   - Boolean: Yes/No
   - Rating: Numeric value with star visualization
   - Single Choice: Selected option label
   - Multiple Choice: Bulleted list of selected options
   - Date: Formatted date
   - Email: Email address

## Use Cases

The markdown format is optimized for:
- **LLM Consumption**: Clear, structured format for AI analysis
- **Human Review**: Easy to read and understand
- **Documentation**: Can be included in reports or documentation
- **Archival**: Text-based format for long-term storage

## Customization

You can customize the conversion programmatically:

```typescript
import { MarkdownConverter } from './src/utils/markdown-converter.js';

const markdown = MarkdownConverter.convertResponse(response, questionnaire, {
  includeMetadata: true,      // Include response metadata (default: true)
  includeProgress: true,       // Include progress information (default: true)
  includeTimestamps: false,    // Include answer timestamps (default: false)
  title: 'Custom Title'        // Override the title (default: questionnaire title)
});
```
