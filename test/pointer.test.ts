import { describe, expect, it } from 'bun:test';
import { createSystemTransformHook } from '../src/hooks/register-pointer.js';
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
  it('names the register and the two tools that matter', () => {
    expect(REGISTER_POINTER).toContain('decision-list');
    expect(REGISTER_POINTER).toContain('decision-add');
  });

  it('states the two owner-only rules', () => {
    expect(REGISTER_POINTER).toContain('Never edit the register file by hand');
    expect(REGISTER_POINTER).toContain('unless the user explicitly asks');
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

describe('createRegisterPointerHandler (v2 context hook)', () => {
  it('appends nothing when disabled', async () => {
    const event = contextEvent();
    await createRegisterPointerHandler(false)(event);
    expect(event.system).toHaveLength(1);
  });

  it('appends the pointer when enabled', async () => {
    const event = contextEvent();
    await createRegisterPointerHandler(true)(event);
    expect(event.system).toHaveLength(2);
    expect(event.system[1].text).toBe(REGISTER_POINTER);
  });

  it('is idempotent across repeated calls', async () => {
    const event = contextEvent();
    const handler = createRegisterPointerHandler(true);
    await handler(event);
    await handler(event);
    await handler(event);
    expect(event.system).toHaveLength(2);
  });

  it('never throws on a malformed event', async () => {
    const handler = createRegisterPointerHandler(true);
    await expect(handler(undefined)).resolves.toBeUndefined();
    await expect(handler({ sessionID: 's1' })).resolves.toBeUndefined();
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

  it('still names the nine tools', () => {
    expect(Object.keys(createDecisionTools())).toHaveLength(9);
  });
});
