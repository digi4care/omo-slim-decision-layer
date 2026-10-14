import { afterEach, beforeEach, describe, expect, test } from 'bun:test';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { load } from 'js-yaml';
import type { AddRecordInput, DecisionRecord } from '../src/model/record.js';
import {
  addRecord,
  initRegister,
  ratifyRecord,
  readRegister,
  rejectRecord,
  supersedeRecord,
  type Workspace,
  writeRegister,
} from '../src/register/register.js';

function makeWorkspace(): Workspace {
  return {
    id: 'test',
    title: 'Test workspace',
    owner: 'repo-owner',
    change_authority: 'repo-owner',
  };
}

function makeInput(
  type: DecisionRecord['type'],
  overrides: Partial<AddRecordInput> = {},
): AddRecordInput {
  const base = { type, title: 'Title' } as AddRecordInput;
  if (type === 'ASSUMPTION') {
    (base as Extract<AddRecordInput, { type: 'ASSUMPTION' }>).needed_to_close = 'verify';
  }
  if (type === 'DEC') {
    const dec = base as Extract<AddRecordInput, { type: 'DEC' }>;
    dec.decision = 'decide';
    dec.consequences = 'effects';
  }
  return { ...base, ...overrides };
}

describe('register', () => {
  let tmpDir: string;
  let registerPath: string;

  beforeEach(async () => {
    tmpDir = await fs.promises.mkdtemp(path.join(os.tmpdir(), 'decision-layer-'));
    registerPath = path.join(tmpDir, '.decisions', 'register.yaml');
    initRegister(registerPath, makeWorkspace());
  });

  afterEach(() => {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  test('init creates valid empty register', () => {
    const register = readRegister(registerPath);
    expect(register.schema_version).toBe('1.0');
    expect(register.workspace.id).toBe('test');
    expect(register.records).toHaveLength(0);
  });

  test('add -> validate -> read roundtrip', () => {
    const record = addRecord(registerPath, makeInput('REQ'));
    expect(record.status).toBe('proposed');
    expect(record.id).toBe('REQ-0001');
    const register = readRegister(registerPath);
    expect(register.records).toHaveLength(1);
  });

  test('id allocation is monotonic and never reuses', () => {
    addRecord(registerPath, makeInput('REQ'));
    addRecord(registerPath, makeInput('REQ'));
    addRecord(registerPath, makeInput('DEC'));
    const register = readRegister(registerPath);
    const ids = register.records.map((r) => r.id);
    expect(ids).toContain('REQ-0001');
    expect(ids).toContain('REQ-0002');
    expect(ids).toContain('DEC-0001');
    expect(ids).not.toContain('REQ-0003');
  });

  test('status transitions', () => {
    addRecord(registerPath, makeInput('REQ'));
    ratifyRecord(registerPath, 'REQ-0001');
    let register = readRegister(registerPath);
    expect(register.records[0].status).toBe('accepted');

    // ratify again is no-op
    ratifyRecord(registerPath, 'REQ-0001');
    register = readRegister(registerPath);
    expect(register.records[0].status).toBe('accepted');

    // illegal transitions
    expect(() => rejectRecord(registerPath, 'REQ-0001')).toThrow();
    // supersede is allowed on accepted records
  });

  test('reject transitions', () => {
    addRecord(registerPath, makeInput('REQ'));
    rejectRecord(registerPath, 'REQ-0001');
    const register = readRegister(registerPath);
    expect(register.records[0].status).toBe('rejected');

    expect(() => ratifyRecord(registerPath, 'REQ-0001')).toThrow();
  });

  test('reject stores reason as status_reason', () => {
    addRecord(registerPath, makeInput('REQ'));
    rejectRecord(registerPath, 'REQ-0001', 'No longer needed');
    const register = readRegister(registerPath);
    expect(register.records[0].status_reason).toBe('No longer needed');
    expect(fs.readFileSync(registerPath, 'utf-8')).toContain('status_reason: No longer needed');
  });

  test('reject without reason leaves status_reason absent', () => {
    addRecord(registerPath, makeInput('REQ'));
    rejectRecord(registerPath, 'REQ-0001');
    const register = readRegister(registerPath);
    expect(register.records[0].status_reason).toBeUndefined();
    expect(fs.readFileSync(registerPath, 'utf-8')).not.toContain('status_reason');
  });

  test('status_reason serializes after supersedes and before links', () => {
    addRecord(registerPath, makeInput('REQ'));
    rejectRecord(registerPath, 'REQ-0001', 'duplicate');
    const parsed = load(fs.readFileSync(registerPath, 'utf-8')) as {
      records: Record<string, unknown>[];
    };
    expect(Object.keys(parsed.records[0])).toEqual([
      'schema_version',
      'id',
      'type',
      'title',
      'status',
      'owner',
      'change_authority',
      'supersedes',
      'status_reason',
      'links',
    ]);
  });

  test('link integrity rejects missing target', () => {
    const input = makeInput('REQ', {
      links: [{ type: 'refines', target: 'DEC-9999', rationale: 'missing' }],
    });
    expect(() => addRecord(registerPath, input)).toThrow();
  });

  test('supersede behavior', () => {
    addRecord(registerPath, makeInput('REQ'));
    ratifyRecord(registerPath, 'REQ-0001');
    const newRecord = supersedeRecord(registerPath, 'REQ-0001', makeInput('REQ', { title: 'New' }));
    const register = readRegister(registerPath);
    const oldRecord = register.records.find((r) => r.id === 'REQ-0001');
    expect(oldRecord?.status).toBe('superseded');
    expect(newRecord.status).toBe('proposed');
    expect(newRecord.supersedes).toEqual(['REQ-0001']);
  });

  test('supersede from rejected record is allowed', () => {
    addRecord(registerPath, makeInput('REQ'));
    rejectRecord(registerPath, 'REQ-0001');
    const newRecord = supersedeRecord(registerPath, 'REQ-0001', makeInput('REQ'));
    expect(newRecord.supersedes).toEqual(['REQ-0001']);
  });

  test('supersede stores reason as status_reason on old record', () => {
    addRecord(registerPath, makeInput('REQ'));
    const newRecord = supersedeRecord(
      registerPath,
      'REQ-0001',
      makeInput('REQ', { title: 'New' }),
      'Approach changed',
    );
    const register = readRegister(registerPath);
    const oldRecord = register.records.find((r) => r.id === 'REQ-0001');
    expect(oldRecord?.status).toBe('superseded');
    expect(oldRecord?.status_reason).toBe('Approach changed');
    // reason belongs to the old record, not the new one
    expect(newRecord.status_reason).toBeUndefined();
  });

  test('supersede without reason leaves status_reason absent', () => {
    addRecord(registerPath, makeInput('REQ'));
    supersedeRecord(registerPath, 'REQ-0001', makeInput('REQ'));
    const register = readRegister(registerPath);
    const oldRecord = register.records.find((r) => r.id === 'REQ-0001');
    expect(oldRecord?.status_reason).toBeUndefined();
    expect(fs.readFileSync(registerPath, 'utf-8')).not.toContain('status_reason');
  });

  test('byte-stability read -> write -> read', () => {
    addRecord(registerPath, makeInput('REQ'));
    addRecord(registerPath, makeInput('DEC'));
    const firstBytes = fs.readFileSync(registerPath, 'utf-8');
    const register = readRegister(registerPath);
    writeRegister(registerPath, register);
    const secondBytes = fs.readFileSync(registerPath, 'utf-8');
    expect(secondBytes).toBe(firstBytes);
  });

  test('byte-stability with mixed status_reason presence', () => {
    addRecord(registerPath, makeInput('REQ'));
    addRecord(registerPath, makeInput('REQ'));
    rejectRecord(registerPath, 'REQ-0002', 'duplicate of REQ-0001');
    const firstBytes = fs.readFileSync(registerPath, 'utf-8');
    // field present exactly once — only the rejected record carries it
    expect(firstBytes.match(/status_reason/g)).toHaveLength(1);
    const register = readRegister(registerPath);
    writeRegister(registerPath, register);
    expect(fs.readFileSync(registerPath, 'utf-8')).toBe(firstBytes);
  });

  test('fixed ordering by type then ascending id', () => {
    addRecord(registerPath, makeInput('DEC'));
    addRecord(registerPath, makeInput('REQ'));
    addRecord(registerPath, makeInput('ASSUMPTION'));
    addRecord(registerPath, makeInput('REQ'));
    addRecord(registerPath, makeInput('CONSTRAINT'));
    const register = readRegister(registerPath);
    expect(register.records.map((r) => r.id)).toEqual([
      'REQ-0001',
      'REQ-0002',
      'CONSTRAINT-0001',
      'ASSUMPTION-0001',
      'DEC-0001',
    ]);
  });

  test('addRecord fails when register missing with init hint', () => {
    const missingPath = path.join(tmpDir, 'missing', 'register.yaml');
    expect(() => addRecord(missingPath, makeInput('REQ'))).toThrow(/decision-init/);
  });

  test('writeRegister does not touch file on validation failure', () => {
    addRecord(registerPath, makeInput('REQ'));
    const before = fs.readFileSync(registerPath, 'utf-8');
    const register = readRegister(registerPath);
    register.records[0].links = [{ type: 'refines', target: 'MISSING-0001', rationale: 'bad' }];
    expect(() => writeRegister(registerPath, register)).toThrow();
    const after = fs.readFileSync(registerPath, 'utf-8');
    expect(after).toBe(before);
  });
});
