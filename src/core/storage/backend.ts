/**
 * Storage Backend Abstraction
 *
 * Low-level pluggable backend interface and implementations for the storage layer.
 * Backends handle raw read/write/list/delete operations on a key-value basis,
 * while higher-level stores (questionnaire-store, response-store, etc.) work on
 * top of this abstraction.
 */

import { promises as fs } from 'fs';
import path from 'path';
import crypto from 'crypto';

// ---------------------------------------------------------------------------
// Core backend interface
// ---------------------------------------------------------------------------

/**
 * Result returned by a health-check operation.
 */
export interface HealthCheckResult {
  /** Whether the backend is reachable and operational */
  healthy: boolean;
  /** Human-readable message describing the result */
  message: string;
  /** Round-trip latency in milliseconds (undefined when unhealthy) */
  latencyMs?: number;
}

/**
 * Low-level storage backend interface.
 *
 * All paths passed to a backend are treated as opaque keys; the backend is
 * responsible for translating them to its underlying storage mechanism (file
 * path, S3 object key, etc.).
 */
export interface StorageBackend {
  /**
   * Read the content of an object.
   * @param key - Object key / path
   * @returns UTF-8 string content
   * @throws {StorageBackendError} if the object does not exist or cannot be read
   */
  read(key: string): Promise<string>;

  /**
   * Write (create or overwrite) an object.
   * @param key - Object key / path
   * @param data - UTF-8 string content
   */
  write(key: string, data: string): Promise<void>;

  /**
   * Delete an object.  Implementations should not throw if the object does
   * not exist.
   * @param key - Object key / path
   */
  delete(key: string): Promise<void>;

  /**
   * Check whether an object exists.
   * @param key - Object key / path
   */
  exists(key: string): Promise<boolean>;

  /**
   * List object keys that share a common prefix.
   * @param prefix - Key prefix to filter by
   * @returns Array of full keys matching the prefix
   */
  list(prefix: string): Promise<string[]>;

  /**
   * Verify that the backend is reachable and operational.
   */
  healthCheck(): Promise<HealthCheckResult>;
}

// ---------------------------------------------------------------------------
// Error type
// ---------------------------------------------------------------------------

/**
 * Error thrown by storage backend implementations.
 */
export class StorageBackendError extends Error {
  constructor(
    message: string,
    public readonly operation: string,
    public readonly key: string,
    public readonly cause?: Error
  ) {
    super(message);
    this.name = 'StorageBackendError';
  }
}

// ---------------------------------------------------------------------------
// Local filesystem backend
// ---------------------------------------------------------------------------

/**
 * StorageBackend implementation backed by the local filesystem.
 *
 * All keys are resolved relative to a configurable base directory.
 * Writes are performed atomically via a temporary file + rename.
 */
export class LocalStorageBackend implements StorageBackend {
  constructor(private readonly baseDirectory: string) {}

  private resolvePath(key: string): string {
    // Prevent directory traversal by ensuring the resolved path stays within the base directory.
    const base = path.resolve(this.baseDirectory);
    const resolved = path.resolve(base, key);
    const relative = path.relative(base, resolved);

    if (relative.startsWith('..') || path.isAbsolute(relative)) {
      throw new StorageBackendError(
        `Path traversal attempt detected for key: ${key}`,
        'resolvePath',
        key
      );
    }
    return resolved;
  }

  async read(key: string): Promise<string> {
    const filePath = this.resolvePath(key);
    try {
      return await fs.readFile(filePath, 'utf8');
    } catch (error) {
      throw new StorageBackendError(
        `Failed to read "${key}": ${error instanceof Error ? error.message : String(error)}`,
        'read',
        key,
        error instanceof Error ? error : undefined
      );
    }
  }

  async write(key: string, data: string): Promise<void> {
    const filePath = this.resolvePath(key);
    const dir = path.dirname(filePath);
    const tmpFile = path.join(dir, `.${path.basename(filePath)}.tmp.${crypto.randomBytes(16).toString('hex')}`);

    try {
      await fs.mkdir(dir, { recursive: true });
      await fs.writeFile(tmpFile, data, 'utf8');
      await fs.rename(tmpFile, filePath);
    } catch (error) {
      // Best-effort temp file cleanup
      try { await fs.unlink(tmpFile); } catch { /* ignore */ }
      throw new StorageBackendError(
        `Failed to write "${key}": ${error instanceof Error ? error.message : String(error)}`,
        'write',
        key,
        error instanceof Error ? error : undefined
      );
    }
  }

  async delete(key: string): Promise<void> {
    const filePath = this.resolvePath(key);
    try {
      await fs.unlink(filePath);
    } catch (error: unknown) {
      const nodeError = error as NodeJS.ErrnoException;
      if (nodeError.code === 'ENOENT') {
        return; // Already gone – not an error
      }
      throw new StorageBackendError(
        `Failed to delete "${key}": ${nodeError.message}`,
        'delete',
        key,
        nodeError instanceof Error ? nodeError : undefined
      );
    }
  }

  async exists(key: string): Promise<boolean> {
    const filePath = this.resolvePath(key);
    try {
      await fs.access(filePath);
      return true;
    } catch {
      return false;
    }
  }

  async list(prefix: string): Promise<string[]> {
    const results: string[] = [];
    const stack: string[] = [this.baseDirectory];

    try {
      while (stack.length > 0) {
        const currentDir = stack.pop() as string;
        const entries = await fs.readdir(currentDir, { withFileTypes: true });

        for (const entry of entries) {
          const fullPath = path.join(currentDir, entry.name);
          if (entry.isDirectory()) {
            stack.push(fullPath);
          } else if (entry.isFile()) {
            const relative = path.relative(this.baseDirectory, fullPath);
            const normalizedKey = relative.split(path.sep).join('/');
            if (normalizedKey.startsWith(prefix)) {
              results.push(normalizedKey);
            }
          }
        }
      }

      return results;
    } catch (error: unknown) {
      const nodeError = error as NodeJS.ErrnoException;
      if (nodeError.code === 'ENOENT') {
        return [];
      }
      throw new StorageBackendError(
        `Failed to list "${prefix}": ${nodeError.message}`,
        'list',
        prefix,
        nodeError instanceof Error ? nodeError : undefined
      );
    }
  }

  async healthCheck(): Promise<HealthCheckResult> {
    const start = Date.now();
    const probeKey = `.health-probe-${crypto.randomBytes(4).toString('hex')}`;
    try {
      await this.write(probeKey, 'ok');
      await this.read(probeKey);
      await this.delete(probeKey);
      return {
        healthy: true,
        message: `Local filesystem backend is healthy (base: ${this.baseDirectory})`,
        latencyMs: Date.now() - start
      };
    } catch (error) {
      return {
        healthy: false,
        message: `Local filesystem backend health check failed: ${error instanceof Error ? error.message : String(error)}`
      };
    }
  }
}

// ---------------------------------------------------------------------------
// S3 backend
// ---------------------------------------------------------------------------

/**
 * Minimal interface for the S3 client operations used by S3StorageBackend.
 * Using this instead of `any` preserves type safety while allowing lazy
 * dynamic import of the AWS SDK.
 */
interface S3ClientLike {
  send(command: unknown): Promise<unknown>;
}

/**
 * Bundle of the S3Client instance and all command constructors used by
 * S3StorageBackend.  Loaded once via a single dynamic import so that:
 *  - The package is never required when the local backend is used.
 *  - If the package is missing, the error is always caught and converted to a
 *    StorageBackendError in one centralised place.
 */
interface S3SDKBundle {
  client: S3ClientLike;
  GetObjectCommand: new (input: { Bucket: string; Key: string }) => unknown;
  PutObjectCommand: new (input: {
    Bucket: string;
    Key: string;
    Body: string;
    ContentType: string;
  }) => unknown;
  DeleteObjectCommand: new (input: { Bucket: string; Key: string }) => unknown;
  HeadObjectCommand: new (input: { Bucket: string; Key: string }) => unknown;
  HeadBucketCommand: new (input: { Bucket: string }) => unknown;
  ListObjectsV2Command: new (input: {
    Bucket: string;
    Prefix?: string;
    ContinuationToken?: string;
  }) => unknown;
}

/**
 * Configuration for the S3-compatible storage backend.
 */
export interface S3BackendConfig {
  /** S3 bucket name */
  bucket: string;
  /** Optional key prefix to namespace all objects */
  keyPrefix?: string;
  /** AWS region (defaults to 'us-east-1') */
  region?: string;
  /** Custom endpoint URL for S3-compatible services (MinIO, LocalStack, etc.) */
  endpoint?: string;
  /** AWS access key ID (falls back to environment / instance profile) */
  accessKeyId?: string;
  /** AWS secret access key (falls back to environment / instance profile) */
  secretAccessKey?: string;
  /** Force path-style URLs (required for MinIO / LocalStack) */
  forcePathStyle?: boolean;
}

/**
 * StorageBackend implementation backed by an S3-compatible object store.
 *
 * Compatible with AWS S3, MinIO, LocalStack, and any service that exposes
 * the S3 REST API.  The AWS SDK client is instantiated lazily on first use
 * so that applications that only use the local backend pay no import cost.
 */
export class S3StorageBackend implements StorageBackend {
  private readonly bucket: string;
  private readonly keyPrefix: string;
  private readonly config: S3BackendConfig;
  private sdk: S3SDKBundle | null = null;

  constructor(config: S3BackendConfig) {
    this.config = config;
    this.bucket = config.bucket;
    this.keyPrefix = config.keyPrefix ?? '';
  }

  private fullKey(key: string): string {
    return this.keyPrefix ? `${this.keyPrefix}/${key}` : key;
  }

  private stripPrefix(fullKey: string): string {
    if (this.keyPrefix && fullKey.startsWith(`${this.keyPrefix}/`)) {
      return fullKey.slice(this.keyPrefix.length + 1);
    }
    return fullKey;
  }

  /**
   * Lazily load the AWS SDK and create the S3Client.
   *
   * All SDK access goes through this single method so that:
   *  - The package is only loaded when the S3 backend is actually used.
   *  - Any "module not found" error is consistently converted to a
   *    StorageBackendError rather than leaking a raw module-resolution error.
   */
  private async getSDK(): Promise<S3SDKBundle> {
    if (this.sdk) {
      return this.sdk;
    }

    const {
      S3Client,
      GetObjectCommand,
      PutObjectCommand,
      DeleteObjectCommand,
      HeadObjectCommand,
      HeadBucketCommand,
      ListObjectsV2Command
    } = await import('@aws-sdk/client-s3').catch(() => {
      throw new StorageBackendError(
        'The @aws-sdk/client-s3 package is required for S3 storage. Install it with: npm install @aws-sdk/client-s3',
        'getSDK',
        ''
      );
    });

    const clientConfig: Record<string, unknown> = {
      region: this.config.region ?? 'us-east-1',
      forcePathStyle: this.config.forcePathStyle ?? false
    };

    if (this.config.endpoint) {
      clientConfig['endpoint'] = this.config.endpoint;
    }

    if (this.config.accessKeyId && this.config.secretAccessKey) {
      clientConfig['credentials'] = {
        accessKeyId: this.config.accessKeyId,
        secretAccessKey: this.config.secretAccessKey
      };
    }

    this.sdk = {
      client: new S3Client(clientConfig) as S3ClientLike,
      GetObjectCommand: GetObjectCommand as S3SDKBundle['GetObjectCommand'],
      PutObjectCommand: PutObjectCommand as S3SDKBundle['PutObjectCommand'],
      DeleteObjectCommand: DeleteObjectCommand as S3SDKBundle['DeleteObjectCommand'],
      HeadObjectCommand: HeadObjectCommand as S3SDKBundle['HeadObjectCommand'],
      HeadBucketCommand: HeadBucketCommand as S3SDKBundle['HeadBucketCommand'],
      ListObjectsV2Command: ListObjectsV2Command as S3SDKBundle['ListObjectsV2Command']
    };

    return this.sdk;
  }

  async read(key: string): Promise<string> {
    const { client, GetObjectCommand } = await this.getSDK();

    try {
      const result = await client.send(new GetObjectCommand({
        Bucket: this.bucket,
        Key: this.fullKey(key)
      })) as { Body?: { transformToString(): Promise<string> } };

      if (!result.Body) {
        throw new Error('Empty response body');
      }

      return await result.Body.transformToString();
    } catch (error) {
      throw new StorageBackendError(
        `S3 read failed for "${key}": ${error instanceof Error ? error.message : String(error)}`,
        'read',
        key,
        error instanceof Error ? error : undefined
      );
    }
  }

  async write(key: string, data: string): Promise<void> {
    const { client, PutObjectCommand } = await this.getSDK();

    try {
      await client.send(new PutObjectCommand({
        Bucket: this.bucket,
        Key: this.fullKey(key),
        Body: data,
        ContentType: 'text/plain; charset=utf-8'
      }));
    } catch (error) {
      throw new StorageBackendError(
        `S3 write failed for "${key}": ${error instanceof Error ? error.message : String(error)}`,
        'write',
        key,
        error instanceof Error ? error : undefined
      );
    }
  }

  async delete(key: string): Promise<void> {
    const { client, DeleteObjectCommand } = await this.getSDK();

    try {
      await client.send(new DeleteObjectCommand({
        Bucket: this.bucket,
        Key: this.fullKey(key)
      }));
    } catch (error) {
      throw new StorageBackendError(
        `S3 delete failed for "${key}": ${error instanceof Error ? error.message : String(error)}`,
        'delete',
        key,
        error instanceof Error ? error : undefined
      );
    }
  }

  async exists(key: string): Promise<boolean> {
    const { client, HeadObjectCommand } = await this.getSDK();

    try {
      await client.send(new HeadObjectCommand({
        Bucket: this.bucket,
        Key: this.fullKey(key)
      }));
      return true;
    } catch (error: unknown) {
      const awsError = error as { name?: string; $metadata?: { httpStatusCode?: number } };
      if (
        awsError.name === 'NotFound' ||
        awsError.name === 'NoSuchKey' ||
        awsError.$metadata?.httpStatusCode === 404
      ) {
        return false;
      }
      throw new StorageBackendError(
        `S3 exists check failed for "${key}": ${error instanceof Error ? error.message : String(error)}`,
        'exists',
        key,
        error instanceof Error ? error : undefined
      );
    }
  }

  async list(prefix: string): Promise<string[]> {
    const { client, ListObjectsV2Command } = await this.getSDK();

    const fullPrefix = this.fullKey(prefix);
    const keys: string[] = [];
    let continuationToken: string | undefined;

    try {
      do {
        // Omit ContinuationToken entirely when undefined to satisfy
        // exactOptionalPropertyTypes (AWS SDK types require string, not string|undefined).
        const result = await client.send(new ListObjectsV2Command({
          Bucket: this.bucket,
          Prefix: fullPrefix,
          ...(continuationToken !== undefined ? { ContinuationToken: continuationToken } : {})
        })) as {
          Contents?: Array<{ Key?: string }>;
          IsTruncated?: boolean;
          NextContinuationToken?: string;
        };

        for (const obj of result.Contents ?? []) {
          if (obj.Key) {
            keys.push(this.stripPrefix(obj.Key));
          }
        }

        continuationToken = result.IsTruncated ? result.NextContinuationToken : undefined;
      } while (continuationToken);

      return keys;
    } catch (error) {
      throw new StorageBackendError(
        `S3 list failed for "${prefix}": ${error instanceof Error ? error.message : String(error)}`,
        'list',
        prefix,
        error instanceof Error ? error : undefined
      );
    }
  }

  async healthCheck(): Promise<HealthCheckResult> {
    const start = Date.now();

    try {
      const { client, HeadBucketCommand } = await this.getSDK();
      await client.send(new HeadBucketCommand({ Bucket: this.bucket }));
      return {
        healthy: true,
        message: `S3 backend is healthy (bucket: ${this.bucket})`,
        latencyMs: Date.now() - start
      };
    } catch (error) {
      return {
        healthy: false,
        message: `S3 backend health check failed: ${error instanceof Error ? error.message : String(error)}`
      };
    }
  }
}

// ---------------------------------------------------------------------------
// Retry decorator
// ---------------------------------------------------------------------------

/**
 * Configuration for the retry decorator.
 */
export interface RetryConfig {
  /** Maximum number of attempts (including the first) */
  maxAttempts: number;
  /** Base delay in milliseconds for exponential backoff */
  baseDelayMs: number;
  /** Maximum delay in milliseconds */
  maxDelayMs: number;
  /** Optional jitter factor (0–1) added to each delay */
  jitter?: number;
}

const DEFAULT_RETRY_CONFIG: RetryConfig = {
  maxAttempts: 3,
  baseDelayMs: 100,
  maxDelayMs: 5000,
  jitter: 0.2
};

/**
 * Calculates the delay for a given attempt using exponential backoff with
 * optional jitter.
 */
function calculateDelay(attempt: number, config: RetryConfig): number {
  const base = Math.min(config.baseDelayMs * Math.pow(2, attempt), config.maxDelayMs);
  const jitter = config.jitter ? base * config.jitter * Math.random() : 0;
  return Math.floor(base + jitter);
}

/**
 * StorageBackend decorator that adds automatic retry with exponential backoff.
 *
 * The decorator wraps every backend operation; on failure it will retry up to
 * `maxAttempts - 1` additional times before propagating the error.
 */
export class RetryableStorageBackend implements StorageBackend {
  private readonly retryConfig: RetryConfig;

  constructor(
    private readonly inner: StorageBackend,
    retryConfig: Partial<RetryConfig> = {}
  ) {
    this.retryConfig = { ...DEFAULT_RETRY_CONFIG, ...retryConfig };
  }

  private async withRetry<T>(operation: () => Promise<T>): Promise<T> {
    let lastError: Error | undefined;

    for (let attempt = 0; attempt < this.retryConfig.maxAttempts; attempt++) {
      try {
        return await operation();
      } catch (error) {
        lastError = error instanceof Error ? error : new Error(String(error));

        if (attempt < this.retryConfig.maxAttempts - 1) {
          const delay = calculateDelay(attempt, this.retryConfig);
          await new Promise(resolve => setTimeout(resolve, delay));
        }
      }
    }

    throw lastError ?? new Error('All retry attempts failed');
  }

  read(key: string): Promise<string> {
    return this.withRetry(() => this.inner.read(key));
  }

  write(key: string, data: string): Promise<void> {
    return this.withRetry(() => this.inner.write(key, data));
  }

  delete(key: string): Promise<void> {
    return this.withRetry(() => this.inner.delete(key));
  }

  exists(key: string): Promise<boolean> {
    return this.withRetry(() => this.inner.exists(key));
  }

  list(prefix: string): Promise<string[]> {
    return this.withRetry(() => this.inner.list(prefix));
  }

  healthCheck(): Promise<HealthCheckResult> {
    // Health checks are not retried to avoid masking transient issues
    return this.inner.healthCheck();
  }
}

// ---------------------------------------------------------------------------
// Backend factory
// ---------------------------------------------------------------------------

/**
 * Backend type discriminator used in configuration.
 */
export type BackendType = 'local' | 's3';

/**
 * Configuration for the storage backend factory.
 */
export interface BackendConfig {
  /** Which backend to use */
  type: BackendType;
  /** Local backend options (required when type === 'local') */
  local?: {
    baseDirectory: string;
  };
  /** S3 backend options (required when type === 's3') */
  s3?: S3BackendConfig;
  /** Retry configuration (applies to all backends) */
  retry?: Partial<RetryConfig>;
}

/**
 * Create and return a (possibly retry-wrapped) StorageBackend based on the
 * provided configuration.
 *
 * @param config - Backend configuration
 * @returns Configured storage backend
 */
export function createStorageBackend(config: BackendConfig): StorageBackend {
  let backend: StorageBackend;

  switch (config.type) {
    case 'local': {
      if (!config.local?.baseDirectory) {
        throw new Error('local.baseDirectory is required for the local storage backend');
      }
      backend = new LocalStorageBackend(config.local.baseDirectory);
      break;
    }
    case 's3': {
      if (!config.s3?.bucket) {
        throw new Error('s3.bucket is required for the S3 storage backend');
      }
      backend = new S3StorageBackend(config.s3);
      break;
    }
    default: {
      const exhaustive: never = config.type;
      throw new Error(`Unknown storage backend type: ${String(exhaustive)}`);
    }
  }

  // Treat the presence of a retry config as opting into retry behavior.
  // When maxAttempts is omitted, use RetryableStorageBackend's defaults.
  if (config.retry) {
    const { maxAttempts } = config.retry;

    // Preserve existing behavior when maxAttempts is explicitly provided:
    // only enable retries when maxAttempts > 1.
    if (maxAttempts === undefined || maxAttempts > 1) {
      return new RetryableStorageBackend(backend, config.retry);
    }
  }

  return backend;
}
