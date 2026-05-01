import { spawn } from 'node:child_process';
import { existsSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const BIN = resolve(process.cwd(), 'dist/index.js');

interface JsonRpcResponse {
  jsonrpc: '2.0';
  id: number;
  result?: { tools?: Array<{ name: string }> };
  error?: { message: string };
}

async function rpc(messages: object[]): Promise<JsonRpcResponse[]> {
  return await new Promise((resolveResult, reject) => {
    const proc = spawn('node', [BIN, 'mcp', 'serve'], { stdio: ['pipe', 'pipe', 'pipe'] });
    const chunks: Buffer[] = [];
    proc.stdout.on('data', (c) => chunks.push(c));
    proc.stderr.on('data', () => {
      // ignore stderr noise (auth warnings) for smoke tests
    });
    proc.on('error', reject);
    proc.on('close', () => {
      const stdout = Buffer.concat(chunks).toString('utf-8');
      const responses = stdout
        .split('\n')
        .filter(Boolean)
        .map((line) => JSON.parse(line) as JsonRpcResponse);
      resolveResult(responses);
    });

    for (const m of messages) {
      proc.stdin.write(`${JSON.stringify(m)}\n`);
    }
    proc.stdin.end();
  });
}

const builtBin = existsSync(BIN);

describe.skipIf(!builtBin)('mcp serve (stdio smoke)', () => {
  it('responds to initialize handshake', async () => {
    const [resp] = await rpc([
      {
        jsonrpc: '2.0',
        id: 1,
        method: 'initialize',
        params: {
          protocolVersion: '2024-11-05',
          capabilities: {},
          clientInfo: { name: 'smoke', version: '1' },
        },
      },
    ]);
    expect(resp.result).toBeDefined();
    expect(resp.error).toBeUndefined();
  });

  it('lists exactly the 4 expected tools', async () => {
    const [, listResp] = await rpc([
      {
        jsonrpc: '2.0',
        id: 1,
        method: 'initialize',
        params: {
          protocolVersion: '2024-11-05',
          capabilities: {},
          clientInfo: { name: 'smoke', version: '1' },
        },
      },
      { jsonrpc: '2.0', id: 2, method: 'tools/list' },
    ]);
    const names = listResp.result?.tools?.map((t) => t.name).sort() ?? [];
    expect(names).toEqual([
      'gsccli_inspect_url',
      'gsccli_query',
      'gsccli_sitemaps_list',
      'gsccli_sites_list',
    ]);
  });
});
