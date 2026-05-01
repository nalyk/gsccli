import { describe, expect, it } from 'vitest';
import { parallelMap, parallelMapSettled } from '../../src/utils/concurrency.js';

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

describe('parallelMap', () => {
  it('processes every item exactly once', async () => {
    const items = [1, 2, 3, 4, 5];
    const out = await parallelMap(items, async (n) => n * 2, { concurrency: 2 });
    expect(out).toEqual([2, 4, 6, 8, 10]);
  });

  it('respects the concurrency cap', async () => {
    let inflight = 0;
    let maxInflight = 0;
    const items = [1, 2, 3, 4, 5, 6, 7, 8];
    await parallelMap(
      items,
      async () => {
        inflight += 1;
        maxInflight = Math.max(maxInflight, inflight);
        await sleep(20);
        inflight -= 1;
      },
      { concurrency: 3 },
    );
    expect(maxInflight).toBeLessThanOrEqual(3);
    expect(maxInflight).toBeGreaterThanOrEqual(2); // sanity: parallelism actually happened
  });

  it('preserves output order regardless of completion order', async () => {
    const out = await parallelMap(
      [1, 2, 3, 4],
      async (n) => {
        // Reverse-order delay: later items finish sooner.
        await sleep((4 - n) * 10);
        return n;
      },
      { concurrency: 4 },
    );
    expect(out).toEqual([1, 2, 3, 4]);
  });

  it('reports progress', async () => {
    const calls: Array<[number, number]> = [];
    await parallelMap([1, 2, 3], async (n) => n, {
      concurrency: 1,
      onProgress: (done, total) => calls.push([done, total]),
    });
    expect(calls).toEqual([
      [1, 3],
      [2, 3],
      [3, 3],
    ]);
  });

  it('handles empty input', async () => {
    expect(await parallelMap([], async (n) => n, { concurrency: 2 })).toEqual([]);
  });

  it('paces with minIntervalMs (serial)', async () => {
    const start = Date.now();
    // With concurrency=1 the gate fires between every item except the first.
    // 3 items × 50ms gate = ~100ms minimum.
    await parallelMap([1, 2, 3], async (n) => n, { concurrency: 1, minIntervalMs: 50 });
    const elapsed = Date.now() - start;
    expect(elapsed).toBeGreaterThanOrEqual(80);
  });
});

describe('parallelMapSettled', () => {
  it('returns ok-wrapped values for successes', async () => {
    const out = await parallelMapSettled([1, 2, 3], async (n) => n * 10, { concurrency: 2 });
    expect(out).toEqual([
      { ok: true, value: 10 },
      { ok: true, value: 20 },
      { ok: true, value: 30 },
    ]);
  });

  it('isolates per-item failures', async () => {
    const out = await parallelMapSettled(
      [1, 2, 3],
      async (n) => {
        if (n === 2) throw new Error('boom');
        return n;
      },
      { concurrency: 3 },
    );
    expect(out[0]).toEqual({ ok: true, value: 1 });
    expect(out[1].ok).toBe(false);
    expect((out[1] as { ok: false; error: Error }).error.message).toBe('boom');
    expect(out[2]).toEqual({ ok: true, value: 3 });
  });
});
