import path from 'path';
import process from 'node:process';
import { readFile } from 'fs/promises';
import { existsSync } from 'fs';
import { ExitPromptError } from '@inquirer/core';

import { QuestionnaireFlowEngine } from './core/flow/flow-engine.js';
import { NavigationManager } from './core/flow/navigation-manager.js';
import { PersistenceManager } from './core/persistence/persistence-manager.js';
import { createStorageBackend } from './core/storage/factory.js';
import { safeValidateQuestionnaire } from './core/schema.js';
import { formatZodError } from './core/schemas/validation.js';
import { ResponseStatus, type QuestionnaireResponse, type Questionnaire, type Question } from './core/schema.js';
import { ConditionalLogicEngine } from './core/flow/conditional-logic.js';
import type { ProgressInfo } from './core/types/flow-types.js';
import { ComponentFactory, initializeComponents, MessageFormatter, theme } from './ui/components/index.js';

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

export class QuestionnaireInterruptedError extends Error {
  constructor(sessionId: string) {
    super(`Questionnaire interrupted for session ${sessionId}`);
    this.name = 'QuestionnaireInterruptedError';
  }
}

type SignalHandler = (() => void) | null;
type CancellationToken = { cancelled: boolean };

interface StepState {
  completed: boolean;
  interrupted: boolean;
}

type StepAnswer = 'continue' | 'complete' | 'interrupt';

function buildPersistedSkipped(response: QuestionnaireResponse): Set<string> {
  const skipped = new Set<string>();

  for (const answer of response.answers) {
    if (answer.skipped) {
      skipped.add(answer.questionId);
    }
  }

  return skipped;
}

function findFirstPendingQuestion(
  questionnaire: Questionnaire,
  responses: Map<string, any>,
  alreadySkipped: Set<string> = new Set()
): { question: Question | null; skipped: Set<string> } {
  const logic = new ConditionalLogicEngine();
  const skipped = new Set<string>(alreadySkipped);

  for (const question of questionnaire.questions) {
    if (skipped.has(question.id)) {
      continue;
    }

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
  const barLength = 20;
  const filledBlocks = Math.round((progress.percentComplete / 100) * barLength);

  const filledBar = theme.success('█'.repeat(filledBlocks));
  const emptyBar = theme.muted('░'.repeat(Math.max(0, barLength - filledBlocks)));
  const bar = `${filledBar}${emptyBar}`;

  const headerText = ` Question ${theme.primary(progress.currentQuestion)} of ${theme.primary(totalLabel)}`;
  const percentText = theme.info(`${progress.percentComplete}%`);

  const separator = theme.muted('────────────────────────────────────────────');

  console.log(separator);
  console.log(`${headerText}  [${bar}]  ${percentText}`);
  console.log(separator);
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

function createCancellationToken(): CancellationToken {
  return { cancelled: false };
}

function nextStepState(currentState: StepState, answer: StepAnswer): StepState {
  switch (answer) {
    case 'complete':
      return { ...currentState, completed: true };
    case 'interrupt':
      return { ...currentState, interrupted: true };
    case 'continue':
    default:
      return currentState;
  }
}

function registerSignalCancellation(token: CancellationToken): () => void {
  let sigintHandler: SignalHandler = null;
  let sigtermHandler: SignalHandler = null;

  sigintHandler = () => {
    token.cancelled = true;
  };

  sigtermHandler = () => {
    token.cancelled = true;
  };

  process.once('SIGINT', sigintHandler);
  process.once('SIGTERM', sigtermHandler);

  return () => {
    if (sigintHandler) process.off('SIGINT', sigintHandler);
    if (sigtermHandler) process.off('SIGTERM', sigtermHandler);
    sigintHandler = null;
    sigtermHandler = null;
  };
}

async function renderQuestionAnswer(question: Question, response: QuestionnaireResponse): Promise<any> {
  const priorAnswer = response.answers.find(a => a.questionId === question.id);
  const component = ComponentFactory.create(question);
  return component.render(question, priorAnswer?.value);
}

function buildRunnerResult(sessionId: string, response: QuestionnaireResponse): RunnerResult {
  return {
    sessionId,
    responseId: response.id,
    answeredCount: response.progress.answeredCount,
    skippedCount: response.progress.skippedCount ?? 0,
    completed: true
  };
}

async function runQuestionnaireShell(args: {
  sessionId: string;
  dataDirectory: string;
  engine: QuestionnaireFlowEngine;
  navManager: NavigationManager;
  persistenceManager: PersistenceManager;
  responseBuilder: Awaited<ReturnType<PersistenceManager['startSession']>>['responseBuilder'];
}): Promise<RunnerResult> {
  const { sessionId, dataDirectory, engine, navManager, persistenceManager, responseBuilder } = args;
  const cancellationToken = createCancellationToken();
  const cleanupSignals = registerSignalCancellation(cancellationToken);
  let stepState: StepState = { completed: false, interrupted: false };
  let cleanupResult: Awaited<ReturnType<PersistenceManager['endSession']>> | null = null;
  let interruptPromise: Promise<never> | null = null;

  const endSessionOnce = async (): Promise<Awaited<ReturnType<PersistenceManager['endSession']>> > => {
    if (cleanupResult) {
      return cleanupResult;
    }

    cleanupResult = await persistenceManager.endSession();
    return cleanupResult;
  };

  const handleInterrupt = (): Promise<never> => {
    if (!interruptPromise) {
      interruptPromise = (async () => {
        await navManager.handleNavigation({ type: 'exit' });
        await endSessionOnce();
        console.log(
          MessageFormatter.formatMuted(
            `Progress saved. Run with --resume ${sessionId} to continue.`
          )
        );
        throw new QuestionnaireInterruptedError(sessionId);
      })();
    }

    return interruptPromise;
  };

  try {
    while (!stepState.completed && !stepState.interrupted) {
      if (cancellationToken.cancelled) {
        stepState = nextStepState(stepState, 'interrupt');
        continue;
      }

      const question = engine.getCurrentQuestion();

      if (!question) {
        console.log(MessageFormatter.formatWarning('No questions available.'));
        break;
      }

      const currentResponse = responseBuilder.getResponse();
      const progress = engine.getProgress(currentResponse.progress.answeredCount);
      displayProgressHeader(progress);

      let answer: any;
      try {
        answer = await renderQuestionAnswer(question, currentResponse);
      } catch (error) {
        if (error instanceof ExitPromptError) {
          cancellationToken.cancelled = true;
          stepState = nextStepState(stepState, 'interrupt');
          continue;
        }

        throw error;
      }

      if (cancellationToken.cancelled) {
        stepState = nextStepState(stepState, 'interrupt');
        continue;
      }

      const navResult = await navManager.handleNavigation({ type: 'next', answer });

      if (!navResult.success) {
        throw new Error(navResult.error || 'Navigation failed');
      }

      stepState = nextStepState(stepState, navResult.result?.type === 'complete' ? 'complete' : 'continue');
    }

    if (stepState.interrupted || cancellationToken.cancelled) {
      return await handleInterrupt();
    }

    const completedResponse = await responseBuilder.complete();
    const completedCleanup = await endSessionOnce();
    console.log(formatCompletionSummary(completedResponse, dataDirectory));
    if (completedCleanup.deletedCount > 0 && completedCleanup.errors.length === 0) {
      console.log(MessageFormatter.formatMuted(`Cleaned up ${completedCleanup.deletedCount} backup files`));
    }

    return buildRunnerResult(sessionId, completedResponse);
  } catch (error) {
    if (error instanceof ExitPromptError || cancellationToken.cancelled) {
      return await handleInterrupt();
    }

    await endSessionOnce();
    throw error;
  } finally {
    cleanupSignals();
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
  const storage = await createStorageBackend({ dataDirectory });
  if ('initialize' in storage && typeof storage.initialize === 'function') {
    await storage.initialize();
  }

  await storage.saveQuestionnaire(questionnaire);

  const persistenceManager = new PersistenceManager(storage);
  const engine = new QuestionnaireFlowEngine(storage);

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

  const navManager = new NavigationManager(engine, session.responseBuilder);

  const responseSnapshot = session.responseBuilder.getResponse();
  const responsesMap = session.responseBuilder.getAnswersMap();
  const persistedSkipped = buildPersistedSkipped(responseSnapshot);
  const pending = findFirstPendingQuestion(questionnaire, responsesMap, persistedSkipped);

  const firstQuestion = questionnaire.questions[0];
  if (!firstQuestion) {
    throw new Error('Questionnaire contains no questions');
  }

  const startQuestionId = pending.question?.id ?? firstQuestion.id;
  const skippedQuestions = new Set<string>([...pending.skipped, ...persistedSkipped]);

  if (usedResume) {
    try {
      await engine.loadState(session.sessionId);
    } catch {
      await engine.start(questionnaire.id, {
        sessionId: session.sessionId,
        initialResponses: responsesMap,
        skippedQuestions,
        currentQuestionId: startQuestionId,
        startTime: new Date(responseSnapshot.startedAt)
      });
    }
  } else {
    await engine.start(questionnaire.id, {
      sessionId: session.sessionId,
      initialResponses: responsesMap,
      skippedQuestions,
      currentQuestionId: startQuestionId,
      startTime: new Date(responseSnapshot.startedAt)
    });
  }

  if (responseSnapshot.status === ResponseStatus.COMPLETED || !pending.question) {
    const completed = responseSnapshot.status === ResponseStatus.COMPLETED
      ? responseSnapshot
      : await session.responseBuilder.complete();
    const cleanupResult = await persistenceManager.endSession();
    console.log(formatCompletionSummary(completed, dataDirectory));
    if (cleanupResult.deletedCount > 0 && cleanupResult.errors.length === 0) {
      console.log(MessageFormatter.formatMuted(`Cleaned up ${cleanupResult.deletedCount} backup files`));
    }

    return buildRunnerResult(session.sessionId, completed);
  }

  return runQuestionnaireShell({
    sessionId: session.sessionId,
    dataDirectory,
    engine,
    navManager,
    persistenceManager,
    responseBuilder: session.responseBuilder
  });
}
