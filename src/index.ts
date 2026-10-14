import type { Hooks, Plugin } from '@opencode-ai/plugin';
import { createInterviewInjectHook } from './hooks/interview-inject';
import { createDecisionTools } from './tools/index';
import { createV2Setup } from './v2/setup';

const DecisionLayer: Plugin = async () => {
  const hooks: Hooks = {
    'command.execute.before': createInterviewInjectHook(),
    tool: createDecisionTools(),
  };
  return hooks;
};

const pluginModule = {
  id: 'omo-slim-decision-layer',
  server: DecisionLayer,
  setup: createV2Setup(),
};

export default pluginModule;
