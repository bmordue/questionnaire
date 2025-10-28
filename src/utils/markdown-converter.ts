/**
 * Markdown Converter Utility
 * 
 * Converts questionnaire responses in JSON format to markdown documents
 * optimized for consumption by LLMs.
 */

import type { QuestionnaireResponse } from '../core/schema.js';
import type { Questionnaire, Question } from '../core/schema.js';

/**
 * Options for markdown conversion
 */
export interface MarkdownConverterOptions {
  /** Include response metadata in output */
  includeMetadata?: boolean;
  /** Include progress information */
  includeProgress?: boolean;
  /** Include timestamps for each answer */
  includeTimestamps?: boolean;
  /** Title for the markdown document */
  title?: string;
}

/**
 * Converts a questionnaire response to markdown format
 */
export class MarkdownConverter {
  /**
   * Convert a response and its associated questionnaire to markdown
   */
  static convertResponse(
    response: QuestionnaireResponse,
    questionnaire: Questionnaire,
    options: MarkdownConverterOptions = {}
  ): string {
    const sections: string[] = [];

    // Title section
    sections.push(this.generateTitle(questionnaire, options));

    // Metadata section
    if (options.includeMetadata !== false) {
      sections.push(this.generateMetadata(response, questionnaire));
    }

    // Progress section
    if (options.includeProgress !== false) {
      sections.push(this.generateProgress(response));
    }

    // Responses section
    sections.push(this.generateResponses(response, questionnaire, options));

    return sections.filter(s => s.length > 0).join('\n\n');
  }

  /**
   * Generate the title section
   */
  private static generateTitle(
    questionnaire: Questionnaire,
    options: MarkdownConverterOptions
  ): string {
    const title = options.title || questionnaire.metadata.title;
    return `# ${title}\n`;
  }

  /**
   * Generate metadata section
   */
  private static generateMetadata(
    response: QuestionnaireResponse,
    questionnaire: Questionnaire
  ): string {
    const lines: string[] = ['## Metadata'];

    lines.push(`- **Response ID**: ${response.id}`);
    lines.push(`- **Questionnaire**: ${questionnaire.metadata.title} (v${questionnaire.version})`);
    lines.push(`- **Status**: ${this.formatStatus(response.status)}`);
    lines.push(`- **Started**: ${this.formatDateTime(response.startedAt)}`);

    if (response.completedAt) {
      lines.push(`- **Completed**: ${this.formatDateTime(response.completedAt)}`);
      const duration = this.calculateDuration(response.startedAt, response.completedAt);
      if (duration) {
        lines.push(`- **Duration**: ${duration}`);
      }
    }

    if (response.sessionId) {
      lines.push(`- **Session ID**: ${response.sessionId}`);
    }

    // Additional metadata if available
    if (response.metadata) {
      const customMetadata = Object.entries(response.metadata)
        .map(([key, value]) => `- **${this.formatKey(key)}**: ${value}`)
        .join('\n');
      if (customMetadata) {
        lines.push(customMetadata);
      }
    }

    return lines.join('\n');
  }

  /**
   * Generate progress section
   */
  private static generateProgress(response: QuestionnaireResponse): string {
    const lines: string[] = ['## Progress'];

    const { currentQuestionIndex, totalQuestions, answeredCount } = response.progress;
    const completionPercent = totalQuestions > 0
      ? Math.round((answeredCount / totalQuestions) * 100)
      : 0;

    lines.push(`- **Questions Answered**: ${answeredCount} of ${totalQuestions} (${completionPercent}%)`);
    lines.push(`- **Current Question**: ${currentQuestionIndex + 1} of ${totalQuestions}`);

    return lines.join('\n');
  }

  /**
   * Generate responses section
   */
  private static generateResponses(
    response: QuestionnaireResponse,
    questionnaire: Questionnaire,
    options: MarkdownConverterOptions
  ): string {
    const lines: string[] = ['## Responses'];

    // Create a map of answers by question ID for quick lookup
    const answerMap = new Map(
      response.answers.map(answer => [answer.questionId, answer])
    );

    // Iterate through questions in order
    questionnaire.questions.forEach((question, index) => {
      const answer = answerMap.get(question.id);

      lines.push(`\n### ${index + 1}. ${question.text}`);

      if (question.description) {
        lines.push(`*${question.description}*`);
      }

      // Question type and requirements
      const metadata: string[] = [];
      metadata.push(`Type: ${question.type}`);
      if (question.required) {
        metadata.push('Required');
      }
      lines.push(`*${metadata.join(' | ')}*`);

      // Answer value
      if (answer) {
        const formattedValue = this.formatAnswerValue(answer.value, question);
        lines.push(`\n**Answer**: ${formattedValue}`);

        if (options.includeTimestamps) {
          lines.push(`*Answered at: ${this.formatDateTime(answer.answeredAt)}*`);
        }
      } else {
        lines.push(`\n**Answer**: *(No response)*`);
      }
    });

    return lines.join('\n');
  }

  /**
   * Format answer value based on question type
   */
  private static formatAnswerValue(value: any, question: Question): string {
    if (value === null || value === undefined) {
      return '*(No response)*';
    }

    switch (question.type) {
      case 'boolean':
        return value ? 'Yes' : 'No';

      case 'multiple_choice':
        if (Array.isArray(value)) {
          if (value.length === 0) {
            return '*(None selected)*';
          }
          const options = question.options || [];
          const labels = value.map(v => {
            const option = options.find(opt => opt.value === v);
            return option ? option.label : v;
          });
          return labels.map(label => `- ${label}`).join('\n');
        }
        return String(value);

      case 'single_choice':
        if (question.options) {
          const option = question.options.find(opt => opt.value === value);
          return option ? option.label : String(value);
        }
        return String(value);

      case 'date':
        try {
          const date = new Date(value);
          return date.toLocaleDateString('en-US', {
            year: 'numeric',
            month: 'long',
            day: 'numeric'
          });
        } catch {
          return String(value);
        }

      case 'rating':
        return `${value} ${this.generateRatingStars(value, question)}`;

      case 'text':
      case 'email':
      case 'number':
      default:
        // Escape markdown special characters in text values
        const strValue = String(value);
        if (strValue.includes('\n')) {
          // Multi-line text: use blockquote
          return '\n> ' + strValue.split('\n').join('\n> ');
        }
        return strValue;
    }
  }

  /**
   * Generate star rating visualization
   */
  private static generateRatingStars(value: number, question: Question): string {
    const validation = question.validation as { min?: number; max?: number } | undefined;
    const max = validation?.max || 5;
    const filled = '★'.repeat(Math.min(value, max));
    const empty = '☆'.repeat(Math.max(0, max - value));
    return `(${filled}${empty})`;
  }

  /**
   * Format status enum to human-readable text
   */
  private static formatStatus(status: string): string {
    return status
      .split('_')
      .map(word => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
      .join(' ');
  }

  /**
   * Format ISO datetime string to human-readable format
   */
  private static formatDateTime(isoString: string): string {
    try {
      const date = new Date(isoString);
      return date.toLocaleString('en-US', {
        year: 'numeric',
        month: 'long',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
        timeZoneName: 'short'
      });
    } catch {
      return isoString;
    }
  }

  /**
   * Calculate duration between two timestamps
   */
  private static calculateDuration(startISO: string, endISO: string): string | null {
    try {
      const start = new Date(startISO).getTime();
      const end = new Date(endISO).getTime();
      const durationMs = end - start;

      const seconds = Math.floor(durationMs / 1000);
      const minutes = Math.floor(seconds / 60);
      const hours = Math.floor(minutes / 60);

      if (hours > 0) {
        const remainingMinutes = minutes % 60;
        return `${hours}h ${remainingMinutes}m`;
      } else if (minutes > 0) {
        const remainingSeconds = seconds % 60;
        return `${minutes}m ${remainingSeconds}s`;
      } else {
        return `${seconds}s`;
      }
    } catch {
      return null;
    }
  }

  /**
   * Format a camelCase or snake_case key to Title Case
   */
  private static formatKey(key: string): string {
    return key
      .replace(/([A-Z])/g, ' $1')
      .replace(/_/g, ' ')
      .split(' ')
      .map(word => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
      .join(' ')
      .trim();
  }
}
