import { afterEach, describe, expect, it } from 'bun:test';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { addRecord, initRegister, readRegister } from '../src/register/register.js';
import { parseInterviewProposals, promoteInterview } from '../src/tools/interview-promotion.js';

const dirs: string[] = [];
function fixture(enabled = true, register = true) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'interview-promotion-'));
  dirs.push(root);
  fs.writeFileSync(
    path.join(root, 'opencode.json'),
    JSON.stringify({ 'decision-layer': { enabled } }),
  );
  if (register)
    initRegister(path.join(root, '.decisions/register.yaml'), {
      id: 'test',
      title: 'Test',
      owner: 'owner',
      change_authority: 'owner',
    });
  return root;
}
const candidate = `- key: choice
  type: DEC
  title: Choose A
  context: User confirmed this choice.
  decision: Choose A.
  consequences: Maintain A.
  alternatives_rejected:
    - alternative: B
      rejected_because: Does not fit.`;
function spec(root: string, status = 'complete', proposals = candidate) {
  const f = path.join(root, 'spec.md');
  const proposalBlock = proposals
    ? ['```decision-record-proposals', proposals, '```'].join('\n')
    : 'none';
  const historyBlock = ['```decision-record-proposals', candidate, '```'].join('\n');
  fs.writeFileSync(
    f,
    [
      '---',
      `status: ${status}`,
      '---',
      '## Current spec',
      '',
      '## 3. Requirements',
      '',
      proposalBlock,
      '## 9. Acceptance',
      '',
      '## Q&A history',
      '',
      historyBlock,
    ].join('\n'),
  );
  return f;
}
const run = (r: string, f: string) =>
  promoteInterview({ projectRoot: r, specPath: f, sessionID: 's1' });
afterEach(() => {
  for (const d of dirs.splice(0)) fs.rmSync(d, { recursive: true, force: true });
});
describe('interview promotion', () => {
  it('parses candidates in numbered Current spec sections, not Q&A history', () => {
    expect(parseInterviewProposals(fs.readFileSync(spec(fixture()), 'utf8'))).toHaveLength(1);
    for (const section of ['3. Requirements', '9. Acceptance']) {
      const text = [
        '## Current spec',
        `## ${section}`,
        '```decision-record-proposals',
        candidate,
        '```',
        '## Q&A history',
      ].join('\n');
      expect(parseInterviewProposals(text)).toHaveLength(1);
    }
    expect(
      parseInterviewProposals(
        `## Interview log\n\`\`\`decision-record-proposals\n${candidate}\n\`\`\``,
      ),
    ).toEqual([]);
  });
  it('requires complete status', async () => {
    const r = fixture();
    expect((await run(r, spec(r, 'draft'))).status).toBe('needs-review');
  });
  it('does not initialize missing register', async () => {
    const r = fixture(true, false);
    expect((await run(r, spec(r))).status).toBe('needs-review');
    expect(fs.existsSync(path.join(r, '.decisions/register.yaml'))).toBe(false);
  });
  it('reports missing register before checking absent proposals', async () => {
    const r = fixture(true, false);
    const out = await run(r, spec(r, 'complete', ''));
    expect(out.status).toBe('needs-review');
    expect(out.openQuestions[0]).toContain('Register missing');
  });
  it('honors disabled config', async () => {
    const r = fixture(false);
    expect((await run(r, spec(r))).status).toBe('needs-review');
  });
  it('adds then reuses on retry', async () => {
    const r = fixture();
    const f = spec(r);
    expect((await run(r, f)).status).toBe('success');
    expect((await run(r, f)).reusedIDs).toEqual(['DEC-0001']);
  });
  it('reports changed candidate key for review', async () => {
    const r = fixture();
    const f = spec(r);
    await run(r, f);
    fs.writeFileSync(f, fs.readFileSync(f, 'utf8').replace('Choose A.', 'Choose C.'));
    const out = await run(r, f);
    expect(out.status).toBe('needs-review');
    expect(out.openQuestions.length).toBeGreaterThan(0);
  });
  it('reuses an equal preexisting same-title candidate without adding', async () => {
    const r = fixture();
    addRecord(path.join(r, '.decisions/register.yaml'), {
      type: 'DEC',
      title: 'Choose A',
      context: 'User confirmed this choice.',
      decision: 'Choose A.',
      consequences: 'Maintain A.',
      alternatives_rejected: [{ alternative: 'B', rejected_because: 'Does not fit.' }],
    });
    const out = await run(r, spec(r));
    expect(out.status).toBe('success');
    expect(out.reusedIDs).toEqual(['DEC-0001']);
    expect(out.addedIDs).toEqual([]);
    expect(readRegister(path.join(r, '.decisions/register.yaml')).records).toHaveLength(1);
  });
  it('does not duplicate same-title record with conflicting decision', async () => {
    const r = fixture();
    addRecord(path.join(r, '.decisions/register.yaml'), {
      type: 'DEC',
      title: 'Choose A',
      context: 'User confirmed this choice.',
      decision: 'Choose B.',
      consequences: 'Maintain A.',
      alternatives_rejected: [{ alternative: 'B', rejected_because: 'Does not fit.' }],
    });
    const out = await run(r, spec(r));
    expect(out.status).toBe('needs-review');
    expect(out.openQuestions[0]).toContain('conflicts');
    expect(readRegister(path.join(r, '.decisions/register.yaml')).records).toHaveLength(1);
  });
  it('rejects spec traversal and escaped register path', async () => {
    const r = fixture();
    expect((await run(r, path.join(r, '..', 'outside.md'))).status).toBe('failed');
    fs.writeFileSync(
      path.join(r, 'opencode.json'),
      JSON.stringify({ 'decision-layer': { enabled: true, registerPath: '../outside.yaml' } }),
    );
    expect((await run(r, spec(r))).status).toBe('failed');
  });
  it('rejects a register symlink whose target escapes project root', async () => {
    const r = fixture(true, false);
    const outside = path.join(path.dirname(r), `outside-register-${path.basename(r)}.yaml`);
    initRegister(outside, {
      id: 'outside',
      title: 'Outside',
      owner: 'owner',
      change_authority: 'owner',
    });
    fs.mkdirSync(path.join(r, '.decisions'), { recursive: true });
    fs.symlinkSync(outside, path.join(r, '.decisions/register.yaml'));
    const out = await run(r, spec(r));
    expect(out.status).toBe('failed');
    expect(out.error).toContain('symlink escapes');
    fs.unlinkSync(outside);
  });
  it('validates proposed records after promotion', async () => {
    const r = fixture();
    await run(r, spec(r));
    expect(readRegister(path.join(r, '.decisions/register.yaml')).records[0]?.status).toBe(
      'proposed',
    );
  });
});
