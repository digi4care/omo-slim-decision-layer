import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { z } from 'zod';

export const ConfigSchema = z.object({
  enabled: z.boolean().default(false),
  registerPath: z.string().default('.decisions/register.yaml'),
  /** Append one line per session to `.decisions/activation.log`. Dev only. */
  log: z.boolean().default(false),
});

export type DecisionLayerConfig = z.infer<typeof ConfigSchema>;

const DEFAULT_REGISTER_PATH = '.decisions/register.yaml';
const CONFIG_KEY = 'decision-layer';

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

/**
 * Strip comments and trailing commas so `JSON.parse` can read a .jsonc file.
 * Conservative: only touches characters outside string literals.
 */
function stripJsonComments(input: string): string {
  let out = '';
  let inString = false;
  let escaped = false;
  for (let i = 0; i < input.length; i++) {
    const char = input[i];
    if (inString) {
      out += char;
      if (escaped) escaped = false;
      else if (char === '\\') escaped = true;
      else if (char === '"') inString = false;
      continue;
    }
    if (char === '"') {
      inString = true;
      out += char;
      continue;
    }
    if (char === '/' && input[i + 1] === '/') {
      while (i < input.length && input[i] !== '\n') i++;
      out += '\n';
      continue;
    }
    if (char === '/' && input[i + 1] === '*') {
      i += 2;
      while (i < input.length && !(input[i] === '*' && input[i + 1] === '/')) i++;
      i++;
      continue;
    }
    out += char;
  }
  return out.replace(/,(\s*[}\]])/g, '$1');
}

function parseConfigText(text: string): unknown {
  const trimmed = text.trim();
  if (!trimmed) return undefined;
  try {
    const bun = (globalThis as { Bun?: { JSONC?: { parse(input: string): unknown } } }).Bun;
    if (bun?.JSONC) return bun.JSONC.parse(trimmed);
  } catch {
    // fall through to the JSON.parse path
  }
  try {
    return JSON.parse(stripJsonComments(trimmed));
  } catch {
    return undefined;
  }
}

/**
 * Read a config file.
 *
 * A missing file yields undefined silently. A file that EXISTS but cannot be
 * read or parsed logs a warning — this plugin defaults to disabled, and silent
 * failure is the worst possible answer for a flag whose only symptom is that
 * nothing happens.
 */
function readConfigFile(filePath: string): unknown {
  if (!fs.existsSync(filePath)) return undefined;
  let text: string;
  try {
    text = fs.readFileSync(filePath, 'utf-8');
  } catch {
    console.warn(`[decision-layer] cannot read config at ${filePath}`);
    return undefined;
  }
  const parsed = parseConfigText(text);
  if (parsed === undefined) {
    console.warn(
      `[decision-layer] ignoring malformed config at ${filePath}: ` +
        `the "decision-layer" block is not valid JSONC`,
    );
  }
  return parsed;
}

export interface DecisionLayerRawConfig {
  enabled?: boolean;
  registerPath?: string;
  log?: boolean;
}

function defaultGlobalConfigPath(): string {
  // OPENCODE_CONFIG overrides the config root, either as a directory or as an
  // explicit config file. Matches how other omo-slim plugins resolve it.
  const override = process.env.OPENCODE_CONFIG;
  if (override && override !== '') {
    if (/\.jsonc?$/.test(override)) return override;
    return path.join(override, 'opencode.jsonc');
  }
  const xdg = process.env.XDG_CONFIG_HOME;
  const base = xdg && xdg !== '' ? xdg : path.join(os.homedir(), '.config');
  return path.join(base, 'opencode', 'opencode.jsonc');
}

/**
 * Collect the raw config from every source, lowest precedence first.
 *
 * Precedence per KEY, not per file: a project file that only sets `registerPath`
 * must not erase an `enabled` that came from the global config.
 *
 * Scope per KEY: `registerPath` is a property of the repository and is therefore
 * never read from the global config. `enabled` is a property of the user and may
 * come from either level.
 */
function collectRawConfig(projectRoot: string, globalConfigPath: string): DecisionLayerRawConfig {
  const merged: DecisionLayerRawConfig = {};

  const apply = (source: unknown, scope: 'project' | 'global'): void => {
    if (!isRecord(source)) return;
    if (typeof source.enabled === 'boolean') merged.enabled = source.enabled;
    // `log` is a debugging aid, not a project property: like `enabled` it may
    // come from either level, so you can switch it on globally while chasing
    // a problem without touching every repository.
    if (typeof source.log === 'boolean') merged.log = source.log;
    if (
      scope === 'project' &&
      typeof source.registerPath === 'string' &&
      source.registerPath !== ''
    ) {
      merged.registerPath = source.registerPath;
    }
  };

  // 3. deprecated project-local file (lowest)
  apply(readConfigFile(path.resolve(projectRoot, '.opencode', 'decision-layer.json')), 'project');

  // 2. global opencode config: only `enabled` travels between projects
  const globalRaw = readConfigFile(globalConfigPath);
  apply(isRecord(globalRaw) ? globalRaw[CONFIG_KEY] : undefined, 'global');

  // 1. project opencode config (highest)
  const projectRaw = readConfigFile(path.resolve(projectRoot, 'opencode.jsonc'));
  if (isRecord(projectRaw)) apply(projectRaw[CONFIG_KEY], 'project');
  const projectJson = readConfigFile(path.resolve(projectRoot, 'opencode.json'));
  if (isRecord(projectJson)) apply(projectJson[CONFIG_KEY], 'project');

  return merged;
}

export function loadConfig(
  worktree: string,
  globalConfigPath: string = defaultGlobalConfigPath(),
): DecisionLayerConfig {
  const raw = collectRawConfig(worktree, globalConfigPath);
  return ConfigSchema.parse({
    enabled: raw.enabled ?? false,
    registerPath: raw.registerPath ?? DEFAULT_REGISTER_PATH,
    log: raw.log ?? false,
  });
}

const configCache = new Map<string, { value: DecisionLayerConfig; expiresAt: number }>();
const CONFIG_TTL_MS = 15_000;

/**
 * Memoised full-config read for callers that need more than `enabled`
 * (every `decision-*` tool resolves the register path on each call).
 *
 * Config files rarely change mid-session, but the four files can land on NFS.
 * The TTL lets a flag flip take effect without restarting OpenCode.
 */
export function cachedConfig(
  worktree: string,
  globalConfigPath: string = defaultGlobalConfigPath(),
): DecisionLayerConfig {
  const cacheKey = `${globalConfigPath}::${worktree}`;
  const cached = configCache.get(cacheKey);
  if (cached && cached.expiresAt > Date.now()) return cached.value;
  const value = loadConfig(worktree, globalConfigPath);
  configCache.set(cacheKey, { value, expiresAt: Date.now() + CONFIG_TTL_MS });
  return value;
}

/**
 * Memoised read of `enabled` for hot paths (per-request hooks and per tool call).
 */
export function isEnabled(worktree: string, globalConfigPath?: string): boolean {
  try {
    return cachedConfig(worktree, globalConfigPath).enabled;
  } catch {
    return false;
  }
}
