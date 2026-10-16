import fs from 'node:fs';
import path from 'node:path';
import { resolveRegisterPath } from './tools/paths.js';

/** Does this project actually have a register on disk? */
export function registerExists(projectRoot: string): boolean {
  try {
    return fs.existsSync(resolveRegisterPath(projectRoot));
  } catch {
    return false;
  }
}

/**
 * Append one line to the per-project activation log. The log lives inside the
 * register directory, so it only ever appears where a register already exists.
 */
export function appendActivationLog(projectRoot: string, line: string): void {
  try {
    const registerPath = resolveRegisterPath(projectRoot);
    const logDir = path.dirname(registerPath);
    const logPath = path.join(logDir, 'activation.log');
    const stamp = new Date().toISOString();
    fs.appendFileSync(logPath, `${stamp} ${line}\n`, 'utf-8');
  } catch {
    // Logging must never break the plugin.
  }
}
