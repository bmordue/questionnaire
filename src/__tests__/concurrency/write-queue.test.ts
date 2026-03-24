/**
 * WriteQueue Tests
 */

import { describe, it, expect } from '@jest/globals';
import { WriteQueue } from '../../core/concurrency/write-queue.js';

describe('WriteQueue', () => {
  it('serializes operations for the same key', async () => {
    const queue = new WriteQueue();
    const order: number[] = [];

    await Promise.all([
      queue.enqueue('k', async () => {
        await new Promise(r => setTimeout(r, 20));
        order.push(1);
      }),
      queue.enqueue('k', async () => {
        order.push(2);
      }),
      queue.enqueue('k', async () => {
        order.push(3);
      }),
    ]);

    expect(order).toEqual([1, 2, 3]);
  });

  it('runs operations for different keys concurrently', async () => {
    const queue = new WriteQueue();
    const started: string[] = [];

    let resolveFn!: () => void;
    const blocker = new Promise<void>(r => (resolveFn = r));

    const p1 = queue.enqueue('a', async () => {
      started.push('a');
      await blocker;
    });

    const p2 = queue.enqueue('b', async () => {
      started.push('b');
    });

    // Give the event loop a tick to start both
    await new Promise(r => setImmediate(r));

    // 'b' should have started even though 'a' is still running
    expect(started).toContain('b');

    resolveFn();
    await Promise.all([p1, p2]);
  });

  it('propagates errors without breaking the queue', async () => {
    const queue = new WriteQueue();
    let secondRan = false;

    await expect(
      queue.enqueue('x', async () => {
        throw new Error('boom');
      }),
    ).rejects.toThrow('boom');

    await queue.enqueue('x', async () => {
      secondRan = true;
    });

    expect(secondRan).toBe(true);
  });
});
