import path from 'path';
import process from 'node:process';
import { readFile } from 'fs/promises';
import { existsSync } from 'fs';
import { ExitPromptError } from '@inquirer/core';

import { QuestionnaireFlowEngine } from './core/flow/flow-engine.js';
import { NavigationManager } from './core/flow/navigation-manager.js';
import { PersistenceManager } from './core/persistence/persistence-manager.js';
import { FileStorageService } from './core/storage.js';
import { safeValidateQuestionnaire } from './core/schema.js';
import { formatZodError } from './core/schemas/validation.js';
import { ResponseStatus, type QuestionnaireResponse, type Questionnaire, type Question } from './core/schema.js';
import { ConditionalLogicEngine } from './core/flow/conditional-logic.js';
import type { ProgressInfo } from './core/types/flow-types.js';
import { ComponentFactory, initializeComponents, MessageFormatter } from './ui/components/index.js';

export interface RunnerOptions {
  questionnairePath: string;
  sessionId?: string;
  dataDirectory?: string;
}

export interface RunnerResult {
  sessionId: string;
  responseId: string;
  answeredCount: number;
  skippedCount: number;
  completed: boolean;
}

type SignalHandler = (() => void) | null;

function buildResponseMap(response: QuestionnaireResponse): Map<string, any> {
  const map = new Map<string, any>();

  for (const answer of response.answers) {
    if (!answer.skipped) {
      map.set(answer.questionId, answer.value);
    }
  }

  return map;
}

function findFirstPendingQuestion(
  questionnaire: Questionnaire,
  responses: Map<string, any>
): { question: Question | null; skipped: Set<string> } {
  const logic = new ConditionalLogicEngine();
  const skipped = new Set<string>();

  for (const question of questionnaire.questions) {
    if (!logic.shouldShowQuestion(question, responses) || logic.shouldSkipQuestion(question, responses)) {
      skipped.add(question.id);
      continue;
    }

    if (!responses.has(question.id)) {
      return { question, skipped };
    }
  }

  return { question: null, skipped };
}

function displayProgressHeader(progress: ProgressInfo): void {
  const totalLabel = `~${progress.totalQuestions}`;
  const barLength = 10;
  const filledBlocks = Math.round((progress.percentComplete / 100) * barLength);
  const bar = `${'■'.repeat(filledBlocks)}${'░'.repeat(Math.max(0, barLength - filledBlocks))}`;

  console.log('──────────────────────────────────────────');
  console.log(` Question ${progress.currentQuestion} of ${totalLabel}  [${bar}]  ${progress.percentComplete}%`);
  console.log('──────────────────────────────────────────');
}

async function loadQuestionnaire(questionnairePath: string): Promise<Questionnaire> {
  let content: string;

  try {
    content = await readFile(questionnairePath, 'utf-8');
  } catch (error) {
    const err = error as NodeJS.ErrnoException;
    if (err.code === 'ENOENT') {
      throw new Error(`Questionnaire file not found: ${questionnairePath}`);
    }

    throw new Error(`Failed to read questionnaire: ${err.message || err}`);
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(content);
  } catch (error) {
    const err = error as Error;
    throw new Error(`Invalid JSON in questionnaire file: ${err.message}`);
  }

  const validation = safeValidateQuestionnaire(parsed);
  if (!validation.success) {
    const formatted = formatZodError(validation.error);
    const details = formatted.errors?.join('\n') || formatted.message || 'Questionnaire validation failed';
    throw new Error(`Questionnaire validation failed:\n${details}`);
  }

  return validation.data;
}

function formatCompletionSummary(response: QuestionnaireResponse, dataDirectory: string): string {
  const savePath = path.join(dataDirectory, 'responses', `${response.sessionId}.json`);
  const title = response.metadata?.title || 'Questionnaire';
  const answered = response.progress.answeredCount;
  const skipped = response.progress.skippedCount ?? 0;

  return [
    MessageFormatter.formatSuccess(`Completed "${title}"`),
    MessageFormatter.formatInfo(`Answers recorded: ${answered}`),
    MessageFormatter.formatInfo(`Skipped: ${skipped}`),
    MessageFormatter.formatMuted(`Saved to: ${savePath}`)
  ].join('\n');
}

function ensureQuestionnaireFileExists(questionnairePath: string): void {
  if (!existsSync(questionnairePath)) {
    throw new Error(`Questionnaire file not found: ${questionnairePath}`);
  }
}

/**
  * Run an interactive questionnaire session
  */
export async function runQuestionnaire(options: RunnerOptions): Promise<RunnerResult> {
  if (!process.stdin.isTTY) {
    throw new Error('Interactive mode requires a TTY terminal');
  }

  const questionnairePath = path.resolve(options.questionnairePath);
  ensureQuestionnaireFileExists(questionnairePath);

  const questionnaire = await loadQuestionnaire(questionnairePath);

  if (questionnaire.questions.length === 0) {
    console.log(MessageFormatter.formatWarning('Questionnaire has no questions.'));
    return {
      sessionId: '',
      responseId: '',
      answeredCount: 0,
      skippedCount: 0,
      completed: true
    };
  }

  initializeComponents();

  const dataDirectory = options.dataDirectory ?? './data';
  const storage = new FileStorageService({ dataDirectory });
  if ('initialize' in storage && typeof storage.initialize === 'function') {
    await storage.initialize();
  }

  await storage.saveQuestionnaire(questionnaire);

  const persistenceManager = new PersistenceManager(storage);
  const engine = new QuestionnaireFlowEngine(storage);
  const navManager = new NavigationManager(engine);

  let session: Awaited<ReturnType<PersistenceManager['startSession']>> | null = null;
  let usedResume = false;

  if (options.sessionId) {
    try {
      session = await persistenceManager.resumeSession(options.sessionId);
      usedResume = true;
    } catch (error) {
      console.log(
        MessageFormatter.formatWarning(
          `Could not resume session ${options.sessionId}: ${error instanceof Error ? error.message : String(error)}`
        )
      );
    }
  }

  if (!session) {
    session = await persistenceManager.startSession(questionnaire);
    usedResume = false;
  }

  if (!session) {
    throw new Error('Unable to start questionnaire session');
  }

  const responseSnapshot = session.responseBuilder.getResponse();
  const responsesMap = buildResponseMap(responseSnapshot);
  const pending = findFirstPendingQuestion(questionnaire, responsesMap);
  const startQuestionId = pending.question?.id ?? questionnaire.questions[0]!.id;

  if (usedResume) {
    try {
      await engine.loadState(session.sessionId);
    } catch {
      await engine.start(questionnaire.id, {
        sessionId: session.sessionId,
        initialResponses: responsesMap,
        skippedQuestions: pending.skipped,
        currentQuestionId: startQuestionId,
        startTime: new Date(responseSnapshot.startedAt)
      });
    }
  } else {
    await engine.start(questionnaire.id, {
      sessionId: session.sessionId,
      initialResponses: responsesMap,
      skippedQuestions: pending.skipped,
      currentQuestionId: startQuestionId,
      startTime: new Date(responseSnapshot.startedAt)
    });
  }

  if (responseSnapshot.status === ResponseStatus.COMPLETED || !pending.question) {
    const completed = responseSnapshot.status === ResponseStatus.COMPLETED
      ? responseSnapshot
      : await session.responseBuilder.complete();
    await persistenceManager.endSession();
    console.log(formatCompletionSummary(completed, dataDirectory));

    return {
      sessionId: session.sessionId,
      responseId: completed.id,
      answeredCount: completed.progress.answeredCount,
      skippedCount: completed.progress.skippedCount ?? 0,
      completed: true
    };
  }

  let sigintHandler: SignalHandler = null;
  let sigtermHandler: SignalHandler = null;

  const cleanupSignals = () => {
    if (sigintHandler) process.off('SIGINT', sigintHandler);
    if (sigtermHandler) process.off('SIGTERM', sigtermHandler);
    sigintHandler = null;
    sigtermHandler = null;
  };

  const handleInterrupt = async () => {
    await navManager.handleNavigation({ type: 'exit' });
    await persistenceManager.endSession();
    console.log(
      MessageFormatter.formatMuted(
        `Progress saved. Run with --resume ${session.sessionId} to continue.`
      )
    );
    process.exit(0);
  };

  sigintHandler = () => {
    void handleInterrupt();
  };
  sigtermHandler = () => {
    void handleInterrupt();
  };

  process.once('SIGINT', sigintHandler);
  process.once('SIGTERM', sigtermHandler);

  try {
    while (true) {
      const question = engine.getCurrentQuestion();

      if (!question) {
        console.log(MessageFormatter.formatWarning('No questions available.'));
        break;
      }

      const progress = engine.getProgress();
      displayProgressHeader(progress);

      const priorAnswer = session.responseBuilder
        .getResponse()
        .answers.find(a => a.questionId === question.id);

      const component = ComponentFactory.create(question);
      const answer = await component.render(question, priorAnswer?.value);

      await session.responseBuilder.recordAnswer(question.id, answer, {
        timestamp: new Date().toISOString()
      });

      const navResult = await navManager.handleNavigation({ type: 'next', answer });

      if (!navResult.success) {
        throw new Error(navResult.error || 'Navigation failed');
      }

      if (navResult.result?.type === 'complete') {
        break;
      }
    }

    const completedResponse = await session.responseBuilder.complete();
    await persistenceManager.endSession();
    console.log(formatCompletionSummary(completedResponse, dataDirectory));

    return {
      sessionId: session.sessionId,
      responseId: completedResponse.id,
      answeredCount: completedResponse.progress.answeredCount,
      skippedCount: completedResponse.progress.skippedCount ?? 0,
      completed: true
    };
  } catch (error) {
    if (error instanceof ExitPromptError) {
      await handleInterrupt();
    }

    await persistenceManager.endSession();
    throw error;
  } finally {
    cleanupSignals();
  }
}
