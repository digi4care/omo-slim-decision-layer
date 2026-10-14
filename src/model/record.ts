import { z } from 'zod';

export const RecordTypes = ['REQ', 'CONSTRAINT', 'ASSUMPTION', 'DEC'] as const;
export type RecordType = (typeof RecordTypes)[number];

export const RecordStatuses = ['proposed', 'accepted', 'rejected', 'superseded'] as const;
export type RecordStatus = (typeof RecordStatuses)[number];

export const LinkRelations = ['refines', 'depends_on', 'constrains', 'relates_to'] as const;
export type LinkRelation = (typeof LinkRelations)[number];

const TypeOrder: Record<RecordType, number> = {
  REQ: 0,
  CONSTRAINT: 1,
  ASSUMPTION: 2,
  DEC: 3,
};

export function recordIdPattern(type: RecordType): RegExp {
  return new RegExp(`^${type}-\\d{4}$`);
}

export const RecordId = z.string().superRefine((val, ctx) => {
  const type = RecordTypes.find((t) => val.startsWith(`${t}-`));
  if (!type) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: `Record id must start with a valid type prefix (${RecordTypes.join(', ')})`,
    });
    return;
  }
  if (!recordIdPattern(type).test(val)) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: `Record id for type ${type} must match ${type}-NNNN (four digits, zero-padded)`,
    });
  }
});

export type RecordId = z.infer<typeof RecordId>;

export const LinkSchema = z.object({
  type: z.enum(LinkRelations),
  target: RecordId,
  rationale: z.string().min(1, 'Link rationale is required'),
});

export type Link = z.infer<typeof LinkSchema>;

const BaseRecordFields = {
  schema_version: z.literal('1.0'),
  title: z.string().min(1, 'Title is required'),
  status: z.enum(RecordStatuses),
  owner: z.string().min(1, 'Owner is required'),
  change_authority: z.string().min(1, 'Change authority is required'),
  supersedes: z.array(RecordId).default([]),
  links: z.array(LinkSchema).default([]),
};

function createRecordSchema<T extends RecordType>(type: T) {
  return z.object({
    ...BaseRecordFields,
    type: z.literal(type),
    id: RecordId.superRefine((val, ctx) => {
      if (!val.startsWith(`${type}-`)) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: `Id must start with ${type}- for a ${type} record`,
        });
      }
    }),
  });
}

export const ReqRecordSchema = createRecordSchema('REQ');
export const ConstraintRecordSchema = createRecordSchema('CONSTRAINT');
export const AssumptionRecordSchema = createRecordSchema('ASSUMPTION').extend({
  needed_to_close: z.string().min(1, 'needed_to_close is required'),
});
export const DecRecordSchema = createRecordSchema('DEC').extend({
  decision: z.string().min(1, 'Decision is required'),
  alternatives_rejected: z
    .array(
      z.object({
        alternative: z.string().min(1, 'Alternative is required'),
        rejected_because: z.string().min(1, 'Rejection reason is required'),
      }),
    )
    .default([]),
  consequences: z.string().min(1, 'Consequences are required'),
});

export const RecordSchema = z.discriminatedUnion('type', [
  ReqRecordSchema,
  ConstraintRecordSchema,
  AssumptionRecordSchema,
  DecRecordSchema,
]);

export type ReqRecord = z.infer<typeof ReqRecordSchema>;
export type ConstraintRecord = z.infer<typeof ConstraintRecordSchema>;
export type AssumptionRecord = z.infer<typeof AssumptionRecordSchema>;
export type DecRecord = z.infer<typeof DecRecordSchema>;
export type DecisionRecord = z.infer<typeof RecordSchema>;

const BaseAddInputFields = {
  title: z.string().min(1, 'Title is required'),
  owner: z.string().optional(),
  change_authority: z.string().optional(),
  supersedes: z.array(RecordId).optional(),
  links: z.array(LinkSchema).optional(),
};

export const AddRecordInputSchema = z.discriminatedUnion('type', [
  z.object({ ...BaseAddInputFields, type: z.literal('REQ') }),
  z.object({ ...BaseAddInputFields, type: z.literal('CONSTRAINT') }),
  z.object({
    ...BaseAddInputFields,
    type: z.literal('ASSUMPTION'),
    needed_to_close: z.string().min(1, 'needed_to_close is required'),
  }),
  z.object({
    ...BaseAddInputFields,
    type: z.literal('DEC'),
    decision: z.string().min(1, 'Decision is required'),
    alternatives_rejected: z
      .array(
        z.object({
          alternative: z.string().min(1, 'Alternative is required'),
          rejected_because: z.string().min(1, 'Rejection reason is required'),
        }),
      )
      .optional(),
    consequences: z.string().min(1, 'Consequences are required'),
  }),
]);

export type AddRecordInput = z.infer<typeof AddRecordInputSchema>;

export function sortRecords(records: DecisionRecord[]): DecisionRecord[] {
  return [...records].sort((a, b) => {
    const typeDiff = TypeOrder[a.type] - TypeOrder[b.type];
    if (typeDiff !== 0) return typeDiff;
    const aNum = Number.parseInt(a.id.split('-')[1], 10);
    const bNum = Number.parseInt(b.id.split('-')[1], 10);
    return aNum - bNum;
  });
}

export function recordType(id: string): RecordType | undefined {
  return RecordTypes.find((t) => id.startsWith(`${t}-`));
}
