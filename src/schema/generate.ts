import fs from 'node:fs';
import path from 'node:path';
import { z } from 'zod';
import { RegisterSchema } from '../register/register.js';

const projectRoot = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..', '..');
const outDir = path.join(projectRoot, 'schema');
const outPath = path.join(outDir, 'register.schema.json');

const jsonSchema = z.toJSONSchema(RegisterSchema, {
  target: 'draft-07',
});

fs.mkdirSync(outDir, { recursive: true });
fs.writeFileSync(outPath, `${JSON.stringify(jsonSchema, null, 2)}\n`, 'utf-8');
console.log(`Wrote ${outPath}`);
