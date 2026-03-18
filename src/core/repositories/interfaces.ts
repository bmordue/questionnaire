/**
 * Repository Interfaces
 * 
 * Core interfaces for data access layer with concurrency support
 */

import type { Questionnaire } from '../schemas/questionnaire.js';
import type { QuestionnaireResponse } from '../schemas/response.js';
import type { SessionData } from '../storage/types.js';

/**
 * Base repository interface with common CRUD operations
 */
export interface IRepository<T, TCreate = Partial<T>> {
  /**
   * Create a new entity
   * @param data - Creation data
   * @returns Created entity
   */
  create(data: TCreate): Promise<T>;

  /**
   * Find an entity by ID
   * @param id - Entity ID
   * @returns Entity or null if not found
   */
  findById(id: string): Promise<T | null>;

  /**
   * Find all entities
   * @returns Array of entities
   */
  findAll(): Promise<T[]>;

  /**
   * Update an existing entity
   * @param id - Entity ID
   * @param data - Update data
   * @returns Updated entity
   * @throws EntityNotFoundError if entity doesn't exist
   */
  update(id: string, data: Partial<T>): Promise<T>;

  /**
   * Delete an entity
   * @param id - Entity ID
   */
  delete(id: string): Promise<void>;

  /**
   * Check if an entity exists
   * @param id - Entity ID
   * @returns True if exists
   */
  exists(id: string): Promise<boolean>;
}

/**
 * User entity for authentication and authorization
 */
export interface User {
  id: string;
  email: string;
  passwordHash: string;
  role: UserRole;
  createdAt: string;
  updatedAt: string;
  lastLoginAt?: string;
}

/**
 * User roles for authorization
 */
export type UserRole = 'admin' | 'creator' | 'respondent';

/**
 * User repository interface
 */
export interface IUserRepository extends IRepository<User, UserCreateInput> {
  /**
   * Find user by email
   * @param email - User email
   * @returns User or null
   */
  findByEmail(email: string): Promise<User | null>;

  /**
   * Update user's last login timestamp
   * @param userId - User ID
   * @returns Updated user
   */
  updateLastLogin(userId: string): Promise<User>;
}

/**
 * User creation input
 */
export interface UserCreateInput {
  email: string;
  passwordHash: string;
  role?: UserRole;
}

/**
 * Questionnaire with version tracking for concurrency
 */
export interface VersionedQuestionnaire extends Questionnaire {
  version: string;
  publishedAt?: string;
  publishedBy?: string;
}

/**
 * Questionnaire repository interface
 */
export interface IQuestionnaireRepository extends IRepository<VersionedQuestionnaire, QuestionnaireCreateInput> {
  /**
   * Find questionnaire by ID (alias for findById)
   * @param id - Questionnaire ID
   * @returns Questionnaire or null
   */
  getById(id: string): Promise<VersionedQuestionnaire | null>;

  /**
   * List questionnaires with optional filtering
   * @param options - Filter options
   * @returns Array of questionnaires
   */
  list(options?: QuestionnaireListOptions): Promise<VersionedQuestionnaire[]>;

  /**
   * Publish a questionnaire (makes it available for answering)
   * @param id - Questionnaire ID
   * @param userId - User publishing the questionnaire
   * @returns Published questionnaire
   */
  publish(id: string, userId: string): Promise<VersionedQuestionnaire>;

  /**
   * Unpublish a questionnaire
   * @param id - Questionnaire ID
   * @returns Unpublished questionnaire
   */
  unpublish(id: string): Promise<VersionedQuestionnaire>;

  /**
   * Check if questionnaire is published
   * @param id - Questionnaire ID
   * @returns True if published
   */
  isPublished(id: string): Promise<boolean>;
}

/**
 * Questionnaire creation input
 */
export interface QuestionnaireCreateInput {
  id: string;
  version: string;
  title: string;
  description?: string;
  author?: string;
  questions: Questionnaire['questions'];
  config?: Questionnaire['config'];
  tags?: string[];
  createdBy: string;
}

/**
 * Questionnaire list options
 */
export interface QuestionnaireListOptions {
  publishedOnly?: boolean;
  createdBy?: string;
  tags?: string[];
  limit?: number;
  offset?: number;
}

/**
 * Response repository interface
 */
export interface IResponseRepository extends IRepository<QuestionnaireResponse, ResponseCreateInput> {
  /**
   * Find response by session ID
   * @param sessionId - Session ID
   * @returns Response or null
   */
  findBySessionId(sessionId: string): Promise<QuestionnaireResponse | null>;

  /**
   * List responses for a questionnaire
   * @param questionnaireId - Questionnaire ID
   * @param options - Filter options
   * @returns Array of responses
   */
  listByQuestionnaire(questionnaireId: string, options?: ResponseListOptions): Promise<QuestionnaireResponse[]>;

  /**
   * List responses by user
   * @param userId - User ID
   * @param options - Filter options
   * @returns Array of responses
   */
  listByUser(userId: string, options?: ResponseListOptions): Promise<QuestionnaireResponse[]>;

  /**
   * Update response with optimistic locking
   * @param id - Response ID
   * @param data - Update data
   * @param expectedVersion - Expected version for optimistic locking
   * @returns Updated response
   * @throws ConcurrencyError if version mismatch
   */
  updateWithLock(id: string, data: Partial<QuestionnaireResponse>, expectedVersion?: string): Promise<QuestionnaireResponse>;
}

/**
 * Response creation input
 */
export interface ResponseCreateInput {
  questionnaireId: string;
  questionnaireVersion: string;
  sessionId: string;
  userId?: string;
  totalQuestions: number;
}

/**
 * Response list options
 */
export interface ResponseListOptions {
  status?: 'in_progress' | 'completed' | 'abandoned';
  userId?: string;
  completedAfter?: string;
  completedBefore?: string;
  limit?: number;
  offset?: number;
}

/**
 * Session repository interface
 */
export interface ISessionRepository extends IRepository<SessionData, SessionCreateInput> {
  /**
   * Find active session by questionnaire ID
   * @param questionnaireId - Questionnaire ID
   * @param userId - Optional user ID filter
   * @returns Session or null
   */
  findActiveByQuestionnaire(questionnaireId: string, userId?: string): Promise<SessionData | null>;

  /**
   * List active sessions
   * @param userId - Optional user ID filter
   * @returns Array of active sessions
   */
  listActive(userId?: string): Promise<SessionData[]>;

  /**
   * Mark session as completed
   * @param sessionId - Session ID
   * @returns Updated session
   */
  complete(sessionId: string): Promise<SessionData>;

  /**
   * Mark session as abandoned
   * @param sessionId - Session ID
   * @returns Updated session
   */
  abandon(sessionId: string): Promise<SessionData>;

  /**
   * Cleanup old sessions
   * @param maxAgeMs - Maximum age in milliseconds
   * @returns Number of sessions deleted
   */
  cleanup(maxAgeMs?: number): Promise<number>;
}

/**
 * Session creation input
 */
export interface SessionCreateInput {
  questionnaireId: string;
  responseId: string;
  userId?: string;
  userAgent?: string;
  ipAddress?: string;
}

/**
 * Concurrency error for optimistic locking failures
 */
export class ConcurrencyError extends Error {
  constructor(
    message: string,
    public readonly entityId: string,
    public readonly expectedVersion?: string,
    public readonly actualVersion?: string
  ) {
    super(message);
    this.name = 'ConcurrencyError';
  }
}

/**
 * Entity not found error
 */
export class EntityNotFoundError extends Error {
  constructor(
    message: string,
    public readonly entityType: string,
    public readonly entityId: string
  ) {
    super(message);
    this.name = 'EntityNotFoundError';
  }
}

/**
 * Lock timeout error
 */
export class LockTimeoutError extends Error {
  constructor(
    message: string,
    public readonly resourceId: string,
    public readonly timeoutMs: number
  ) {
    super(message);
    this.name = 'LockTimeoutError';
  }
}
