import fs from 'node:fs';

const DELEGATION_TOOLS = new Set(['task', 'subagent']);

export function createDelegationBeadsHook(projectRoot: string) {
  return async (event: unknown): Promise<void> => {
    if (!event || typeof event !== 'object') return;
    const record = event as Record<string, unknown>;
    if (typeof record.tool !== 'string' || !DELEGATION_TOOLS.has(record.tool.toLowerCase())) return;
    if (
      fs.existsSync(`${projectRoot}/.beads`) &&
      fs.statSync(`${projectRoot}/.beads`).isDirectory()
    )
      return;
    throw new Error('[decision-layer] delegation requires a .beads/ directory in this project');
  };
}
