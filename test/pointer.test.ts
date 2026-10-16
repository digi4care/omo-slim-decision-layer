import { describe, expect, it } from 'bun:test';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { createSystemTransformHook } from '../src/hooks/register-pointer.js';
import { appendActivationLog, registerExists } from '../src/log.js';
import { pointerAlreadyPresent, REGISTER_POINTER } from '../src/prompts/register-pointer.js';
import { createDecisionTools } from '../src/tools/index.js';
import { createRegisterPointerHandler } from '../src/v2/setup.js';

function contextEvent() {
  return {
    sessionID: 's1',
    system: [{ type: 'text' as const, text: 'base system prompt' }],
  };
}

describe('REGISTER_POINTER', () => {
  it('names the register and remains read-only', () => {
    expect(REGISTER_POINTER).toContain('decision-list');
    expect(REGISTER_POINTER).toContain(
      'Do not change or add register records unless the user asks',
    );
  });

  it('guides an unfinished workflow to a recommended next action without claiming enforcement', () => {
    expect(REGISTER_POINTER).toContain('concrete next actions with costs and a recommendation');
    expect(REGISTER_POINTER).toContain('Continue already-authorized work');
    expect(REGISTER_POINTER).toContain('Do not present this guidance as a technical gate');
  });

  it('pauses only dependent code for an unaccepted determining architecture choice', () => {
    expect(REGISTER_POINTER).toContain('lacks an accepted decision record');
    expect(REGISTER_POINTER).toContain('pause only dependent code changes');
    expect(REGISTER_POINTER).toContain('continue independent work');
    expect(REGISTER_POINTER).toContain('Never ratify yourself');
  });

  it('does not prescribe write tools in ambient prompt', () => {
    expect(REGISTER_POINTER).not.toContain('decision-add');
    expect(REGISTER_POINTER).toContain('unless the user asks');
  });

  it('carries no record counts, ids or interpolated paths', () => {
    // Fixed bytes: anything that changed per request would break the prompt cache.
    expect(REGISTER_POINTER).not.toMatch(/\bREQ-\d/);
    expect(REGISTER_POINTER).not.toMatch(/\bDEC-\d/);
    expect(REGISTER_POINTER).not.toMatch(/\d+\s+records?/i);
    expect(REGISTER_POINTER).not.toContain(process.cwd());
  });

  it('detects its own presence', () => {
    expect(pointerAlreadyPresent(['a', REGISTER_POINTER, 'b'])).toBe(true);
    expect(pointerAlreadyPresent(['a', 'b'])).toBe(false);
  });
});

const HAS_REGISTER = () => true;
const NO_REGISTER = () => false;

describe('createRegisterPointerHandler (v2 context hook)', () => {
  it('appends nothing when disabled', async () => {
    const event = contextEvent();
    await createRegisterPointerHandler(false, HAS_REGISTER)(event);
    expect(event.system).toHaveLength(1);
  });

  it('appends the pointer when enabled and the register exists', async () => {
    const event = contextEvent();
    await createRegisterPointerHandler(true, HAS_REGISTER)(event);
    expect(event.system).toHaveLength(2);
    expect(event.system[1].text).toBe(REGISTER_POINTER);
  });

  it('appends nothing when no register exists, even when enabled', async () => {
    // The reminder asserts that the project keeps a register. Telling a
    // register-less project that it has one makes an obedient agent create one.
    const event = contextEvent();
    await createRegisterPointerHandler(true, NO_REGISTER)(event);
    expect(event.system).toHaveLength(1);
  });

  it('appends nothing when the existence check throws', async () => {
    const event = contextEvent();
    const handler = createRegisterPointerHandler(true, () => {
      throw new Error('config unreadable');
    });
    await expect(handler(event)).resolves.toBeUndefined();
    expect(event.system).toHaveLength(1);
  });

  it('reports activation once per session', async () => {
    const seen: string[] = [];
    const event = contextEvent();
    const handler = createRegisterPointerHandler(true, HAS_REGISTER, (id) => seen.push(id));
    await handler(event);
    await handler(event);
    expect(seen).toEqual(['s1']);
  });

  it('never lets the log callback break the hook', async () => {
    const event = contextEvent();
    const handler = createRegisterPointerHandler(true, HAS_REGISTER, () => {
      throw new Error('disk full');
    });
    await expect(handler(event)).resolves.toBeUndefined();
    expect(event.system).toHaveLength(2);
  });

  it('is idempotent across repeated calls', async () => {
    const event = contextEvent();
    const handler = createRegisterPointerHandler(true, HAS_REGISTER);
    await handler(event);
    await handler(event);
    await handler(event);
    expect(event.system).toHaveLength(2);
  });

  it('never throws on a malformed event', async () => {
    const handler = createRegisterPointerHandler(true, HAS_REGISTER);
    await expect(handler(undefined)).resolves.toBeUndefined();
    await expect(handler({ sessionID: 's1' })).resolves.toBeUndefined();
  });
});

describe('registerExists', () => {
  it('is false for a directory without a register', () => {
    expect(registerExists(fs.mkdtempSync(path.join(os.tmpdir(), 'dl-no-reg-')))).toBe(false);
  });

  it('is true once a register file is present', () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'dl-reg-'));
    fs.mkdirSync(path.join(dir, '.decisions'), { recursive: true });
    fs.writeFileSync(path.join(dir, '.decisions', 'register.yaml'), '', 'utf-8');
    expect(registerExists(dir)).toBe(true);
  });
});

describe('appendActivationLog', () => {
  it('writes inside the register directory and only there', () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'dl-log-'));
    fs.mkdirSync(path.join(dir, '.decisions'), { recursive: true });
    fs.writeFileSync(path.join(dir, '.decisions', 'register.yaml'), '', 'utf-8');

    appendActivationLog(dir, 'pointer injected session=s1');
    appendActivationLog(dir, 'pointer injected session=s2');

    const log = fs.readFileSync(path.join(dir, '.decisions', 'activation.log'), 'utf-8');
    expect(log.trim().split('\n')).toHaveLength(2);
    expect(log).toContain('session=s1');
  });

  it('writes nothing when there is no register', () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'dl-nolog-'));
    appendActivationLog(dir, 'should not appear');
    expect(fs.existsSync(path.join(dir, '.decisions', 'activation.log'))).toBe(false);
  });
});

describe('createSystemTransformHook (v1)', () => {
  it('never throws when the output shape is wrong', async () => {
    const hook = createSystemTransformHook();
    await expect(hook({}, {} as { system: string[] })).resolves.toBeUndefined();
  });
});

describe('tool descriptions', () => {
  it('carry no embedded discipline after the revert', () => {
    const tools = createDecisionTools();
    const all = Object.values(tools)
      .map((tool) => tool.description)
      .join('\n');
    for (const phrase of [
      'OWNER ACT',
      'do not leave them in prose',
      'Run after every write',
      'history stays append-only',
      'disposable markdown',
      'Run once per repo',
    ]) {
      expect(all).not.toContain(phrase);
    }
  });

  it('still names the tools, including decision-close', () => {
    const keys = Object.keys(createDecisionTools());
    expect(keys).toHaveLength(11);
    expect(keys).toContain('decision-close');
  });
});
