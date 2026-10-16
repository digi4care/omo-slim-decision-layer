import type { Hooks, Plugin } from '@opencode-ai/plugin';
import { createInterviewInjectHook } from './hooks/interview-inject';
import { createSystemTransformHook } from './hooks/register-pointer';
import { createDecisionTools } from './tools/index';
import { INTERVIEW_PROMOTION_SYMBOL, promoteInterview } from './tools/interview-promotion.js';
import { createV2Setup } from './v2/setup';

const DecisionLayer: Plugin = async () => {
  const hooks: Hooks = {
    'command.execute.before': createInterviewInjectHook(),
    'experimental.chat.system.transform': createSystemTransformHook(),
    tool: createDecisionTools(),
  };
  (globalThis as Record<PropertyKey, unknown>)[INTERVIEW_PROMOTION_SYMBOL] = {
    promote: promoteInterview,
  };
  return hooks;
};

const pluginModule = {
  id: 'omo-slim-decision-layer',
  server: DecisionLayer,
  setup: createV2Setup(),
};

export default pluginModule;
