import fs from 'node:fs';
import {
  INTERVIEW_PROMOTION_SYMBOL,
  type PromotionInput,
  type PromotionResult,
  promoteInterview,
} from './interview-promotion.js';

interface BridgeRegistry {
  readonly kind: 'decision-layer-interview-bridge';
  roots: Set<string>;
  promote(input: PromotionInput): Promise<PromotionResult>;
}
const rejected = (): PromotionResult => ({
  status: 'needs-review',
  reusedIDs: [],
  addedIDs: [],
  openQuestions: ['Project root is not a registered loaded project'],
});

function canonicalRoot(candidate: unknown): string | undefined {
  if (typeof candidate !== 'string' || !candidate.trim()) return undefined;
  try {
    const root = fs.realpathSync(candidate);
    return root !== '/' && fs.statSync(root).isDirectory() ? root : undefined;
  } catch {
    return undefined;
  }
}

export function registerInterviewProjectRoot(root: string): void {
  const canonical = canonicalRoot(root);
  if (!canonical) throw new Error('Cannot register an invalid project root');
  const globals = globalThis as Record<PropertyKey, unknown>;
  let registry = globals[INTERVIEW_PROMOTION_SYMBOL] as BridgeRegistry | undefined;
  if (registry?.kind !== 'decision-layer-interview-bridge' || !(registry.roots instanceof Set)) {
    registry = {
      kind: 'decision-layer-interview-bridge',
      roots: new Set<string>(),
      promote(input: PromotionInput): Promise<PromotionResult> {
        const active = (globalThis as Record<PropertyKey, unknown>)[INTERVIEW_PROMOTION_SYMBOL] as
          | BridgeRegistry
          | undefined;
        const requested = canonicalRoot(input.projectRoot);
        if (
          !requested ||
          active?.kind !== 'decision-layer-interview-bridge' ||
          !active.roots.has(requested)
        ) {
          return Promise.resolve(rejected());
        }
        return promoteInterview({ ...input, projectRoot: requested });
      },
    };
    globals[INTERVIEW_PROMOTION_SYMBOL] = registry;
  }
  registry.roots.add(canonical);
}
