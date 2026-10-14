import fs from 'node:fs';
import path from 'node:path';
import { z } from 'zod';

export const ConfigSchema = z.object({
  registerPath: z.string().default('.decisions/register.yaml'),
});

export type DecisionLayerConfig = z.infer<typeof ConfigSchema>;

export function loadConfig(worktree: string): DecisionLayerConfig {
  const configPath = path.resolve(worktree, '.opencode', 'decision-layer.json');
  if (!fs.existsSync(configPath)) {
    return ConfigSchema.parse({});
  }
  let raw: unknown;
  try {
    raw = JSON.parse(fs.readFileSync(configPath, 'utf-8'));
  } catch (err) {
    throw new Error(
      `Invalid config at ${configPath}: ${err instanceof Error ? err.message : String(err)}`,
    );
  }
  const result = ConfigSchema.safeParse(raw);
  if (!result.success) {
    throw new Error(`Invalid config at ${configPath}: ${result.error.message}`);
  }
  return result.data;
}
