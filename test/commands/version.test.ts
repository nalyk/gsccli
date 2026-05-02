import { spawnSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

// Regression guard: v1.2.0 shipped with `.version('1.1.0')` hardcoded in
// src/index.ts, so the published binary reported the wrong version after upgrade.
// This test asserts that the CLI's --version output stays in sync with
// package.json on every release.

const REPO_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..', '..');
const ENTRY = join(REPO_ROOT, 'src/index.ts');
const PKG = JSON.parse(readFileSync(join(REPO_ROOT, 'package.json'), 'utf-8')) as { version: string };

describe('--version', () => {
  it('reports the version from package.json (no hardcoded drift)', () => {
    const result = spawnSync('npx', ['tsx', ENTRY, '--version'], { encoding: 'utf-8' });
    expect(result.status).toBe(0);
    expect(result.stdout.trim()).toBe(PKG.version);
  }, 30_000);
});
