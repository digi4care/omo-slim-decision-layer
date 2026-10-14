import { describe, expect, test } from 'bun:test';
import {
  AddRecordInputSchema,
  AssumptionRecordSchema,
  ConstraintRecordSchema,
  DecRecordSchema,
  LinkRelations,
  RecordId,
  RecordSchema,
  RecordStatuses,
  RecordTypes,
  ReqRecordSchema,
  recordIdPattern,
  recordType,
} from '../src/model/record.js';

function baseRecord(type: 'REQ' | 'CONSTRAINT' | 'ASSUMPTION' | 'DEC' = 'REQ') {
  return {
    schema_version: '1.0' as const,
    id: `${type}-0001`,
    type,
    title: 'Test title',
    status: 'proposed' as const,
    owner: 'repo-owner',
    change_authority: 'repo-owner',
    supersedes: [] as string[],
    links: [] as { type: (typeof LinkRelations)[number]; target: string; rationale: string }[],
  };
}

describe('RecordType enum', () => {
  test.each(RecordTypes)('accepts %s', (type) => {
    const input = baseRecord(type);
    if (type === 'ASSUMPTION') {
      (input as Record<string, unknown>).needed_to_close = 'verify';
    }
    if (type === 'DEC') {
      (input as Record<string, unknown>).decision = 'decide';
      (input as Record<string, unknown>).alternatives_rejected = [];
      (input as Record<string, unknown>).consequences = 'effects';
    }
    expect(RecordSchema.safeParse(input).success).toBe(true);
  });

  test('rejects unknown type', () => {
    const result = RecordSchema.safeParse({ ...baseRecord(), type: 'FR' });
    expect(result.success).toBe(false);
  });
});

describe('RecordStatus enum', () => {
  test.each(RecordStatuses)('accepts %s', (status) => {
    expect(RecordSchema.safeParse({ ...baseRecord(), status }).success).toBe(true);
  });

  test('rejects unknown status', () => {
    const result = RecordSchema.safeParse({ ...baseRecord(), status: 'active' });
    expect(result.success).toBe(false);
  });
});

describe('Link relation enum', () => {
  test.each(LinkRelations)('accepts %s', (relation) => {
    const record = {
      ...baseRecord(),
      links: [{ type: relation, target: 'DEC-0001', rationale: 'because' }],
    };
    expect(RecordSchema.safeParse(record).success).toBe(true);
  });

  test('rejects supersedes as link relation', () => {
    const record = {
      ...baseRecord(),
      links: [{ type: 'supersedes', target: 'DEC-0001', rationale: 'because' }],
    };
    const result = RecordSchema.safeParse(record);
    expect(result.success).toBe(false);
  });
});

describe('RecordId validation', () => {
  test.each(RecordTypes)('accepts valid %s id', (type) => {
    expect(RecordId.safeParse(`${type}-0001`).success).toBe(true);
    expect(RecordId.safeParse(`${type}-9999`).success).toBe(true);
  });

  test.each(RecordTypes)('rejects non-four-digit %s id', (type) => {
    expect(RecordId.safeParse(`${type}-1`).success).toBe(false);
    expect(RecordId.safeParse(`${type}-01`).success).toBe(false);
    expect(RecordId.safeParse(`${type}-001`).success).toBe(false);
    expect(RecordId.safeParse(`${type}-00001`).success).toBe(false);
  });

  test('rejects unknown prefix', () => {
    expect(RecordId.safeParse('FR-0001').success).toBe(false);
  });
});

describe('Record id/type consistency', () => {
  test('rejects REQ record with DEC id', () => {
    const result = ReqRecordSchema.safeParse({ ...baseRecord(), id: 'DEC-0001' });
    expect(result.success).toBe(false);
  });

  test('rejects DEC record with REQ id', () => {
    const result = DecRecordSchema.safeParse({
      ...baseRecord('DEC'),
      id: 'REQ-0001',
      decision: 'x',
      alternatives_rejected: [],
      consequences: 'y',
    });
    expect(result.success).toBe(false);
  });
});

describe('Required fields', () => {
  test('rejects missing schema_version', () => {
    const { schema_version: _schema_version, ...rest } = baseRecord();
    expect(RecordSchema.safeParse(rest).success).toBe(false);
  });

  test('rejects missing title', () => {
    expect(RecordSchema.safeParse({ ...baseRecord(), title: '' }).success).toBe(false);
  });

  test('rejects missing owner', () => {
    expect(RecordSchema.safeParse({ ...baseRecord(), owner: '' }).success).toBe(false);
  });

  test('rejects missing change_authority', () => {
    expect(RecordSchema.safeParse({ ...baseRecord(), change_authority: '' }).success).toBe(false);
  });
});

describe('Type-specific fields', () => {
  test('ASSUMPTION requires needed_to_close', () => {
    const result = AssumptionRecordSchema.safeParse(baseRecord('ASSUMPTION'));
    expect(result.success).toBe(false);
  });

  test('ASSUMPTION accepts needed_to_close', () => {
    const result = AssumptionRecordSchema.safeParse({
      ...baseRecord('ASSUMPTION'),
      needed_to_close: 'verify this',
    });
    expect(result.success).toBe(true);
  });

  test('DEC requires decision', () => {
    const result = DecRecordSchema.safeParse({
      ...baseRecord('DEC'),
      alternatives_rejected: [],
      consequences: 'y',
    });
    expect(result.success).toBe(false);
  });

  test('DEC requires consequences', () => {
    const result = DecRecordSchema.safeParse({
      ...baseRecord('DEC'),
      decision: 'x',
      alternatives_rejected: [],
    });
    expect(result.success).toBe(false);
  });

  test('DEC validates alternatives_rejected items', () => {
    const result = DecRecordSchema.safeParse({
      ...baseRecord('DEC'),
      decision: 'x',
      alternatives_rejected: [{ alternative: '', rejected_because: '' }],
      consequences: 'y',
    });
    expect(result.success).toBe(false);
  });

  test('REQ and CONSTRAINT are envelope only', () => {
    expect(ReqRecordSchema.safeParse(baseRecord('REQ')).success).toBe(true);
    expect(ConstraintRecordSchema.safeParse(baseRecord('CONSTRAINT')).success).toBe(true);
  });
});

describe('AddRecordInputSchema', () => {
  test('accepts minimal REQ input', () => {
    expect(AddRecordInputSchema.safeParse({ type: 'REQ', title: 'Title' }).success).toBe(true);
  });

  test('accepts DEC input with alternatives', () => {
    expect(
      AddRecordInputSchema.safeParse({
        type: 'DEC',
        title: 'Title',
        decision: 'd',
        consequences: 'c',
        alternatives_rejected: [{ alternative: 'a', rejected_because: 'b' }],
      }).success,
    ).toBe(true);
  });

  test('rejects DEC input without decision', () => {
    expect(
      AddRecordInputSchema.safeParse({ type: 'DEC', title: 'Title', consequences: 'c' }).success,
    ).toBe(false);
  });
});

describe('helpers', () => {
  test('recordIdPattern matches expected ids', () => {
    expect(recordIdPattern('REQ').test('REQ-0001')).toBe(true);
    expect(recordIdPattern('REQ').test('REQ-001')).toBe(false);
  });

  test('recordType extracts type from id', () => {
    expect(recordType('DEC-0001')).toBe('DEC');
    expect(recordType('X-0001')).toBeUndefined();
  });
});
