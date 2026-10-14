import type { Hooks } from '@opencode-ai/plugin';
import type { Part } from '@opencode-ai/sdk';
import { DECISION_DISCIPLINE_PROMPT } from '../prompts/decision-discipline.js';

const SENTINEL = '<!-- decision-layer:inject v1 -->';

function isTextPart(part: Part): part is Extract<Part, { type: 'text' }> {
  return part.type === 'text';
}

export function createInterviewInjectHook(): NonNullable<Hooks['command.execute.before']> {
  return async (input, output) => {
    try {
      if (input.command !== 'interview') {
        return;
      }

      const parts = output.parts;
      if (!Array.isArray(parts)) {
        return;
      }

      const alreadyInjected = parts.some(
        (part) => isTextPart(part) && part.text.includes(SENTINEL),
      );
      if (alreadyInjected) {
        return;
      }

      const injected: Part = {
        id: `decision-layer-inject-${input.sessionID}`,
        sessionID: input.sessionID,
        messageID: '',
        type: 'text',
        text: `${SENTINEL}\n${DECISION_DISCIPLINE_PROMPT}`,
        synthetic: true,
      };

      parts.push(injected);
    } catch (error) {
      console.warn('[decision-layer] interview inject failed:', error);
    }
  };
}
