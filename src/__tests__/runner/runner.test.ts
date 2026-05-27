import { describe, it, expect, beforeEach, afterEach, jest } from '@jest/globals';
import os from 'os';
import path from 'path';
import { promises as fs } from 'fs';
import { ExitPromptError } from '@inquirer/core';
import { runQuestionnaire, QuestionnaireInterruptedError } from '../../runner.js';
import { TestDataFactory } from '../helpers/test-data-factory.js';
import { ComponentFactory } from '../../ui/components/index.js';
import { PersistenceManager } from '../../core/persistence/persistence-manager.js';

const ORIGINAL_TTY = process.stdin.isTTY;

describe('runner integration', () => {
  let tempDir: string;
  let dataDir: string;
  const renderMock = jest.fn<() => Promise<any>>();
  const mockComponent = {
    render: renderMock,
    validate: jest.fn(),
    format: jest.fn(),
    getPromptConfig: jest.fn()
  };

  beforeEach(async () => {
    tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'runner-test-'));
    dataDir = path.join(tempDir, 'data');
    renderMock.mockReset();
    renderMock.mockResolvedValue('answer');
    jest.spyOn(ComponentFactory, 'create').mockReturnValue(mockComponent as any);
    Object.defineProperty(process.stdin, 'isTTY', { configurable: true, value: true });
  });

  afterEach(async () => {
    jest.restoreAllMocks();
    Object.defineProperty(process.stdin, 'isTTY', { configurable: true, value: ORIGINAL_TTY });

    try {
      await fs.rm(tempDir, { recursive: true, force: true });
    } catch {
      // ignore cleanup errors
    }
  });

  it('runs a questionnaire and saves responses', async () => {
    const questionnaire = TestDataFactory.createValidQuestionnaire();
    const questionnairePath = path.join(tempDir, 'questionnaire.json');
    await fs.writeFile(questionnairePath, JSON.stringify(questionnaire, null, 2));

    renderMock.mockResolvedValueOnce('Alice').mockResolvedValueOnce(30);

    const result = await runQuestionnaire({
      questionnairePath,
      dataDirectory: dataDir
    });

    const responsePath = path.join(dataDir, 'responses', `${result.sessionId}.json`);
    const saved = JSON.parse(await fs.readFile(responsePath, 'utf-8'));

    expect(result.completed).toBe(true);
    expect(saved.answers).toHaveLength(2);
    expect(renderMock).toHaveBeenCalledTimes(2);
  });

  it('throws when questionnaire file is missing', async () => {
    await expect(
      runQuestionnaire({
        questionnairePath: path.join(tempDir, 'missing.json'),
        dataDirectory: dataDir
      })
    ).rejects.toThrow(/not found/i);
  });

  it('throws on invalid JSON', async () => {
    const questionnairePath = path.join(tempDir, 'invalid.json');
    await fs.writeFile(questionnairePath, '{invalid}');

    await expect(
      runQuestionnaire({
        questionnairePath,
        dataDirectory: dataDir
      })
    ).rejects.toThrow(/invalid json/i);
  });

  it('throws when questionnaire validation fails', async () => {
    const questionnairePath = path.join(tempDir, 'invalid-schema.json');
    await fs.writeFile(
      questionnairePath,
      JSON.stringify({ id: 'bad', version: '1.0.0', questions: [] }, null, 2)
    );

    await expect(
      runQuestionnaire({
        questionnairePath,
        dataDirectory: dataDir
      })
    ).rejects.toThrow(/validation failed/i);
  });

  it('resumes a completed session without prompting again', async () => {
    const questionnaire = TestDataFactory.createValidQuestionnaire();
    const questionnairePath = path.join(tempDir, 'questionnaire.json');
    await fs.writeFile(questionnairePath, JSON.stringify(questionnaire, null, 2));

    renderMock.mockResolvedValueOnce('First').mockResolvedValueOnce(99);
    const firstRun = await runQuestionnaire({
      questionnairePath,
      dataDirectory: dataDir
    });

    renderMock.mockReset();
    renderMock.mockImplementation(() => Promise.reject(new Error('render should not be called on resume')));

    const resumeResult = await runQuestionnaire({
      questionnairePath,
      sessionId: firstRun.sessionId,
      dataDirectory: dataDir
    });

    expect(resumeResult.sessionId).toBe(firstRun.sessionId);
    expect(renderMock).not.toHaveBeenCalled();
  });

  it('handles concurrent signal + prompt exit with single session cleanup', async () => {
    const questionnaire = TestDataFactory.createValidQuestionnaire();
    const questionnairePath = path.join(tempDir, 'questionnaire.json');
    await fs.writeFile(questionnairePath, JSON.stringify(questionnaire, null, 2));

    const endSessionSpy = jest.spyOn(PersistenceManager.prototype, 'endSession');
    renderMock.mockImplementationOnce(async () => {
      process.emit('SIGINT');
      throw new ExitPromptError();
    });

    await expect(
      runQuestionnaire({
        questionnairePath,
        dataDirectory: dataDir
      })
    ).rejects.toBeInstanceOf(QuestionnaireInterruptedError);

    expect(endSessionSpy).toHaveBeenCalledTimes(1);
  });
});
