import { afterEach, beforeEach, describe, expect, test } from 'bun:test';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
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

  test('byte-stability read -> write -> read', () => {
    addRecord(registerPath, makeInput('REQ'));
    addRecord(registerPath, makeInput('DEC'));
    const firstBytes = fs.readFileSync(registerPath, 'utf-8');
    const register = readRegister(registerPath);
    writeRegister(registerPath, register);
    const secondBytes = fs.readFileSync(registerPath, 'utf-8');
    expect(secondBytes).toBe(firstBytes);
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
    expect(() => addRecord(missingPath, makeInput('REQ'))).toThrow(/initRegister/);
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
