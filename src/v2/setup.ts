import { z } from 'zod';
import { DECISION_DISCIPLINE_PROMPT } from '../prompts/decision-discipline.js';
import { loadDecisionSkill } from '../skills/register.js';
import { createDecisionTools } from '../tools/index.js';

/**
 * v2 registration path, next to the v1 `server` export.
 *
 * Differences that matter for v2 (verified against @opencode/plugin 2.0.29):
 * - tools are registered via `ctx.tool.transform` with a full input schema
 *   (zod object) instead of a raw args shape;
 * - the tool context has no `worktree`/`directory`, so the project root is
 *   captured from `ctx.location.directory` at setup time and closed over;
 * - the interview injection uses `ctx.session.hook('prompt')` and mutates the
 *   outgoing prompt instead of appending to `command.execute.before` parts.
 */

interface V2TransformEditor {
  add: (tool: unknown) => void;
}

export interface V2Context {
  location: { directory: string };
  tool: {
    transform: (callback: (editor: V2TransformEditor) => void) => Promise<unknown>;
  };
  skill?: {
    transform: (callback: (editor: { add: (info: unknown) => void }) => void) => Promise<unknown>;
  };
  session: {
    hook: (name: string, callback: (event: unknown) => Promise<void> | void) => Promise<unknown>;
  };
}

const INTERVIEW_MARKER =
  'You are running an interview q&a session for the user inside their repository';
const SENTINEL = '<!-- decision-layer:inject v1 -->';

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

export function createV2Setup() {
  return async (ctx: V2Context): Promise<void> => {
    const projectDir = ctx.location.directory;
    const tools = createDecisionTools() as unknown as Record<
      string,
      {
        description: string;
        args: z.ZodRawShape;
        execute: (args: never, ctx: never) => Promise<string>;
      }
    >;

    await ctx.tool.transform((editor) => {
      for (const [name, definition] of Object.entries(tools)) {
        editor.add({
          name,
          description: definition.description,
          input: z.object(definition.args as z.ZodRawShape),
          execute: async (input: unknown, toolContext: unknown) => {
            // v2 has no worktree/directory on the tool context, so close over
            // the setup-time project directory instead.
            const v1Context = {
              ...(isRecord(toolContext) ? toolContext : {}),
              worktree: projectDir,
              directory: projectDir,
            };
            const result = await definition.execute(input as never, v1Context as never);
            return { content: result };
          },
        });
      }
    });

    try {
      if (typeof ctx.skill?.transform === 'function') {
        const skill = loadDecisionSkill();
        if (skill) {
          await ctx.skill.transform((editor) => {
            editor.add(skill);
          });
        }
      }
    } catch (error) {
      console.warn('[decision-layer] skill registration failed:', error);
    }

    await ctx.session.hook('prompt', async (event: unknown) => {
      try {
        if (!isRecord(event)) return;
        const prompt = event.prompt;
        if (!isRecord(prompt) || typeof prompt.text !== 'string') return;
        if (!prompt.text.includes(INTERVIEW_MARKER)) return;
        if (prompt.text.includes(SENTINEL)) return;
        prompt.text = `${prompt.text}\n\n${SENTINEL}\n${DECISION_DISCIPLINE_PROMPT}`;
      } catch {
        // Never break the host command on injection failure.
      }
    });
  };
}
