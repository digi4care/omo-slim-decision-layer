import fs from 'node:fs';
import path from 'node:path';
import { dump, load } from 'js-yaml';
import { z } from 'zod';
import {
  type AddRecordInput,
  type DecisionRecord,
  RecordSchema,
  type RecordStatus,
  type RecordType,
  sortRecords,
} from '../model/record.js';

export interface Workspace {
  id: string;
  title: string;
  owner: string;
  change_authority: string;
}

export interface Register {
  schema_version: '1.0';
  workspace: Workspace;
  records: DecisionRecord[];
}

export const WorkspaceSchema = z.object({
  id: z.string().min(1, 'Workspace id is required'),
  title: z.string().min(1, 'Workspace title is required'),
  owner: z.string().min(1, 'Workspace owner is required'),
  change_authority: z.string().min(1, 'Workspace change_authority is required'),
});

export const RegisterSchema = z.object({
  schema_version: z.literal('1.0'),
  workspace: WorkspaceSchema,
  records: z.array(RecordSchema),
});

const allowedTransitions: Partial<Record<RecordStatus, RecordStatus[]>> = {
  proposed: ['accepted', 'rejected', 'superseded'],
};

const RegisterKeyOrder: Record<string, number> = {
  schema_version: 0,
  workspace: 1,
  records: 2,
};

const WorkspaceKeyOrder: Record<string, number> = {
  id: 0,
  title: 1,
  owner: 2,
  change_authority: 3,
};

const RecordKeyOrder: Record<string, number> = {
  schema_version: 0,
  id: 1,
  type: 2,
  title: 3,
  status: 4,
  owner: 5,
  change_authority: 6,
  supersedes: 7,
  status_reason: 8,
  links: 9,
  needed_to_close: 10,
  outcome: 11,
  decision: 12,
  alternatives_rejected: 12,
  consequences: 14,
  context: 15,
  meta: 16,
};

const LinkKeyOrder: Record<string, number> = {
  type: 0,
  target: 1,
  rationale: 2,
};

const AlternativeKeyOrder: Record<string, number> = {
  alternative: 0,
  rejected_because: 1,
};

function formatZodError(filePath: string, error: z.ZodError): string {
  const issues = error.issues
    .map((issue) => {
      const location = issue.path.length > 0 ? issue.path.join('.') : '<root>';
      return `${location}: ${issue.message}`;
    })
    .join('; ');
  return `Validation failed for ${filePath}: ${issues}`;
}

function validateLinkIntegrity(register: Register): string | undefined {
  const ids = new Set(register.records.map((r) => r.id));
  for (const record of register.records) {
    for (const link of record.links) {
      if (link.type === 'external') continue; // external targets live outside the register
      if (!ids.has(link.target)) {
        return `Record ${record.id} links to non-existent target ${link.target}`;
      }
    }
    for (const target of record.supersedes) {
      if (!ids.has(target)) {
        return `Record ${record.id} supersedes non-existent target ${target}`;
      }
    }
  }
}

function sortObjectKeys<T extends Record<string, unknown>>(
  obj: T,
  order: Record<string, number>,
): T {
  const sorted: Record<string, unknown> = {};
  const entries = Object.entries(obj).sort((a, b) => {
    const aOrder = order[a[0]] ?? Number.MAX_SAFE_INTEGER;
    const bOrder = order[b[0]] ?? Number.MAX_SAFE_INTEGER;
    if (aOrder !== bOrder) return aOrder - bOrder;
    return a[0].localeCompare(b[0]);
  });
  for (const [key, value] of entries) {
    sorted[key] = value;
  }
  return sorted as T;
}

function normalizeRecord(record: DecisionRecord): Record<string, unknown> {
  const base = sortObjectKeys(record as Record<string, unknown>, RecordKeyOrder);
  // Never serialize absent optional fields (would dump as `null`).
  if (base.status_reason === undefined) {
    delete base.status_reason;
  }
  if (base.context === undefined) {
    delete base.context;
  }
  if (base.meta === undefined) {
    delete base.meta;
  }
  if (base.outcome === undefined) {
    delete base.outcome;
  }
  if (Array.isArray(base.links)) {
    base.links = base.links.map((link) =>
      sortObjectKeys(link as Record<string, unknown>, LinkKeyOrder),
    );
  }
  if (Array.isArray(base.alternatives_rejected)) {
    base.alternatives_rejected = base.alternatives_rejected.map((alt) =>
      sortObjectKeys(alt as Record<string, unknown>, AlternativeKeyOrder),
    );
  }
  return base;
}

function serializeRegister(register: Register): string {
  const sortedWorkspace = sortObjectKeys(
    register.workspace as unknown as Record<string, unknown>,
    WorkspaceKeyOrder,
  );
  const sortedRecords = sortRecords(register.records).map(normalizeRecord);
  const normalized = sortObjectKeys(
    {
      schema_version: register.schema_version,
      workspace: sortedWorkspace,
      records: sortedRecords,
    } as Record<string, unknown>,
    RegisterKeyOrder,
  );
  return dump(normalized, {
    noRefs: true,
    lineWidth: -1,
    quoteStyle: 'double',
    sortKeys: false,
  });
}

function allocateId(records: DecisionRecord[], type: RecordType): string {
  const existing = records
    .filter((r) => r.type === type)
    .map((r) => Number.parseInt(r.id.split('-')[1], 10));
  const max = existing.length > 0 ? Math.max(...existing) : 0;
  const next = max + 1;
  if (next > 9999) {
    throw new Error(`No available id for type ${type} (max 9999)`);
  }
  return `${type}-${String(next).padStart(4, '0')}`;
}

export function readRegister(filePath: string): Register {
  let content: string;
  try {
    content = fs.readFileSync(filePath, 'utf-8');
  } catch (err) {
    throw new Error(
      `Cannot read register at ${filePath}: ${err instanceof Error ? err.message : String(err)}`,
    );
  }
  let parsed: unknown;
  try {
    parsed = load(content);
  } catch (err) {
    throw new Error(
      `Invalid YAML at ${filePath}: ${err instanceof Error ? err.message : String(err)}`,
    );
  }
  const result = RegisterSchema.safeParse(parsed);
  if (!result.success) {
    throw new Error(formatZodError(filePath, result.error));
  }
  return result.data;
}

export function validateRegisterFile(filePath: string): void {
  const register = readRegister(filePath);
  const linkError = validateLinkIntegrity(register);
  if (linkError) {
    throw new Error(`${filePath}: ${linkError}`);
  }
}

export function writeRegister(filePath: string, register: Register): void {
  const result = RegisterSchema.safeParse(register);
  if (!result.success) {
    throw new Error(formatZodError(filePath, result.error));
  }
  const linkError = validateLinkIntegrity(register);
  if (linkError) {
    throw new Error(`${filePath}: ${linkError}`);
  }
  const serialized = serializeRegister(register);
  const dir = path.dirname(filePath);
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(filePath, serialized, 'utf-8');
}

export function initRegister(filePath: string, workspace: Workspace): void {
  if (fs.existsSync(filePath)) {
    throw new Error(`Register already exists at ${filePath}`);
  }
  const register: Register = {
    schema_version: '1.0',
    workspace,
    records: [],
  };
  writeRegister(filePath, register);
}

function withExtras<T extends Record<string, unknown>>(base: T, input: AddRecordInput): T {
  const extras = base as Record<string, unknown>;
  if (input.context !== undefined) extras.context = input.context;
  if (input.meta !== undefined) extras.meta = input.meta;
  return base;
}

export function addRecord(filePath: string, input: AddRecordInput): DecisionRecord {
  if (!fs.existsSync(filePath)) {
    throw new Error(
      `Register not found at ${filePath}. Run the decision-init tool first to create a new register.`,
    );
  }
  const register = readRegister(filePath);
  const id = allocateId(register.records, input.type);
  const owner = input.owner ?? register.workspace.owner;
  const change_authority = input.change_authority ?? register.workspace.change_authority;

  const base = withExtras(
    {
      schema_version: '1.0' as const,
      id,
      type: input.type,
      title: input.title,
      status: 'proposed' as const,
      owner,
      change_authority,
      supersedes: input.supersedes ?? [],
      links: input.links ?? [],
    },
    input,
  );

  let record: DecisionRecord;
  switch (input.type) {
    case 'REQ':
    case 'CONSTRAINT':
      record = { ...base, type: input.type };
      break;
    case 'ASSUMPTION':
      record = {
        ...base,
        type: input.type,
        needed_to_close: input.needed_to_close,
        outcome: input.outcome,
      };
      break;
    case 'DEC':
      record = {
        ...base,
        type: input.type,
        decision: input.decision,
        alternatives_rejected: input.alternatives_rejected ?? [],
        consequences: input.consequences,
      };
      break;
  }

  register.records.push(record);
  writeRegister(filePath, register);
  return record;
}

function transitionRecord(
  filePath: string,
  id: string,
  target: RecordStatus,
  reason?: string,
): DecisionRecord {
  const register = readRegister(filePath);
  const record = register.records.find((r) => r.id === id);
  if (!record) {
    throw new Error(`Record ${id} not found`);
  }
  if (record.status === target) {
    return record;
  }
  const allowed = allowedTransitions[record.status] ?? [];
  if (!allowed.includes(target)) {
    throw new Error(
      `Invalid status transition from ${record.status} to ${target} for record ${id}`,
    );
  }
  record.status = target;
  if (reason) {
    record.status_reason = reason;
  }
  writeRegister(filePath, register);
  return record;
}

export function ratifyRecord(filePath: string, id: string): DecisionRecord {
  return transitionRecord(filePath, id, 'accepted');
}

export function rejectRecord(filePath: string, id: string, reason?: string): DecisionRecord {
  return transitionRecord(filePath, id, 'rejected', reason);
}

export function supersedeRecord(
  filePath: string,
  oldId: string,
  newRecordInput: AddRecordInput,
  reason?: string,
): DecisionRecord {
  const register = readRegister(filePath);
  const oldRecord = register.records.find((r) => r.id === oldId);
  if (!oldRecord) {
    throw new Error(`Record ${oldId} not found`);
  }
  if (oldRecord.status === 'superseded') {
    throw new Error(`Record ${oldId} is already superseded`);
  }

  const newId = allocateId(register.records, newRecordInput.type);
  const owner = newRecordInput.owner ?? register.workspace.owner;
  const change_authority = newRecordInput.change_authority ?? register.workspace.change_authority;

  const base = withExtras(
    {
      schema_version: '1.0' as const,
      id: newId,
      type: newRecordInput.type,
      title: newRecordInput.title,
      status: 'proposed' as const,
      owner,
      change_authority,
      supersedes: [oldId],
      links: newRecordInput.links ?? [],
    },
    newRecordInput,
  );

  let newRecord: DecisionRecord;
  switch (newRecordInput.type) {
    case 'REQ':
    case 'CONSTRAINT':
      newRecord = { ...base, type: newRecordInput.type };
      break;
    case 'ASSUMPTION':
      newRecord = {
        ...base,
        type: newRecordInput.type,
        needed_to_close: newRecordInput.needed_to_close,
        outcome: newRecordInput.outcome,
      };
      break;
    case 'DEC':
      newRecord = {
        ...base,
        type: newRecordInput.type,
        decision: newRecordInput.decision,
        alternatives_rejected: newRecordInput.alternatives_rejected ?? [],
        consequences: newRecordInput.consequences,
      };
      break;
  }

  oldRecord.status = 'superseded';
  if (reason) {
    oldRecord.status_reason = reason;
  }
  register.records.push(newRecord);
  writeRegister(filePath, register);
  return newRecord;
}
