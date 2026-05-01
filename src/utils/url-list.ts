import { readFileSync } from 'node:fs';

// Shared URL-list parsing for `inspect batch` and `index batch`. Both commands accept a
// file or stdin with one URL per line; #-prefixed lines are treated as comments. Blank
// lines are skipped. Whitespace is trimmed.

function parseLines(raw: string): string[] {
  return raw
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter((l) => l.length > 0 && !l.startsWith('#'));
}

export function readUrlsFromFile(path: string): string[] {
  return parseLines(readFileSync(path, 'utf-8'));
}

export async function readUrlsFromStdin(): Promise<string[]> {
  const chunks: Buffer[] = [];
  for await (const chunk of process.stdin) {
    chunks.push(chunk as Buffer);
  }
  return parseLines(Buffer.concat(chunks).toString('utf-8'));
}

// Convenience: pick whichever input the user supplied. Throws if neither is set.
export async function readUrlList(opts: { urlsFile?: string; urlsStdin?: boolean }): Promise<string[]> {
  if (opts.urlsFile) return readUrlsFromFile(opts.urlsFile);
  if (opts.urlsStdin) return readUrlsFromStdin();
  throw new Error('Provide --urls-file <path> or --urls-stdin');
}
