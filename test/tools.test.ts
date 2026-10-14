import { afterEach, beforeEach, describe, expect, test } from 'bun:test';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import type { ToolContext } from '@opencode-ai/plugin';
import yaml from 'js-yaml';
import { initRegister, type Workspace } from '../src/register/register.js';
import { createDecisionTools } from '../src/tools/index.js';

function makeWorkspace(): Workspace {
  return {
    id: 'test',
    title: 'Test workspace',
    owner: 'repo-owner',
    change_authority: 'repo-owner',
  };
}

function makeCtx(worktree: string): ToolContext {
  return {
    sessionID: 's',
    messageID: 'm',
    agent: 'a',
    directory: worktree,
    worktree,
    abort: new AbortController().signal,
    metadata() {},
    async ask() {},
  };
}

describe('tools', () => {
  let tmpDir: string;
  let registerPath: string;
  let ctx: ToolContext;
  let tools: ReturnType<typeof createDecisionTools>;

  beforeEach(async () => {
    tmpDir = await fs.promises.mkdtemp(path.join(os.tmpdir(), 'decision-layer-tools-'));
    registerPath = path.join(tmpDir, '.decisions', 'register.yaml');
    initRegister(registerPath, makeWorkspace());
    ctx = makeCtx(tmpDir);
    tools = createDecisionTools();
  });

  afterEach(() => {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  test('decision-add creates a proposed record', async () => {
    const result = await tools['decision-add'].execute({ type: 'REQ', title: 'Req title' }, ctx);
    expect(result).toContain('Added REQ-0001');
    expect(result).toContain('proposed');
  });

  test('decision-add with body file', async () => {
    const bodyPath = path.join(tmpDir, 'body.yaml');
    fs.writeFileSync(
      bodyPath,
      yaml.dump({
        decision: 'Use YAML',
        consequences: 'Readable diffs',
        alternatives_rejected: [{ alternative: 'JSON', rejected_because: 'Noisy diffs' }],
      }),
      'utf-8',
    );
    const result = await tools['decision-add'].execute(
      { type: 'DEC', title: 'Format', body: 'body.yaml' },
      ctx,
    );
    expect(result).toContain('Added DEC-0001');
  });

  test('decision-ratify transitions and no-ops', async () => {
    await tools['decision-add'].execute({ type: 'REQ', title: 'R' }, ctx);
    const first = await tools['decision-ratify'].execute({ id: 'REQ-0001' }, ctx);
    expect(first).toContain('Ratified');
    const second = await tools['decision-ratify'].execute({ id: 'REQ-0001' }, ctx);
    expect(second).toContain('already accepted');
  });

  test('decision-reject transitions', async () => {
    await tools['decision-add'].execute({ type: 'REQ', title: 'R' }, ctx);
    const result = await tools['decision-reject'].execute(
      { id: 'REQ-0001', reason: 'Not needed' },
      ctx,
    );
    expect(result).toContain('Rejected');
  });

  test('decision-list filters', async () => {
    await tools['decision-add'].execute({ type: 'REQ', title: 'R1' }, ctx);
    await tools['decision-add'].execute({ type: 'REQ', title: 'R2' }, ctx);
    await tools['decision-ratify'].execute({ id: 'REQ-0001' }, ctx);
    const all = await tools['decision-list'].execute({}, ctx);
    expect(all).toContain('REQ-0001');
    expect(all).toContain('REQ-0002');
    const acceptedOnly = await tools['decision-list'].execute({ status: 'accepted' }, ctx);
    expect(acceptedOnly).toContain('REQ-0001');
    expect(acceptedOnly).not.toContain('REQ-0002');
  });

  test('decision-query orphan correctness both directions', async () => {
    await tools['decision-add'].execute({ type: 'REQ', title: 'Linked REQ' }, ctx);

    const decBodyPath = path.join(tmpDir, 'dec.yaml');
    fs.writeFileSync(
      decBodyPath,
      yaml.dump({
        decision: 'x',
        consequences: 'y',
        links: [{ type: 'constrains', target: 'REQ-0001', rationale: 'r' }],
      }),
      'utf-8',
    );
    await tools['decision-add'].execute(
      { type: 'DEC', title: 'Linked DEC', body: 'dec.yaml' },
      ctx,
    );

    const assumptionBodyPath = path.join(tmpDir, 'assumption.yaml');
    fs.writeFileSync(assumptionBodyPath, yaml.dump({ needed_to_close: 'verify' }), 'utf-8');
    await tools['decision-add'].execute(
      { type: 'ASSUMPTION', title: 'Orphan', body: 'assumption.yaml' },
      ctx,
    );

    const result = await tools['decision-query'].execute({ orphan: true }, ctx);
    expect(result).toContain('ASSUMPTION-0001');
    expect(result).not.toContain('REQ-0001');
    expect(result).not.toContain('DEC-0001');
  });

  test('decision-query for record returns related records', async () => {
    await tools['decision-add'].execute({ type: 'REQ', title: 'REQ' }, ctx);
    const bodyPath = path.join(tmpDir, 'dec.yaml');
    fs.writeFileSync(
      bodyPath,
      yaml.dump({
        decision: 'x',
        consequences: 'y',
        links: [{ type: 'constrains', target: 'REQ-0001', rationale: 'r' }],
      }),
      'utf-8',
    );
    await tools['decision-add'].execute({ type: 'DEC', title: 'DEC', body: 'dec.yaml' }, ctx);
    const result = await tools['decision-query'].execute({ for: 'REQ-0001' }, ctx);
    expect(result).toContain('DEC-0001');
    expect(result).toContain('REQ-0001');
  });

  test('decision-validate reports ok', async () => {
    const result = await tools['decision-validate'].execute({}, ctx);
    expect(result).toContain('valid');
  });

  test('decision-view writes markdown', async () => {
    await tools['decision-add'].execute({ type: 'REQ', title: 'R' }, ctx);
    const result = await tools['decision-view'].execute({}, ctx);
    expect(result).toContain('View written to');
    const viewPath = path.join(tmpDir, '.decisions', 'views', 'register.md');
    expect(fs.existsSync(viewPath)).toBe(true);
  });

  test('decision-supersede replaces record', async () => {
    await tools['decision-add'].execute({ type: 'REQ', title: 'Old' }, ctx);
    await tools['decision-ratify'].execute({ id: 'REQ-0001' }, ctx);
    const byPath = path.join(tmpDir, 'new.yaml');
    fs.writeFileSync(byPath, yaml.dump({ type: 'REQ', title: 'New' }), 'utf-8');
    const result = await tools['decision-supersede'].execute(
      { id: 'REQ-0001', by: 'new.yaml' },
      ctx,
    );
    expect(result).toContain('Superseded REQ-0001');
  });

  test('path escape is refused', async () => {
    const bodyPath = path.join(tmpDir, 'body.yaml');
    fs.writeFileSync(bodyPath, yaml.dump({ decision: 'x', consequences: 'y' }), 'utf-8');
    await expect(
      tools['decision-add'].execute({ type: 'DEC', title: 'Escape', body: '../body.yaml' }, ctx),
    ).rejects.toThrow(/escapes worktree/);
  });
});
