import { describe, expect, it } from 'bun:test';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { createDelegationBeadsHook } from '../src/hooks/delegation-beads.js';
import plugin from '../src/index.js';
import { createV2Setup, type V2Context } from '../src/v2/setup.js';

const roots: string[] = [];
function project(config?: Record<string, unknown>) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'delegation-beads-'));
  roots.push(root);
  if (config)
    fs.writeFileSync(
      path.join(root, 'opencode.json'),
      JSON.stringify({ 'decision-layer': config }),
    );
  return root;
}

import { afterEach } from 'bun:test';

afterEach(() => {
  for (const root of roots.splice(0)) fs.rmSync(root, { recursive: true, force: true });
});

describe('delegation beads hook', () => {
  it('denies known delegation tools without .beads and allows other tools', async () => {
    const root = project();
    const hook = createDelegationBeadsHook(root);
    await expect(hook({ tool: 'task' })).rejects.toThrow('.beads');
    await expect(hook({ tool: 'SuBaGeNt' })).rejects.toThrow('.beads');
    await expect(hook({ tool: 'read' })).resolves.toBeUndefined();
    fs.mkdirSync(path.join(root, '.beads'));
    await expect(hook({ tool: 'task' })).resolves.toBeUndefined();
  });

  it('registers and enforces the v1 gate only when enabled and opted in', async () => {
    const root = project({ enabled: true, requireBeadsForDelegation: true });
    const setup = plugin.server as (ctx: unknown) => Promise<Record<string, unknown>>;
    const hooks = await setup({ directory: root, worktree: root });
    const hook = hooks['tool.execute.before'] as (event: unknown) => Promise<void>;
    await expect(hook({ tool: 'task' })).rejects.toThrow();
    await expect(hook({ tool: 'subagent' })).rejects.toThrow();
    await expect(hook({ tool: 'read' })).resolves.toBeUndefined();
    fs.mkdirSync(path.join(root, '.beads'));
    await expect(hook({ tool: 'task' })).resolves.toBeUndefined();
    for (const config of [{ enabled: false, requireBeadsForDelegation: true }, { enabled: true }]) {
      const offRoot = project(config);
      const off = await setup({ directory: offRoot, worktree: offRoot });
      expect(off['tool.execute.before']).toBeUndefined();
    }
  });

  it('registers and enforces the v2 gate; missing capability fails visibly', async () => {
    const root = project({ enabled: true, requireBeadsForDelegation: true });
    let before: ((event: unknown) => Promise<void> | void) | undefined;
    const ctx: V2Context = {
      location: { directory: root },
      tool: {
        transform: async () => undefined,
        hook: async (name, callback) => {
          expect(name).toBe('execute.before');
          before = callback;
        },
      },
      session: { hook: async () => undefined },
    };
    await createV2Setup()(ctx);
    expect(before).toBeDefined();
    await expect(before?.({ tool: 'subagent' })).rejects.toThrow();
    await expect(before?.({ tool: 'task' })).rejects.toThrow();
    await expect(before?.({ tool: 'read' })).resolves.toBeUndefined();
    fs.mkdirSync(path.join(root, '.beads'));
    await expect(before?.({ tool: 'subagent' })).resolves.toBeUndefined();
    const missing = { ...ctx, tool: { transform: async () => undefined } } as V2Context;
    await expect(createV2Setup()(missing)).rejects.toThrow('hooks are unavailable');
    const offRoot = project({ enabled: false, requireBeadsForDelegation: true });
    await expect(
      createV2Setup()({
        ...ctx,
        location: { directory: offRoot },
        tool: { transform: async () => undefined },
      } as V2Context),
    ).resolves.toBeUndefined();
  });
});
