import type { Hooks } from '@opencode-ai/plugin';
import type { Part } from '@opencode-ai/sdk';
import { isEnabled } from '../config.js';
import { DECISION_DISCIPLINE_PROMPT } from '../prompts/decision-discipline.js';

const SENTINEL = '<!-- decision-layer:inject v1 -->';

function isTextPart(part: Part): part is Extract<Part, { type: 'text' }> {
  return part.type === 'text';
}

/**
 * The v1 factory runs before a session exists, so the project directory is not
 * known here; the session cwd is the available proxy. The predicate is
 * injectable so tests do not depend on the developer's own config.
 */
export function createInterviewInjectHook(
  enabled: () => boolean = () => isEnabled(process.cwd()),
): NonNullable<Hooks['command.execute.before']> {
  return async (input, output) => {
    try {
      if (input.command !== 'interview') {
        return;
      }
      // Only consult config once we know we will actually use it: this hook
      // runs for every slash command, not just /interview.
      if (!enabled()) return;

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
