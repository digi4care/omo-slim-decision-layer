import { beforeAll, describe, expect, test } from 'bun:test';
import fs from 'node:fs';
import { createRequire } from 'node:module';
import path from 'node:path';
import yaml from 'js-yaml';

const require = createRequire(import.meta.url);
const { validate } = require('json-schema') as {
  validate: (
    instance: unknown,
    schema: unknown,
  ) => {
    valid: boolean;
    errors: { property: string; message: string }[];
  };
};

const projectRoot = path.resolve(import.meta.dirname, '..');
const schemaPath = path.join(projectRoot, 'schema', 'register.schema.json');

const exampleYaml = `
schema_version: '1.0'
workspace:
  id: directus-headless
  title: 'Directus headless delivery'
  owner: 'repo-owner'
  change_authority: 'repo-owner'
records:
  - schema_version: '1.0'
    id: REQ-0001
    type: REQ
    title: 'Beslisregister is de enige bron voor beslissingen'
    status: accepted
    owner: 'repo-owner'
    change_authority: 'repo-owner'
    supersedes: []
    links: []
  - schema_version: '1.0'
    id: DEC-0001
    type: DEC
    title: 'Records leven als YAML in de repo, niet in een database'
    status: accepted
    owner: 'repo-owner'
    change_authority: 'repo-owner'
    supersedes: []
    links:
      - type: constrains
        target: REQ-0001
        rationale: 'Een database zou de git-diff als beslisbron ondermijnen.'
    decision: 'YAML-register in de repo, beheerd als broncode.'
    alternatives_rejected:
      - alternative: 'SQLite met JSONL-shadow, zoals beads'
        rejected_because: 'Voegt een tweede bron van waarheid toe.'
      - alternative: 'Alleen markdown'
        rejected_because: 'Niet querybaar, niet valideerbaar.'
    consequences: 'Reviews gebeuren als diff; tooling moet het schema kennen.'
`;

describe('generated JSON Schema', () => {
  beforeAll(() => {
    if (!fs.existsSync(schemaPath)) {
      throw new Error(
        `Generated schema not found at ${schemaPath}; run bun run src/schema/generate.ts first`,
      );
    }
  });

  test('is Draft-07', () => {
    const schema = JSON.parse(fs.readFileSync(schemaPath, 'utf-8'));
    expect(schema.$schema).toBe('http://json-schema.org/draft-07/schema#');
  });

  test('validates the §9.1 example register', () => {
    const schema = JSON.parse(fs.readFileSync(schemaPath, 'utf-8'));
    const instance = yaml.load(exampleYaml);
    const result = validate(instance, schema);
    expect(result.valid).toBe(true);
    expect(result.errors).toHaveLength(0);
  });
});
