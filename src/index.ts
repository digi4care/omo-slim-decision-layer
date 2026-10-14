import type { Hooks, Plugin, PluginModule } from '@opencode-ai/plugin';
import { createInterviewInjectHook } from './hooks/interview-inject';
import { createDecisionTools } from './tools/index';

const DecisionLayer: Plugin = async () => {
  const hooks: Hooks = {
    'command.execute.before': createInterviewInjectHook(),
    tool: createDecisionTools(),
  };
  return hooks;
};

export default {
  id: 'decision-layer',
  server: DecisionLayer,
} satisfies PluginModule;
