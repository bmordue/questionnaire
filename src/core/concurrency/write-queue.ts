/**
 * Write Queue
 *
 * Serializes concurrent writes to the same resource using a per-key queue.
 * Prevents data corruption when multiple requests attempt concurrent writes.
 */

type WriteTask<T> = {
  fn: () => Promise<T>;
  resolve: (value: T) => void;
  reject: (reason: unknown) => void;
};

/**
 * A write queue that serializes async operations per resource key.
 *
 * Usage:
 *   const queue = new WriteQueue();
 *   const result = await queue.enqueue('resource-key', () => writeToFile(...));
 */
export class WriteQueue {
  private readonly queues = new Map<string, Array<WriteTask<unknown>>>();
  private readonly running = new Set<string>();

  /**
   * Enqueue a write operation for the given resource key.
   * Operations for the same key are serialized; different keys run concurrently.
   */
  enqueue<T>(key: string, fn: () => Promise<T>): Promise<T> {
    return new Promise<T>((resolve, reject) => {
      const task: WriteTask<unknown> = {
        fn: fn as () => Promise<unknown>,
        resolve: resolve as (value: unknown) => void,
        reject,
      };

      if (!this.queues.has(key)) {
        this.queues.set(key, []);
      }
      this.queues.get(key)!.push(task);

      // Start processing if not already running for this key
      if (!this.running.has(key)) {
        void this.processQueue(key);
      }
    });
  }

  private async processQueue(key: string): Promise<void> {
    if (this.running.has(key)) return;
    this.running.add(key);

    const queue = this.queues.get(key)!;

    while (queue.length > 0) {
      const task = queue.shift()!;
      try {
        const result = await task.fn();
        task.resolve(result);
      } catch (err) {
        task.reject(err);
      }
    }

    // Mark this key as no longer running
    this.running.delete(key);

    // Check if new tasks were enqueued after the loop finished but before we
    // cleared the running flag. If so, restart processing immediately.
    const currentQueue = this.queues.get(key);
    if (currentQueue && currentQueue.length > 0) {
      void this.processQueue(key);
      return;
    }

    // Clean up empty queues
    if (currentQueue && currentQueue.length === 0) {
      this.queues.delete(key);
    }
  }

  /**
   * Returns the number of operations waiting or running for the given key.
   * Includes both queued (waiting) tasks and the currently executing task.
   */
  queueLength(key: string): number {
    const waiting = this.queues.get(key)?.length ?? 0;
    const running = this.running.has(key) ? 1 : 0;
    return waiting + running;
  }

  /**
   * Returns the total number of keys with pending operations.
   */
  activeKeys(): number {
    return this.queues.size;
  }
}

/** Shared global write queue instance for file operations */
export const globalWriteQueue = new WriteQueue();
