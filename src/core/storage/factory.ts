import type { StorageService, StorageConfig } from '../storage/types.js';
import { createStorageService } from './file-storage-service.js';
import { BackendStorageService } from './backend-storage-service.js';
import { S3StorageBackend, RetryableStorageBackend } from './backend.js';
import type { S3BackendConfig } from './backend.js';

/**
 * Create a storage service based on environment variables.
 *
 * - If `STORAGE_MODULE_PATH` is set the module will be dynamically imported.
 * - If `S3_BUCKET` is set, an S3-backed storage service is returned.
 * - Otherwise the built-in file-based storage is returned (via `createStorageService`).
 */
export async function createStorageBackend(
  config?: Partial<StorageConfig>
): Promise<StorageService> {
  const modulePath = process.env.STORAGE_MODULE_PATH;

  if (modulePath) {
    const mod = await import(modulePath);

    if (typeof mod.createStorageService === 'function') {
      return await mod.createStorageService(config);
    }

    if (typeof mod.default === 'function') {
      // Default export might be a factory or a class. Try factory first.
      try {
        const res = mod.default(config);
        if (res instanceof Promise) return await res;
        return res as StorageService;
      } catch (_) {
        // If calling as a function failed, assume it's a class constructor.
        return new (mod.default as any)(config) as StorageService;
      }
    }

    throw new Error(`Invalid storage module at ${modulePath}: no usable export found`);
  }

  const s3Bucket = process.env.S3_BUCKET;
  if (s3Bucket) {
    const s3Config: S3BackendConfig = {
      bucket: s3Bucket,
      keyPrefix: process.env.S3_KEY_PREFIX ?? '',
      region: process.env.S3_REGION ?? process.env.AWS_REGION ?? 'us-east-1',
      forcePathStyle: process.env.S3_FORCE_PATH_STYLE === 'true'
    };
    if (process.env.S3_ENDPOINT) s3Config.endpoint = process.env.S3_ENDPOINT;
    if (process.env.AWS_ACCESS_KEY_ID) s3Config.accessKeyId = process.env.AWS_ACCESS_KEY_ID;
    if (process.env.AWS_SECRET_ACCESS_KEY) s3Config.secretAccessKey = process.env.AWS_SECRET_ACCESS_KEY;

    const backend = new S3StorageBackend(s3Config);

    const retryable = new RetryableStorageBackend(backend, {
      maxAttempts: 3,
      baseDelayMs: 200,
      maxDelayMs: 3000
    });

    return new BackendStorageService({ backend: retryable });
  }

  // Default: file-based storage helper will return an initialized service
  return await createStorageService(config);
}

export default createStorageBackend;
