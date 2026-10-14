import { describe, expect, it } from 'bun:test';
import type { Part } from '@opencode-ai/sdk';
import { createInterviewInjectHook } from '../src/hooks/interview-inject.js';
import { DECISION_DISCIPLINE_PROMPT } from '../src/prompts/decision-discipline.js';

const interviewInput = { command: 'interview', sessionID: 's1', arguments: '' };
const otherInput = { command: 'implement', sessionID: 's1', arguments: '' };

function makeTextPart(text: string): Part {
  return {
    id: 'base',
    sessionID: 's1',
    messageID: 'm1',
    type: 'text',
    text,
  };
}

describe('createInterviewInjectHook', () => {
  it('leaves non-interview commands untouched', async () => {
    const hook = createInterviewInjectHook();
    const output = { parts: [makeTextPart('base output')] };

    await hook(otherInput, output);

    expect(output.parts).toHaveLength(1);
    expect((output.parts[0] as Extract<Part, { type: 'text' }>).text).toBe('base output');
  });

  it('appends exactly one prompt part for interview', async () => {
    const hook = createInterviewInjectHook();
    const output = { parts: [makeTextPart('base output')] };

    await hook(interviewInput, output);

    expect(output.parts).toHaveLength(2);
    const injected = output.parts[1];
    expect(injected.type).toBe('text');
    const text = (injected as Extract<Part, { type: 'text' }>).text;
    expect(text).toContain('<!-- decision-layer:inject v1 -->');
    expect(text).toContain('schema/register.schema.json');
    expect(text).toContain('decision-validate');
    expect(text).toContain('.decisions/register.yaml');
  });

  it('is idempotent across repeated calls', async () => {
    const hook = createInterviewInjectHook();
    const output = { parts: [] as Part[] };

    await hook(interviewInput, output);
    await hook(interviewInput, output);

    expect(output.parts).toHaveLength(1);
  });

  it('does not throw when output.parts is malformed', async () => {
    const hook = createInterviewInjectHook();
    const output = { parts: undefined } as unknown as { parts: Part[] };

    await expect(hook(interviewInput, output)).resolves.toBeUndefined();
    expect((output as unknown as { parts: undefined }).parts).toBeUndefined();
  });
});

describe('DECISION_DISCIPLINE_PROMPT', () => {
  it('references the schema file and validate command', () => {
    expect(DECISION_DISCIPLINE_PROMPT).toContain('schema/register.schema.json');
    expect(DECISION_DISCIPLINE_PROMPT).toContain('decision-validate');
  });

  it('does not inline the full record type vocabulary', () => {
    const codes = ['REQ', 'CONSTRAINT', 'ASSUMPTION', 'DEC'];
    const present = codes.filter((code) => DECISION_DISCIPLINE_PROMPT.includes(code));
    expect(present.length).toBeLessThan(codes.length);
  });
});
