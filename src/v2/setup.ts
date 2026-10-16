import fs from 'node:fs';
import { z } from 'zod';
import { loadConfig } from '../config.js';
import { createDelegationBeadsHook } from '../hooks/delegation-beads.js';
import { appendActivationLog, registerExists } from '../log.js';
import { DECISION_DISCIPLINE_PROMPT } from '../prompts/decision-discipline.js';
import { pointerAlreadyPresent, REGISTER_POINTER } from '../prompts/register-pointer.js';
import { loadDecisionSkill } from '../skills/register.js';
import { createDecisionTools } from '../tools/index.js';
import { registerInterviewProjectRoot } from '../tools/interview-bridge.js';

/**
 * v2 registration path, next to the v1 `server` export.
 *
 * Differences that matter for v2 (verified against @opencode/plugin 2.0.29):
 * - tools are registered via `ctx.tool.transform` with a full input schema
 *   (zod object) instead of a raw args shape;
 * - the tool context has no `worktree`/`directory`, so the project root is
 *   captured from `ctx.location.project.directory` (falling back to
 *   `ctx.location.directory`) at setup time and closed over;
 * - the interview injection uses `ctx.session.hook('prompt')` and mutates the
 *   outgoing prompt instead of appending to `command.execute.before` parts.
 */

interface V2TransformEditor {
  add: (tool: unknown) => void;
}

export interface V2Context {
  location: { directory: string; project?: { directory?: string } };
  tool: {
    transform: (callback: (editor: V2TransformEditor) => void) => Promise<unknown>;
    hook?: (name: string, callback: (event: unknown) => Promise<void> | void) => Promise<unknown>;
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

export interface V2SessionContextEvent {
  sessionID: string;
  system: Array<{ type: 'text'; text: string }>;
}

/**
 * Append the always-available reminder to the system prompt.
 *
 * The event's `system` array is the v2 equivalent of v1's
 * `experimental.chat.system.transform` output. Only the trailing state is
 * touched; the reminder is a fixed string, so the bytes never change and the
 * provider prompt cache stays intact.
 *
 * The reminder says "this project keeps a decision register", so it must only
 * fire when that is actually true. Without the existence check a project
 * without a register is told it has one, and an obedient agent responds by
 * creating one — nine records appeared in a project nobody asked to track.
 */
export function createRegisterPointerHandler(
  enabled: boolean,
  registerExists: () => boolean = () => false,
  onActivate?: (sessionID: string) => void,
) {
  return async (event: unknown): Promise<void> => {
    try {
      if (!enabled) return;
      if (!isRecord(event)) return;
      if (!registerExists()) return;
      const system = (event as unknown as V2SessionContextEvent).system;
      if (!Array.isArray(system)) return;
      if (pointerAlreadyPresent(system.map((s) => s?.text ?? ''))) return;
      system.push({ type: 'text', text: REGISTER_POINTER });
      const sessionID = (event as unknown as V2SessionContextEvent).sessionID;
      try {
        onActivate?.(sessionID);
      } catch {
        // Logging must never break the hook.
      }
    } catch {
      // Never break the host on injection failure.
    }
  };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

export function createV2Setup() {
  return async (ctx: V2Context): Promise<void> => {
    const projectDir = resolveV2ProjectRoot(ctx.location);
    registerInterviewProjectRoot(projectDir);
    let enabled = false;
    let shouldLog = false;
    let requireBeadsForDelegation = false;
    try {
      const config = loadConfig(projectDir);
      enabled = config.enabled;
      shouldLog = config.log;
      requireBeadsForDelegation = config.requireBeadsForDelegation;
    } catch {
      // A broken config must never stop the tools from loading.
    }
    if (enabled && requireBeadsForDelegation) {
      if (typeof ctx.tool.hook !== 'function') {
        throw new Error(
          '[decision-layer] requireBeadsForDelegation is enabled but tool hooks are unavailable',
        );
      }
      await ctx.tool.hook('execute.before', createDelegationBeadsHook(projectDir));
    }
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
      if (enabled && typeof ctx.skill?.transform === 'function') {
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

    await ctx.session.hook(
      'context',
      createRegisterPointerHandler(
        enabled,
        () => registerExists(projectDir),
        (sessionID) => {
          if (!shouldLog) return;
          appendActivationLog(projectDir, `pointer injected session=${sessionID}`);
        },
      ),
    );

    await ctx.session.hook('prompt', async (event: unknown) => {
      try {
        if (!enabled) return;
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

function canonicalProjectRoot(candidate: unknown): string | undefined {
  if (typeof candidate !== 'string' || !candidate.trim()) return undefined;
  try {
    const resolved = fs.realpathSync(candidate);
    if (resolved === '/' || !fs.statSync(resolved).isDirectory()) return undefined;
    return resolved;
  } catch {
    return undefined;
  }
}

function resolveV2ProjectRoot(location: V2Context['location']): string {
  const root =
    canonicalProjectRoot(location.project?.directory) ?? canonicalProjectRoot(location.directory);
  if (!root) throw new Error('Cannot resolve a valid v2 project root');
  return root;
}
