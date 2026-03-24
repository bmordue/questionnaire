/**
 * Storage Module
 * 
 * Export all storage-related types and services
 */

export {
  FileStorageService,
  createStorageService
} from '../storage.js';

export {
  LocalStorageBackend,
  S3StorageBackend,
  RetryableStorageBackend,
  StorageBackendError,
  createStorageBackend
} from './backend.js';

export type {
  StorageBackend,
  HealthCheckResult,
  S3BackendConfig,
  RetryConfig,
  BackendType,
  BackendConfig
} from './backend.js';

export {
  FileOperations,
  FileOperationError
} from './file-operations.js';

export {
  QuestionnaireStore
} from './questionnaire-store.js';

export {
  ResponseStore
} from './response-store.js';

export {
  SessionStore
} from './session-store.js';

export type {
  StorageService,
  StorageConfig,
  SessionData,
  QuestionnaireMetadataListing
} from './types.js';
