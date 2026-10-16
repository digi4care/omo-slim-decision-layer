import type { Hooks, Plugin } from '@opencode-ai/plugin';
import { loadConfig } from './config.js';
import { createDelegationBeadsHook } from './hooks/delegation-beads';
import { createInterviewInjectHook } from './hooks/interview-inject';
import { createSystemTransformHook } from './hooks/register-pointer';
import { createDecisionTools } from './tools/index';
import { registerInterviewProjectRoot } from './tools/interview-bridge.js';
import { resolveProjectRoot } from './tools/paths.js';
import { createV2Setup } from './v2/setup';

const DecisionLayer: Plugin = async (ctx) => {
  const hooks: Hooks = {
    'command.execute.before': createInterviewInjectHook(),
    'experimental.chat.system.transform': createSystemTransformHook(),
    tool: createDecisionTools(),
  };
  registerInterviewProjectRoot(
    resolveProjectRoot({ worktree: ctx.worktree, directory: ctx.directory }),
  );
  registerInterviewProjectRoot(ctx.directory);
  const root = resolveProjectRoot({ worktree: ctx.worktree, directory: ctx.directory });
  let config: ReturnType<typeof loadConfig> | undefined;
  try {
    config = loadConfig(root);
  } catch {
    // A malformed config resolves to the safe default-off behavior.
  }
  if (config?.enabled && config.requireBeadsForDelegation) {
    hooks['tool.execute.before'] = createDelegationBeadsHook(root);
  }
  return hooks;
};

const pluginModule = {
  id: 'omo-slim-decision-layer',
  server: DecisionLayer,
  setup: createV2Setup(),
};

export default pluginModule;
