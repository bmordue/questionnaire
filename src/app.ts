import process from 'node:process';
import { parseArgs } from 'node:util';
import { fileURLToPath } from 'node:url';
import { existsSync } from 'fs';
import { runQuestionnaire } from './runner.js';
import type { RunnerOptions } from './runner.js';
import { MessageFormatter } from './ui/components/index.js';

function printHelp(): void {
  console.log(
    [
      'Usage:',
      '  npm start -- --questionnaire <path> [--resume <sessionId>] [--data <directory>]',
      '  npm run start:dev -- --questionnaire <path> [--resume <sessionId>] [--data <directory>]',
      '',
      'Options:',
      '  -q, --questionnaire   Path to questionnaire JSON file (required)',
      '  -r, --resume          Resume an existing session by ID',
      '  -d, --data            Data directory (default: ./data)',
      '  -h, --help            Show this help message'
    ].join('\n')
  );
}

function resolveArgs(): {
  questionnaire?: string;
  resume?: string;
  data?: string;
  help?: boolean;
} {
  try {
    const { values } = parseArgs({
      args: process.argv.slice(2),
      options: {
        questionnaire: { type: 'string', short: 'q' },
        resume: { type: 'string', short: 'r' },
        data: { type: 'string', short: 'd' },
        help: { type: 'boolean', short: 'h' }
      }
    });

    return values as {
      questionnaire?: string;
      resume?: string;
      data?: string;
      help?: boolean;
    };
  } catch (error) {
    // Handle missing values (e.g., --resume without an ID)
    const message =
      error instanceof Error && error.message.includes('--resume')
        ? '--resume requires a session ID value'
        : error instanceof Error
          ? error.message
          : String(error);

    console.error(MessageFormatter.formatError(message));
    process.exit(1);
  }
}

export async function main(): Promise<void> {
  const args = resolveArgs();

  if (args.help || !args.questionnaire) {
    printHelp();
    process.exit(args.help ? 0 : 1);
  }

  const questionnairePath = args.questionnaire;
  const resumeId = args.resume;
  const dataDirectory = args.data;

  if (!questionnairePath) {
    console.error(MessageFormatter.formatError('Missing --questionnaire <path> argument'));
    printHelp();
    process.exit(1);
  }

  if (!existsSync(questionnairePath)) {
    console.error(
      MessageFormatter.formatError(`Questionnaire file not found: ${questionnairePath}`)
    );
    process.exit(1);
  }

  try {
    const runOptions: RunnerOptions = { questionnairePath };
    if (resumeId) runOptions.sessionId = resumeId;
    if (dataDirectory) runOptions.dataDirectory = dataDirectory;

    await runQuestionnaire(runOptions);
  } catch (error) {
    console.error(
      MessageFormatter.formatError(
        error instanceof Error ? error.message : String(error)
      )
    );
    process.exit(1);
  }
}

const entrypoint = fileURLToPath(import.meta.url);
if (process.argv[1] === entrypoint) {
  void main();
}
