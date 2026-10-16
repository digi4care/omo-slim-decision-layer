import { createHash } from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { load } from 'js-yaml';
import { loadConfig } from '../config.js';
import { type AddRecordInput, AddRecordInputSchema } from '../model/record.js';
import { addRecord, readRegister, validateRegisterFile } from '../register/register.js';
import { resolveRegisterPath } from './paths.js';

export const INTERVIEW_PROMOTION_SYMBOL = Symbol.for('omo-slim-decision-layer.interview.v1');
export interface PromotionInput {
  projectRoot: string;
  specPath: string;
  sessionID: string;
}
export interface PromotionResult {
  status: 'success' | 'needs-review' | 'failed';
  reusedIDs: string[];
  addedIDs: string[];
  openQuestions: string[];
  error?: string;
}
type Candidate = AddRecordInput & { key: string };
const locks = new Map<string, Promise<void>>();

function currentSpec(text: string): string {
  const match = /^## Current spec\s*$/im.exec(text);
  if (!match) return '';
  const start = match.index + match[0].length;
  const endMatch = /^## Q&A history\s*$/im.exec(text.slice(start));
  return text.slice(start, endMatch ? start + endMatch.index : undefined);
}

function sameDecisionContent(record: Record<string, unknown>, proposal: AddRecordInput): boolean {
  if (
    record.type !== proposal.type ||
    record.title !== proposal.title ||
    record.context !== proposal.context
  )
    return false;
  if (proposal.type === 'DEC') {
    return (
      record.decision === proposal.decision &&
      record.consequences === proposal.consequences &&
      JSON.stringify(record.alternatives_rejected ?? []) ===
        JSON.stringify(proposal.alternatives_rejected ?? [])
    );
  }
  if (proposal.type === 'ASSUMPTION') return record.needed_to_close === proposal.needed_to_close;
  return true;
}

export function parseInterviewProposals(text: string): Candidate[] {
  const section = currentSpec(text);
  const blocks = [...section.matchAll(/```decision-record-proposals\s*\n([\s\S]*?)\n```/g)];
  if (!blocks.length) return [];
  const candidates: Candidate[] = [];
  for (const block of blocks) {
    const raw: unknown = load(block[1]);
    if (!Array.isArray(raw)) throw new Error('Proposal block must contain a YAML array');
    for (const item of raw) {
      if (!item || typeof item !== 'object' || Array.isArray(item))
        throw new Error('Each proposal must be an object');
      const { key, ...proposal } = item as Record<string, unknown>;
      if (typeof key !== 'string' || !key.trim()) throw new Error('Proposal key is required');
      const parsed = AddRecordInputSchema.safeParse(proposal);
      if (!parsed.success) throw new Error(`Invalid proposal ${key}: ${parsed.error.message}`);
      if (
        !('context' in proposal) ||
        typeof proposal.context !== 'string' ||
        !proposal.context.trim()
      )
        throw new Error(`Proposal ${key} requires context`);
      candidates.push({ ...parsed.data, key });
    }
  }
  if (new Set(candidates.map((c) => c.key)).size !== candidates.length)
    throw new Error('Proposal keys must be unique');
  return candidates;
}

async function withLock<T>(key: string, fn: () => Promise<T>): Promise<T> {
  const previous = locks.get(key) ?? Promise.resolve();
  let release!: () => void;
  const current = new Promise<void>((resolve) => {
    release = resolve;
  });
  const queued = previous.then(() => current);
  locks.set(key, queued);
  await previous;
  try {
    return await fn();
  } finally {
    release();
    if (locks.get(key) === queued) locks.delete(key);
  }
}

export async function promoteInterview(input: PromotionInput): Promise<PromotionResult> {
  const result: PromotionResult = {
    status: 'failed',
    reusedIDs: [],
    addedIDs: [],
    openQuestions: [],
  };
  try {
    const root = fs.realpathSync(path.resolve(input.projectRoot));
    if (!loadConfig(root).enabled)
      return {
        ...result,
        status: 'needs-review',
        openQuestions: ['Decision layer is disabled for this project'],
      };
    const spec = path.resolve(root, input.specPath);
    if (spec !== root && !spec.startsWith(root + path.sep))
      throw new Error('Spec path escapes project root');
    const realSpec = fs.realpathSync(spec);
    if (!realSpec.startsWith(root + path.sep)) throw new Error('Spec symlink escapes project root');
    const text = fs.readFileSync(realSpec, 'utf8');
    const front = text.match(/^---\s*\n([\s\S]*?)\n---/);
    const metadata = front ? (load(front[1]) as Record<string, unknown>) : {};
    if (metadata?.status !== 'complete')
      return {
        ...result,
        status: 'needs-review',
        openQuestions: ['Interview spec status must be complete'],
      };
    const registerPath = resolveRegisterPath(root);
    if (!fs.existsSync(registerPath))
      return {
        ...result,
        status: 'needs-review',
        openQuestions: [`Register missing; run decision-init in ${root}`],
      };
    const realRegister = fs.realpathSync(registerPath);
    if (!realRegister.startsWith(root + path.sep))
      throw new Error('Configured register symlink escapes project root');
    const candidates = parseInterviewProposals(text);
    if (!candidates.length)
      return {
        ...result,
        status: 'needs-review',
        openQuestions: ['No explicit proposals found under ## Current spec'],
      };
    return await withLock(realRegister, async () => {
      for (const candidate of candidates) {
        const { key, ...proposal } = candidate;
        const hash = createHash('sha256').update(JSON.stringify(proposal)).digest('hex');
        const register = readRegister(realRegister);
        const prior = register.records.find(
          (r) => r.meta?.interview_source === realSpec && r.meta?.interview_candidate_key === key,
        );
        if (prior) {
          if (prior.meta?.interview_content_hash !== hash) {
            result.openQuestions.push(
              `Proposal ${key} changed since ${prior.id}; confirm whether to create a new proposal`,
            );
            result.status = 'needs-review';
            return result;
          }
          result.reusedIDs.push(prior.id);
          continue;
        }
        const sameTitle = register.records.filter(
          (record) => record.type === proposal.type && record.title === proposal.title,
        );
        if (sameTitle.length) {
          const matches = sameTitle.filter((record) =>
            sameDecisionContent(record as unknown as Record<string, unknown>, proposal),
          );
          if (sameTitle.length === 1 && matches.length === 1) {
            result.reusedIDs.push(sameTitle[0].id);
            continue;
          }
          result.openQuestions.push(
            `Existing ${proposal.type} record titled "${proposal.title}" conflicts with proposal ${key}; review matching records before retrying`,
          );
          result.status = 'needs-review';
          return result;
        }
        result.addedIDs.push(
          addRecord(realRegister, {
            ...proposal,
            meta: {
              ...(proposal.meta ?? {}),
              interview_source: realSpec,
              interview_session_id: input.sessionID,
              interview_candidate_key: key,
              interview_content_hash: hash,
            },
          } as AddRecordInput).id,
        );
      }
      validateRegisterFile(realRegister);
      result.status = 'success';
      return result;
    });
  } catch (error) {
    result.error = error instanceof Error ? error.message : String(error);
    result.openQuestions.push(result.error);
    return result;
  }
}
