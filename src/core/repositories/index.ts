/**
 * Repositories Module
 *
 * Exports repository interfaces and file-based implementations.
 */

export type {
  IRepository,
  IQuestionnaireRepository,
  IResponseRepository,
  ISessionRepository,
  VersionedQuestionnaire,
  QuestionnaireCreateInput,
  QuestionnaireListOptions,
  ResponseCreateInput,
  ResponseListOptions,
  SessionCreateInput,
} from './interfaces.js';

export { ConcurrencyError, EntityNotFoundError, LockTimeoutError } from './interfaces.js';

export { FileQuestionnaireRepository } from './file-questionnaire-repository.js';
export { FileResponseRepository } from './file-response-repository.js';
export { FileUserRepository } from './file-user-repository.js';
