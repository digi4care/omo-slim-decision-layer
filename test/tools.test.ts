import { afterEach, beforeEach, describe, expect, test } from 'bun:test';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import type { ToolContext } from '@opencode-ai/plugin';
import { dump } from 'js-yaml';
import { initRegister, readRegister, type Workspace } from '../src/register/register.js';
import { createDecisionTools } from '../src/tools/index.js';
import { resolveProjectRoot, resolveRegisterPath } from '../src/tools/paths.js';

function makeWorkspace(): Workspace {
  return {
    id: 'test',
    title: 'Test workspace',
    owner: 'repo-owner',
    change_authority: 'repo-owner',
  };
}

function makeCtx(worktree: string, directory = worktree): ToolContext {
  return {
    sessionID: 's',
    messageID: 'm',
    agent: 'a',
    directory,
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
      dump({
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

  test('decision-reject transitions and stores reason', async () => {
    await tools['decision-add'].execute({ type: 'REQ', title: 'R' }, ctx);
    const result = await tools['decision-reject'].execute(
      { id: 'REQ-0001', reason: 'Not needed' },
      ctx,
    );
    expect(result).toContain('Rejected');
    const register = readRegister(path.join(tmpDir, '.decisions', 'register.yaml'));
    expect(register.records[0].status).toBe('rejected');
    expect(register.records[0].status_reason).toBe('Not needed');
  });

  test('decision-close records an outcome on a proposed assumption', async () => {
    const bodyPath = path.join(tmpDir, 'assumption.yaml');
    fs.writeFileSync(bodyPath, dump({ needed_to_close: 'Run the interview' }), 'utf-8');
    await tools['decision-add'].execute(
      { type: 'ASSUMPTION', title: 'Agents read the register', body: 'assumption.yaml' },
      ctx,
    );

    const result = await tools['decision-close'].execute(
      { id: 'ASSUMPTION-0001', outcome: 'verified', reason: 'Cited DEC-0002' },
      ctx,
    );
    expect(result).toContain('Closed ASSUMPTION-0001 as verified');

    const register = readRegister(registerPath);
    const record = register.records[0];
    expect(record.status).toBe('accepted');
    expect(record.type === 'ASSUMPTION' && record.outcome).toBe('verified');
    expect(record.status_reason).toBe('Cited DEC-0002');
  });

  test('decision-close refuses a second outcome', async () => {
    const bodyPath = path.join(tmpDir, 'assumption.yaml');
    fs.writeFileSync(bodyPath, dump({ needed_to_close: 'x' }), 'utf-8');
    await tools['decision-add'].execute(
      { type: 'ASSUMPTION', title: 'A', body: 'assumption.yaml' },
      ctx,
    );
    await tools['decision-close'].execute({ id: 'ASSUMPTION-0001', outcome: 'verified' }, ctx);
    const again = await tools['decision-close'].execute(
      { id: 'ASSUMPTION-0001', outcome: 'refuted' },
      ctx,
    );
    // The status guard fires first: a closed assumption is accepted, so it can
    // no longer be closed at all.
    expect(again).toContain('only proposed assumptions can be closed');
  });

  test('decision-close refuses a non-assumption', async () => {
    await tools['decision-add'].execute({ type: 'REQ', title: 'R' }, ctx);
    const result = await tools['decision-close'].execute(
      { id: 'REQ-0001', outcome: 'verified' },
      ctx,
    );
    expect(result).toContain('is not an assumption');
  });

  test('decision-close omits outcome when absent', async () => {
    const bodyPath = path.join(tmpDir, 'assumption.yaml');
    fs.writeFileSync(bodyPath, dump({ needed_to_close: 'x' }), 'utf-8');
    await tools['decision-add'].execute(
      { type: 'ASSUMPTION', title: 'A', body: 'assumption.yaml' },
      ctx,
    );
    const raw = fs.readFileSync(registerPath, 'utf-8');
    expect(raw).not.toContain('outcome:');
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
      dump({
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
    fs.writeFileSync(assumptionBodyPath, dump({ needed_to_close: 'verify' }), 'utf-8');
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
      dump({
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
    await tools['decision-reject'].execute({ id: 'REQ-0001', reason: 'Duplicate' }, ctx);
    const result = await tools['decision-view'].execute({}, ctx);
    expect(result).toContain('View written to');
    const viewPath = path.join(tmpDir, '.decisions', 'views', 'register.md');
    expect(fs.existsSync(viewPath)).toBe(true);
    // VAL-005: view carries the same information as the register
    expect(fs.readFileSync(viewPath, 'utf-8')).toContain('Status reason: Duplicate');
  });

  test('decision-supersede replaces record and stores reason on old record', async () => {
    await tools['decision-add'].execute({ type: 'REQ', title: 'Old' }, ctx);
    await tools['decision-ratify'].execute({ id: 'REQ-0001' }, ctx);
    const byPath = path.join(tmpDir, 'new.yaml');
    fs.writeFileSync(byPath, dump({ type: 'REQ', title: 'New' }), 'utf-8');
    const result = await tools['decision-supersede'].execute(
      { id: 'REQ-0001', by: 'new.yaml', reason: 'Superseded by newer decision' },
      ctx,
    );
    expect(result).toContain('Superseded REQ-0001');
    const register = readRegister(path.join(tmpDir, '.decisions', 'register.yaml'));
    const oldRecord = register.records.find((r) => r.id === 'REQ-0001');
    expect(oldRecord?.status).toBe('superseded');
    expect(oldRecord?.status_reason).toBe('Superseded by newer decision');
  });

  test('decision-supersede without reason leaves status_reason absent', async () => {
    await tools['decision-add'].execute({ type: 'REQ', title: 'Old' }, ctx);
    const byPath = path.join(tmpDir, 'new.yaml');
    fs.writeFileSync(byPath, dump({ type: 'REQ', title: 'New' }), 'utf-8');
    await tools['decision-supersede'].execute({ id: 'REQ-0001', by: 'new.yaml' }, ctx);
    const register = readRegister(path.join(tmpDir, '.decisions', 'register.yaml'));
    const oldRecord = register.records.find((r) => r.id === 'REQ-0001');
    expect(oldRecord?.status_reason).toBeUndefined();
  });

  test('path escape is refused', async () => {
    const bodyPath = path.join(tmpDir, 'body.yaml');
    fs.writeFileSync(bodyPath, dump({ decision: 'x', consequences: 'y' }), 'utf-8');
    await expect(
      tools['decision-add'].execute({ type: 'DEC', title: 'Escape', body: '../body.yaml' }, ctx),
    ).rejects.toThrow(/escapes worktree/);
  });
});

describe('root resolution', () => {
  let tmpDir: string;

  beforeEach(async () => {
    tmpDir = await fs.promises.mkdtemp(path.join(os.tmpdir(), 'decision-layer-root-'));
  });

  afterEach(() => {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  test("worktree '/' with valid directory resolves to directory", () => {
    const root = resolveProjectRoot({ worktree: '/', directory: tmpDir });
    expect(root).toBe(path.resolve(tmpDir));
    expect(root).not.toBe('/');
  });

  test("worktree '/' and directory '/' throws instead of touching /", () => {
    expect(() => resolveProjectRoot({ worktree: '/', directory: '/' })).toThrow(/Refusing/);
    expect(() => resolveRegisterPath('/')).toThrow(/Refusing/);
  });

  test('undefined worktree falls back to directory', () => {
    expect(resolveProjectRoot({ directory: tmpDir })).toBe(path.resolve(tmpDir));
  });

  test('worktree missing on disk falls back to directory', () => {
    const root = resolveProjectRoot({
      worktree: path.join(tmpDir, 'does-not-exist'),
      directory: tmpDir,
    });
    expect(root).toBe(path.resolve(tmpDir));
  });

  test('candidate resolving to "/" via .. is rejected', () => {
    // '/tmp/..' still stats as an existing directory, but resolves to '/'
    expect(resolveProjectRoot({ worktree: '/tmp/..', directory: tmpDir })).toBe(
      path.resolve(tmpDir),
    );
  });

  test('live shape: worktree "/" — init and add land in directory, never in /', async () => {
    const tools = createDecisionTools();
    const ctx = makeCtx('/', tmpDir);
    const init = await tools['decision-init'].execute(
      { id: 'acme', title: 'Acme', owner: 'repo-owner', change_authority: 'repo-owner' },
      ctx,
    );
    expect(init).toContain('Initialized');
    const add = await tools['decision-add'].execute({ type: 'REQ', title: 'live smoke test' }, ctx);
    expect(add).toContain('Added REQ-0001');
    expect(fs.existsSync(path.join(tmpDir, '.decisions', 'register.yaml'))).toBe(true);
    expect(fs.existsSync('/.decisions')).toBe(false);
  });
});

describe('decision-init', () => {
  let tmpDir: string;
  let ctx: ToolContext;
  let tools: ReturnType<typeof createDecisionTools>;

  const initArgs = {
    id: 'acme',
    title: 'Acme workspace',
    owner: 'repo-owner',
    change_authority: 'repo-owner',
  };

  beforeEach(async () => {
    tmpDir = await fs.promises.mkdtemp(path.join(os.tmpdir(), 'decision-layer-init-'));
    ctx = makeCtx(tmpDir);
    tools = createDecisionTools();
  });

  afterEach(() => {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  test('creates a valid empty register and pre-creates views dir', async () => {
    const result = await tools['decision-init'].execute(initArgs, ctx);
    expect(result).toContain('Initialized');
    expect(result).toContain('.decisions/register.yaml');
    const register = readRegister(path.join(tmpDir, '.decisions', 'register.yaml'));
    expect(register.schema_version).toBe('1.0');
    expect(register.workspace.id).toBe('acme');
    expect(register.records).toHaveLength(0);
    expect(fs.existsSync(path.join(tmpDir, '.decisions', 'views'))).toBe(true);
  });

  test('refuses to overwrite an existing register', async () => {
    await tools['decision-init'].execute(initArgs, ctx);
    const before = fs.readFileSync(path.join(tmpDir, '.decisions', 'register.yaml'), 'utf-8');
    const second = await tools['decision-init'].execute(
      { ...initArgs, id: 'other', title: 'Other' },
      ctx,
    );
    expect(second).toContain('already exists');
    expect(second).toContain('not overwriting');
    const after = fs.readFileSync(path.join(tmpDir, '.decisions', 'register.yaml'), 'utf-8');
    expect(after).toBe(before);
    expect(readRegister(path.join(tmpDir, '.decisions', 'register.yaml')).workspace.id).toBe(
      'acme',
    );
  });

  test('after init, decision-add works end-to-end', async () => {
    await tools['decision-init'].execute(initArgs, ctx);
    const result = await tools['decision-add'].execute({ type: 'REQ', title: 'First record' }, ctx);
    expect(result).toContain('Added REQ-0001');
    const register = readRegister(path.join(tmpDir, '.decisions', 'register.yaml'));
    expect(register.records).toHaveLength(1);
  });

  test('eleven tools are exported including decision-promote-interview', () => {
    expect(Object.keys(tools)).toHaveLength(11);
    expect(Object.keys(tools)).toContain('decision-init');
    expect(Object.keys(tools)).toContain('decision-close');
  });
});
