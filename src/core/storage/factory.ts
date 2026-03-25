import type { StorageService, StorageConfig } from '../storage/types.js';
import { createStorageService } from '../storage.js';

/**
 * Create a storage backend based on environment variables.
 *
 * - If `STORAGE_MODULE_PATH` is set the module will be dynamically imported and
 *   a `createStorageService` factory or default export will be used when present.
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

  // Default: file-based storage helper will return an initialized service
  return await createStorageService(config);
}

export default createStorageBackend;
