import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { load } from 'js-yaml';

export const DECISION_SKILL_ID = 'decision-layer';

export interface SkillInfo {
  id: string;
  name: string;
  description?: string;
  path: string;
  content: string;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

export function parseFrontmatter(raw: string): { data: Record<string, unknown>; body: string } {
  const match = raw.match(/^---\n([\s\S]*?)\n---\n/);
  if (!match) {
    return { data: {}, body: raw };
  }

  try {
    const parsed = load(match[1]);
    if (!isRecord(parsed)) {
      return { data: {}, body: raw };
    }
    return { data: parsed, body: raw.slice(match[0].length) };
  } catch {
    return { data: {}, body: raw };
  }
}

export function loadDecisionSkill(filePath?: string, baseDir?: string): SkillInfo | undefined {
  let resolvedPath: string;

  if (filePath) {
    resolvedPath = resolve(filePath);
  } else {
    const moduleDir = baseDir ?? fileURLToPath(new URL('.', import.meta.url));
    const candidates = [
      resolve(moduleDir, '../skills/decision-layer/SKILL.md'),
      resolve(moduleDir, '../../skills/decision-layer/SKILL.md'),
    ];

    const found = candidates.find((candidate) => existsSync(candidate));
    if (!found) {
      return undefined;
    }
    resolvedPath = found;
  }

  let raw: string;
  try {
    raw = readFileSync(resolvedPath, 'utf-8');
  } catch {
    return undefined;
  }

  if (raw.trim().length === 0) {
    return undefined;
  }

  const { data } = parseFrontmatter(raw);

  return {
    id: DECISION_SKILL_ID,
    name: typeof data.name === 'string' ? data.name : DECISION_SKILL_ID,
    description: typeof data.description === 'string' ? data.description : undefined,
    path: resolvedPath,
    content: raw,
  };
}
