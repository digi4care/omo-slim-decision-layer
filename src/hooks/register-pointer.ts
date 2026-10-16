import { loadConfig } from '../config.js';
import { appendActivationLog, registerExists } from '../log.js';
import { pointerAlreadyPresent, REGISTER_POINTER } from '../prompts/register-pointer.js';

/**
 * v1 equivalent of the v2 `session.hook('context')` injection.
 *
 * On v1 the plugin factory runs before any session exists, so the project
 * directory is not known here. The session cwd is the best available proxy and
 * is what OpenCode itself treats as the project root for path resolution.
 */
export function createSystemTransformHook() {
  return async (
    input: { sessionID?: string; model?: unknown },
    output: { system: string[] },
  ): Promise<void> => {
    try {
      const cwd = process.cwd();
      const config = loadConfig(cwd);
      if (!config.enabled) return;
      // Only speak when the register actually exists — see the note in
      // createRegisterPointerHandler for why this guard matters.
      if (!registerExists(cwd)) return;
      if (!Array.isArray(output?.system)) return;
      if (pointerAlreadyPresent(output.system)) return;
      output.system.push(REGISTER_POINTER);
      if (config.log) {
        appendActivationLog(cwd, `pointer injected session=${input.sessionID ?? 'unknown'}`);
      }
    } catch {
      // Never break the host on injection failure.
    }
  };
}
