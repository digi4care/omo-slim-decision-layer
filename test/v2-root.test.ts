import { afterEach, describe, expect, it } from 'bun:test';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { initRegister, readRegister } from '../src/register/register.js';
import { registerInterviewProjectRoot } from '../src/tools/interview-bridge.js';
import {
  INTERVIEW_PROMOTION_SYMBOL,
  type PromotionInput,
  type PromotionResult,
} from '../src/tools/interview-promotion.js';
import { createV2Setup, type V2Context } from '../src/v2/setup.js';

const dirs: string[] = [];
const globals = globalThis as Record<PropertyKey, unknown>;
let previousBridge: unknown;
interface V2TestTool {
  name: string;
  execute(input: unknown, context: unknown): Promise<{ content: string }>;
}
function fixture() {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'v2-root-'));
  dirs.push(root);
  fs.writeFileSync(
    path.join(root, 'opencode.json'),
    JSON.stringify({ 'decision-layer': { enabled: true } }),
  );
  fs.mkdirSync(path.join(root, '.decisions'));
  initRegister(path.join(root, '.decisions/register.yaml'), {
    id: 'test',
    title: 'Test',
    owner: 'owner',
    change_authority: 'owner',
  });
  fs.writeFileSync(
    path.join(root, 'spec.md'),
    [
      '---',
      'status: complete',
      '---',
      '## Current spec',
      '## 3. Requirements',
      '```decision-record-proposals',
      '- key: choice',
      '  type: DEC',
      '  title: Choose A',
      '  context: User confirmed this choice.',
      '  decision: Choose A.',
      '  consequences: Maintain A.',
      '  alternatives_rejected:',
      '    - alternative: B',
      '      rejected_because: Does not fit.',
      '```',
      '## Q&A history',
      '',
    ].join('\n'),
  );
  return root;
}
afterEach(() => {
  if (previousBridge === undefined) delete globals[INTERVIEW_PROMOTION_SYMBOL];
  else globals[INTERVIEW_PROMOTION_SYMBOL] = previousBridge;
  previousBridge = undefined;
  for (const d of dirs.splice(0)) fs.rmSync(d, { recursive: true, force: true });
});

async function setup(project: string, directory: string) {
  const tools: V2TestTool[] = [];
  const ctx: V2Context = {
    location: { directory, project: { directory: project } },
    tool: {
      transform: async (cb) => {
        cb({ add: (tool) => tools.push(tool as V2TestTool) });
      },
    },
    session: { hook: async () => undefined },
  };
  await createV2Setup()(ctx);
  return tools;
}

describe('v2 bound project root', () => {
  it('binds project.directory for tools and bridge, accepts canonical aliases only', async () => {
    const project = fixture();
    const other = fixture();
    previousBridge = globals[INTERVIEW_PROMOTION_SYMBOL];
    const tools = await setup(project, other);
    const tool = tools.find((entry) => entry.name === 'decision-promote-interview');
    expect(tool).toBeDefined();
    const toolResult = tool ? await tool.execute({ specPath: 'spec.md' }, {}) : undefined;
    expect(JSON.parse(toolResult.content).status).toBe('success');
    expect(readRegister(path.join(project, '.decisions/register.yaml')).records).toHaveLength(1);
    expect(readRegister(path.join(other, '.decisions/register.yaml')).records).toEqual([]);
    const rawBridge = globals[INTERVIEW_PROMOTION_SYMBOL];
    expect(rawBridge).toBeDefined();
    const bridge = rawBridge as { promote(input: PromotionInput): Promise<PromotionResult> };
    // Alias through a symlink resolves to the same canonical project.
    const alias = path.join(path.dirname(project), `${path.basename(project)}-alias`);
    fs.symlinkSync(project, alias);
    dirs.push(alias);
    const aliasResult = await bridge.promote({
      projectRoot: alias,
      specPath: 'spec.md',
      sessionID: 's',
    });
    expect(aliasResult.status).toBe('success');
    expect(aliasResult.reusedIDs).toEqual(['DEC-0001']);
    const before = fs.readFileSync(path.join(project, '.decisions/register.yaml'), 'utf8');
    for (const mismatch of [other, path.dirname(project), `${project}-prefix`]) {
      const result = await bridge.promote({
        projectRoot: mismatch,
        specPath: 'spec.md',
        sessionID: 's',
      });
      expect(result.openQuestions.join(' ')).toContain('not a registered loaded project');
    }
    expect(fs.readFileSync(path.join(project, '.decisions/register.yaml'), 'utf8')).toBe(before);
    expect(readRegister(path.join(other, '.decisions/register.yaml')).records).toHaveLength(0);
  });

  it('routes to either exact root after both projects load', async () => {
    const projectA = fixture();
    const projectB = fixture();
    previousBridge = globals[INTERVIEW_PROMOTION_SYMBOL];
    await setup(projectA, projectA);
    await setup(projectB, projectB);
    const rawBridge = globals[INTERVIEW_PROMOTION_SYMBOL];
    const bridge = rawBridge as { promote(input: PromotionInput): Promise<PromotionResult> };
    for (const [root, sessionID] of [
      [projectA, 'a'],
      [projectB, 'b'],
    ]) {
      const result = await bridge.promote({ projectRoot: root, specPath: 'spec.md', sessionID });
      expect(result.status).toBe('success');
    }
    expect(readRegister(path.join(projectA, '.decisions/register.yaml')).records).toHaveLength(1);
    expect(readRegister(path.join(projectB, '.decisions/register.yaml')).records).toHaveLength(1);
  });

  it('replaces a legacy singleton and shares registrations across callers', async () => {
    const projectA = fixture();
    const projectB = fixture();
    previousBridge = globals[INTERVIEW_PROMOTION_SYMBOL];
    globals[INTERVIEW_PROMOTION_SYMBOL] = { promote: async () => ({ status: 'failed' }) };
    registerInterviewProjectRoot(projectA);
    const dispatcher = globals[INTERVIEW_PROMOTION_SYMBOL] as {
      promote(input: PromotionInput): Promise<PromotionResult>;
    };
    registerInterviewProjectRoot(projectB);
    expect(globals[INTERVIEW_PROMOTION_SYMBOL]).toBe(dispatcher);
    for (const [root, sessionID] of [
      [projectA, 'a'],
      [projectB, 'b'],
    ]) {
      const result = await dispatcher.promote({
        projectRoot: root,
        specPath: 'spec.md',
        sessionID,
      });
      expect(result.status).toBe('success');
    }
    const unknown = fixture();
    const rejected = await dispatcher.promote({
      projectRoot: unknown,
      specPath: 'spec.md',
      sessionID: 'unknown',
    });
    expect(rejected.status).toBe('needs-review');
    expect(readRegister(path.join(unknown, '.decisions/register.yaml')).records).toHaveLength(0);
  });
});
