import fs from 'node:fs';
import path from 'node:path';
import type { ToolContext, tool } from '@opencode-ai/plugin';
import { load } from 'js-yaml';
import { z } from 'zod';
import {
  type AddRecordInput,
  AddRecordInputSchema,
  type DecisionRecord,
  RecordStatuses,
  RecordTypes,
} from '../model/record.js';
import {
  addRecord,
  initRegister,
  type Register,
  ratifyRecord,
  readRegister,
  rejectRecord,
  supersedeRecord,
  validateRegisterFile,
} from '../register/register.js';
import {
  resolveProjectRoot,
  resolveRegisterPath,
  resolveToolPath,
  withinWorktree,
} from './paths.js';

// OpenCode's tool registry has historically accepted dashed names. If a future
// version rejects dashes at registration time, fall back to underscores here
// (e.g. 'decision_add') and update the skill prompt references accordingly.

type ToolDefinition = ReturnType<typeof tool>;

function readBodyFile(filePath: string): Record<string, unknown> {
  if (!fs.existsSync(filePath)) {
    throw new Error(`Body file not found: ${filePath}`);
  }
  const content = fs.readFileSync(filePath, 'utf-8');
  const trimmed = content.trim();
  if (!trimmed) return {};
  const parsed = load(content);
  if (parsed === null || parsed === undefined) return {};
  if (typeof parsed !== 'object' || Array.isArray(parsed)) {
    throw new Error(`Body file must contain a YAML object: ${filePath}`);
  }
  return parsed as Record<string, unknown>;
}

function parseRecordInput(
  base: Record<string, unknown>,
  body: Record<string, unknown>,
): AddRecordInput {
  const merged = { ...base, ...body };
  const result = AddRecordInputSchema.safeParse(merged);
  if (!result.success) {
    throw new Error(`Invalid record input: ${result.error.message}`);
  }
  return result.data;
}

function recordToTableRow(record: DecisionRecord): string {
  return `${record.id}\t${record.type}\t${record.status}\t${record.title}`;
}

function generateMarkdownView(register: Register): string {
  const lines: string[] = [];
  lines.push(`# Decision Register: ${register.workspace.title}`);
  lines.push('');
  lines.push(`- Workspace ID: ${register.workspace.id}`);
  lines.push(`- Owner: ${register.workspace.owner}`);
  lines.push(`- Change authority: ${register.workspace.change_authority}`);
  lines.push('');
  lines.push(`## Records (${register.records.length})`);
  lines.push('');

  for (const record of register.records) {
    lines.push(`### ${record.id} — ${record.title}`);
    lines.push('');
    lines.push(`- Type: ${record.type}`);
    lines.push(`- Status: ${record.status}`);
    lines.push(`- Owner: ${record.owner}`);
    lines.push(`- Change authority: ${record.change_authority}`);
    if (record.supersedes.length > 0) {
      lines.push(`- Supersedes: ${record.supersedes.join(', ')}`);
    }
    if (record.status_reason !== undefined) {
      lines.push(`- Status reason: ${record.status_reason}`);
    }
    if (record.context !== undefined) {
      lines.push(`- Context: ${record.context}`);
    }
    if (record.links.length > 0) {
      lines.push('- Links:');
      for (const link of record.links) {
        lines.push(`  - ${link.type} ${link.target}: ${link.rationale}`);
      }
    }
    if (record.type === 'ASSUMPTION') {
      lines.push(`- Needed to close: ${record.needed_to_close}`);
    }
    if (record.type === 'DEC') {
      lines.push(`- Decision: ${record.decision}`);
      if (record.alternatives_rejected.length > 0) {
        lines.push('- Alternatives rejected:');
        for (const alt of record.alternatives_rejected) {
          lines.push(`  - ${alt.alternative}: ${alt.rejected_because}`);
        }
      }
      lines.push(`- Consequences: ${record.consequences}`);
    }
    lines.push('');
  }

  return lines.join('\n');
}

function makeTool<TArgs extends Record<string, unknown>>(
  description: string,
  args: z.ZodRawShape,
  execute: (args: TArgs, ctx: ToolContext) => Promise<string>,
): ToolDefinition {
  return {
    description,
    args: args as never,
    execute: execute as never,
  } as ToolDefinition;
}

export function createDecisionTools(): Record<string, ToolDefinition> {
  return {
    'decision-add': makeTool(
      'Add a proposed decision record to the register. Use this whenever a requirement, non-negotiable, unverified assumption or decision comes up — do not leave them in prose. Records are written only through these tools: never edit .decisions/register.yaml by hand.',
      {
        type: z.enum(RecordTypes),
        title: z.string().min(1),
        body: z.string().optional().describe('Path to YAML file with additional record fields'),
      },
      async (args, ctx) => {
        const root = resolveProjectRoot(ctx);
        const registerPath = resolveRegisterPath(root);
        const body = args.body ? readBodyFile(resolveToolPath(root, args.body as string)) : {};
        const input = parseRecordInput(
          { type: args.type as string, title: args.title as string },
          body,
        );
        const record = addRecord(registerPath, input);
        return `Added ${record.id} (${record.status})`;
      },
    ),

    'decision-ratify': makeTool(
      'Ratify a proposed record (proposed -> accepted). OWNER ACT: call only when the user explicitly asks you to ratify, never on your own initiative.',
      {
        id: z.string(),
      },
      async (args, ctx) => {
        const root = resolveProjectRoot(ctx);
        const registerPath = resolveRegisterPath(root);
        const before = readRegister(registerPath).records.find((r) => r.id === args.id);
        if (before && before.status === 'accepted') {
          return `Record ${args.id} is already accepted (no-op)`;
        }
        const record = ratifyRecord(registerPath, args.id as string);
        return `Ratified ${record.id} -> ${record.status}`;
      },
    ),

    'decision-reject': makeTool(
      'Reject a proposed record (proposed -> rejected). OWNER ACT: like ratify, only on an explicit user request.',
      {
        id: z.string(),
        reason: z.string().min(1),
      },
      async (args, ctx) => {
        const root = resolveProjectRoot(ctx);
        const registerPath = resolveRegisterPath(root);
        const before = readRegister(registerPath).records.find((r) => r.id === args.id);
        if (before && before.status === 'rejected') {
          return `Record ${args.id} is already rejected (no-op)`;
        }
        const record = rejectRecord(registerPath, args.id as string, args.reason as string);
        return `Rejected ${record.id}: ${args.reason}`;
      },
    ),

    'decision-supersede': makeTool(
      'Supersede a record with a new proposed record. Use this instead of editing an existing record — history stays append-only.',
      {
        id: z.string(),
        by: z.string().describe('Path to YAML file describing the new record'),
        reason: z
          .string()
          .optional()
          .describe('Reason stored as status_reason on the superseded record'),
      },
      async (args, ctx) => {
        const root = resolveProjectRoot(ctx);
        const registerPath = resolveRegisterPath(root);
        const body = readBodyFile(resolveToolPath(root, args.by as string));
        const input = parseRecordInput({}, body);
        const record = supersedeRecord(
          registerPath,
          args.id as string,
          input,
          args.reason as string | undefined,
        );
        return `Superseded ${args.id} with ${record.id}`;
      },
    ),

    'decision-list': makeTool(
      'List decision records',
      {
        status: z.enum(RecordStatuses).optional(),
        type: z.enum(RecordTypes).optional(),
      },
      async (args, ctx) => {
        const root = resolveProjectRoot(ctx);
        const registerPath = resolveRegisterPath(root);
        const register = readRegister(registerPath);
        let records = register.records;
        if (args.status) records = records.filter((r) => r.status === args.status);
        if (args.type) records = records.filter((r) => r.type === args.type);
        if (records.length === 0) return 'No records found';
        const header = 'ID\tTYPE\tSTATUS\tTITLE';
        const rows = records.map(recordToTableRow);
        return [header, ...rows].join('\n');
      },
    ),

    'decision-query': makeTool(
      'Query record traceability',
      {
        orphan: z.boolean().optional(),
        for: z.string().optional(),
      },
      async (args, ctx) => {
        const root = resolveProjectRoot(ctx);
        const registerPath = resolveRegisterPath(root);
        const register = readRegister(registerPath);

        if (args.orphan) {
          const linked = new Set<string>();
          for (const r of register.records) {
            for (const link of r.links) {
              linked.add(link.target);
              linked.add(r.id);
            }
            for (const s of r.supersedes) {
              linked.add(s);
              linked.add(r.id);
            }
          }
          const orphans = register.records.filter((r) => !linked.has(r.id));
          if (orphans.length === 0) return 'No orphan records';
          return ['Orphan records:', ...orphans.map((r) => r.id)].join('\n');
        }

        if (args.for) {
          const targetId = args.for as string;
          const target = register.records.find((r) => r.id === targetId);
          if (!target) return `Record ${targetId} not found`;

          const related = new Set<DecisionRecord>();
          related.add(target);
          for (const r of register.records) {
            if (r.links.some((l) => l.target === targetId)) related.add(r);
            if (target.links.some((l) => l.target === r.id)) related.add(r);
            if (r.supersedes.includes(targetId)) related.add(r);
            if (target.supersedes.includes(r.id)) related.add(r);
          }

          return Array.from(related)
            .map((r) => `${r.id} (${r.type}, ${r.status}): ${r.title}`)
            .join('\n');
        }

        return 'Specify --orphan or --for <id>';
      },
    ),

    'decision-validate': makeTool(
      'Validate the register file against the schema. Run after every write; a register that does not validate is an open error, not a done task.',
      {},
      async (_args, ctx) => {
        const root = resolveProjectRoot(ctx);
        const registerPath = resolveRegisterPath(root);
        try {
          validateRegisterFile(registerPath);
          return `Register is valid: ${registerPath}`;
        } catch (err) {
          return `Register validation failed: ${err instanceof Error ? err.message : String(err)}`;
        }
      },
    ),

    'decision-view': makeTool(
      'Generate a disposable markdown view of the register. The view is generated output, never the source of truth.',
      {},
      async (_args, ctx) => {
        const root = resolveProjectRoot(ctx);
        const registerPath = resolveRegisterPath(root);
        const register = readRegister(registerPath);
        const viewPath = path.resolve(root, '.decisions', 'views', 'register.md');
        if (!withinWorktree(root, viewPath)) {
          throw new Error('View path escapes worktree');
        }
        fs.mkdirSync(path.dirname(viewPath), { recursive: true });
        const markdown = generateMarkdownView(register);
        fs.writeFileSync(viewPath, markdown, 'utf-8');
        return `View written to ${viewPath}`;
      },
    ),

    'decision-init': makeTool(
      'Create an empty decision register at .decisions/register.yaml (refuses to overwrite). Run once per repo before any other decision tool.',
      {
        id: z.string().min(1).describe('Workspace slug'),
        title: z.string().min(1),
        owner: z.string().min(1),
        change_authority: z.string().min(1),
      },
      async (args, ctx) => {
        const root = resolveProjectRoot(ctx);
        const registerPath = resolveRegisterPath(root);
        if (fs.existsSync(registerPath)) {
          return `Register already exists at ${registerPath}; not overwriting.`;
        }
        initRegister(registerPath, {
          id: args.id as string,
          title: args.title as string,
          owner: args.owner as string,
          change_authority: args.change_authority as string,
        });
        fs.mkdirSync(path.resolve(root, '.decisions', 'views'), { recursive: true });
        return `Initialized empty register at ${registerPath}`;
      },
    ),
  };
}
