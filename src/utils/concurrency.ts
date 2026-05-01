// Bounded-concurrency worker pool with optional rate pacing. Used by `inspect batch` and
// `index batch` to respect GSC's per-minute and per-day quotas without blowing memory on
// a 100K-URL list.

const sleep = (ms: number): Promise<void> => new Promise((r) => setTimeout(r, ms));

export interface ParallelMapOptions {
  concurrency: number;
  // Min interval between request *starts* across the whole pool, in ms.
  // Set from RPS: intervalMs = 1000 / rpsLimit.
  minIntervalMs?: number;
  // Optional progress callback — invoked after each result; not on errors.
  onProgress?: (completed: number, total: number) => void;
}

export async function parallelMap<T, R>(
  items: T[],
  fn: (item: T, index: number) => Promise<R>,
  opts: ParallelMapOptions,
): Promise<R[]> {
  const total = items.length;
  const results: R[] = new Array(total);
  let nextIndex = 0;
  let completed = 0;
  let lastStartedAt = 0;

  const worker = async (): Promise<void> => {
    while (true) {
      const i = nextIndex++;
      if (i >= total) return;

      if (opts.minIntervalMs && opts.minIntervalMs > 0) {
        const now = Date.now();
        const wait = Math.max(0, opts.minIntervalMs - (now - lastStartedAt));
        if (wait > 0) await sleep(wait);
        lastStartedAt = Date.now();
      }

      results[i] = await fn(items[i], i);
      completed += 1;
      opts.onProgress?.(completed, total);
    }
  };

  const pool = Math.max(1, Math.min(opts.concurrency, total));
  await Promise.all(Array.from({ length: pool }, () => worker()));
  return results;
}

// Same as parallelMap but doesn't reject on per-item failures — wraps each result in
// {ok: true, value} or {ok: false, error}. Used for batch URL inspection where a 403 on
// one URL shouldn't kill the whole batch.
export type Settled<R> = { ok: true; value: R } | { ok: false; error: Error };

export async function parallelMapSettled<T, R>(
  items: T[],
  fn: (item: T, index: number) => Promise<R>,
  opts: ParallelMapOptions,
): Promise<Settled<R>[]> {
  return parallelMap(
    items,
    async (item, i) => {
      try {
        return { ok: true, value: await fn(item, i) } as Settled<R>;
      } catch (err) {
        return { ok: false, error: err instanceof Error ? err : new Error(String(err)) } as Settled<R>;
      }
    },
    opts,
  );
}
