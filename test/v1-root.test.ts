import { afterEach, describe, expect, it } from 'bun:test';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import type { ToolContext } from '@opencode-ai/plugin';
import DecisionLayer from '../src/index.js';
import { initRegister, readRegister } from '../src/register/register.js';
import { createDecisionTools } from '../src/tools/index.js';
import {
  INTERVIEW_PROMOTION_SYMBOL,
  type PromotionInput,
  type PromotionResult,
} from '../src/tools/interview-promotion.js';

const dirs: string[] = [];
const globals = globalThis as Record<PropertyKey, unknown>;
let previousBridge: unknown;
function fixture() {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'v1-root-'));
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
  for (const dir of dirs.splice(0)) fs.rmSync(dir, { recursive: true, force: true });
});

describe('v1 tool project root', () => {
  it('promotes against valid worktree rather than a different directory', async () => {
    const worktree = fixture();
    const directory = fixture();
    const context = { worktree, directory, sessionID: 'v1-session' } as unknown as ToolContext;
    const result = await createDecisionTools()['decision-promote-interview'].execute(
      { specPath: 'spec.md' },
      context,
    );
    expect(JSON.parse(result).status).toBe('success');
    expect(readRegister(path.join(worktree, '.decisions/register.yaml')).records).toHaveLength(1);
    expect(readRegister(path.join(directory, '.decisions/register.yaml')).records).toHaveLength(0);
  });

  it('registers both v1 worktree and OMO directory, rejecting other roots', async () => {
    const worktree = fixture();
    const directory = fixture();
    const unknown = fixture();
    previousBridge = globals[INTERVIEW_PROMOTION_SYMBOL];
    await DecisionLayer.server({ worktree, directory } as never);
    const bridge = globals[INTERVIEW_PROMOTION_SYMBOL] as {
      promote(input: PromotionInput): Promise<PromotionResult>;
    };
    for (const [projectRoot, sessionID] of [
      [worktree, 'worktree'],
      [directory, 'directory'],
    ]) {
      const result = await bridge.promote({ projectRoot, specPath: 'spec.md', sessionID });
      expect(result.status).toBe('success');
    }
    const rejected = await bridge.promote({
      projectRoot: unknown,
      specPath: 'spec.md',
      sessionID: 'unknown',
    });
    expect(rejected.status).toBe('needs-review');
    expect(readRegister(path.join(unknown, '.decisions/register.yaml')).records).toHaveLength(0);
  });
});
