import { isEnabled } from '../config.js';
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
    _input: { sessionID?: string; model?: unknown },
    output: { system: string[] },
  ): Promise<void> => {
    try {
      if (!isEnabled(process.cwd())) return;
      if (!Array.isArray(output?.system)) return;
      if (pointerAlreadyPresent(output.system)) return;
      output.system.push(REGISTER_POINTER);
    } catch {
      // Never break the host on injection failure.
    }
  };
}
