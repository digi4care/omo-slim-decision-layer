import { afterEach, describe, expect, it } from 'bun:test';
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { loadConfig } from '../src/config.js';

const created: string[] = [];

function scratch(): string {
  const dir = mkdtempSync(path.join(tmpdir(), 'dl-config-'));
  created.push(dir);
  return dir;
}

function write(root: string, relative: string, content: string): string {
  const file = path.join(root, relative);
  mkdirSync(path.dirname(file), { recursive: true });
  writeFileSync(file, content, 'utf-8');
  return file;
}

afterEach(() => {
  while (created.length > 0) {
    const dir = created.pop();
    if (dir) rmSync(dir, { recursive: true, force: true });
  }
});

describe('loadConfig', () => {
  it('defaults to disabled when no config exists anywhere', () => {
    const root = scratch();
    const globalPath = path.join(scratch(), 'opencode.jsonc');
    const config = loadConfig(root, globalPath);
    expect(config.enabled).toBe(false);
    expect(config.registerPath).toBe('.decisions/register.yaml');
  });

  it('reads enabled from the global opencode config', () => {
    const root = scratch();
    const globalPath = write(
      scratch(),
      'opencode.jsonc',
      JSON.stringify({ 'decision-layer': { enabled: true } }),
    );
    expect(loadConfig(root, globalPath).enabled).toBe(true);
  });

  it('lets the project config override the global one', () => {
    const root = scratch();
    const globalPath = write(
      scratch(),
      'opencode.jsonc',
      JSON.stringify({ 'decision-layer': { enabled: true } }),
    );
    write(root, 'opencode.jsonc', JSON.stringify({ 'decision-layer': { enabled: false } }));
    expect(loadConfig(root, globalPath).enabled).toBe(false);
  });

  it('merges per key, not per file', () => {
    const root = scratch();
    const globalPath = write(
      scratch(),
      'opencode.jsonc',
      JSON.stringify({
        'decision-layer': { enabled: true, registerPath: '.d/r.yaml' },
      }),
    );
    // The project only sets registerPath; enabled must survive from global.
    write(
      root,
      'opencode.jsonc',
      JSON.stringify({ 'decision-layer': { registerPath: '.p/r.yaml' } }),
    );
    const config = loadConfig(root, globalPath);
    expect(config.enabled).toBe(true);
    expect(config.registerPath).toBe('.p/r.yaml');
  });

  it('skips a malformed config instead of throwing', () => {
    const root = scratch();
    const globalPath = write(scratch(), 'opencode.jsonc', '{ this is not json ');
    write(root, 'opencode.jsonc', JSON.stringify({ 'decision-layer': { enabled: true } }));
    expect(loadConfig(root, globalPath).enabled).toBe(true);
  });

  it('reads comments and trailing commas out of jsonc', () => {
    const root = scratch();
    const globalPath = write(
      scratch(),
      'opencode.jsonc',
      [
        '// decision layer',
        '{',
        '  /* block */',
        '  "decision-layer": { "enabled": true, },',
        '}',
      ].join('\n'),
    );
    expect(loadConfig(root, globalPath).enabled).toBe(true);
  });

  it('ignores non-boolean enabled values', () => {
    const root = scratch();
    const globalPath = write(
      scratch(),
      'opencode.jsonc',
      JSON.stringify({ 'decision-layer': { enabled: 'yes' } }),
    );
    expect(loadConfig(root, globalPath).enabled).toBe(false);
  });

  it('never takes registerPath from the global config', () => {
    // A register path is a property of the repository, not of the user. Letting
    // it ride along in the global file would apply one path to every repo.
    const root = scratch();
    const globalPath = write(
      scratch(),
      'opencode.jsonc',
      JSON.stringify({ 'decision-layer': { enabled: true, registerPath: '.global/r.yaml' } }),
    );
    const config = loadConfig(root, globalPath);
    expect(config.enabled).toBe(true);
    expect(config.registerPath).toBe('.decisions/register.yaml');
  });

  it('reads registerPath from the project opencode.json', () => {
    const root = scratch();
    write(
      root,
      'opencode.json',
      JSON.stringify({ 'decision-layer': { registerPath: '.p/r.yaml' } }),
    );
    const globalPath = path.join(scratch(), 'missing.jsonc');
    expect(loadConfig(root, globalPath).registerPath).toBe('.p/r.yaml');
  });

  it('honours OPENCODE_CONFIG as a config root override', () => {
    const root = scratch();
    const dir = scratch();
    write(dir, 'opencode.jsonc', JSON.stringify({ 'decision-layer': { enabled: true } }));
    const previous = process.env.OPENCODE_CONFIG;
    try {
      process.env.OPENCODE_CONFIG = dir;
      expect(loadConfig(root).enabled).toBe(true);
    } finally {
      if (previous === undefined) delete process.env.OPENCODE_CONFIG;
      else process.env.OPENCODE_CONFIG = previous;
    }
  });

  it('honours OPENCODE_CONFIG as an explicit file path', () => {
    const root = scratch();
    const file = write(
      scratch(),
      'custom.jsonc',
      JSON.stringify({ 'decision-layer': { enabled: true } }),
    );
    const previous = process.env.OPENCODE_CONFIG;
    try {
      process.env.OPENCODE_CONFIG = file;
      expect(loadConfig(root).enabled).toBe(true);
    } finally {
      if (previous === undefined) delete process.env.OPENCODE_CONFIG;
      else process.env.OPENCODE_CONFIG = previous;
    }
  });

  it('still honours the deprecated project-local file', () => {
    const root = scratch();
    write(
      root,
      '.opencode/decision-layer.json',
      JSON.stringify({ registerPath: '.legacy/r.yaml' }),
    );
    const globalPath = path.join(scratch(), 'missing.jsonc');
    expect(loadConfig(root, globalPath).registerPath).toBe('.legacy/r.yaml');
  });

  it('lets the opencode config beat the deprecated file', () => {
    const root = scratch();
    write(
      root,
      '.opencode/decision-layer.json',
      JSON.stringify({ registerPath: '.legacy/r.yaml' }),
    );
    const globalPath = write(
      scratch(),
      'opencode.jsonc',
      JSON.stringify({ 'decision-layer': { enabled: true } }),
    );
    write(
      root,
      'opencode.jsonc',
      JSON.stringify({ 'decision-layer': { registerPath: '.new/r.yaml' } }),
    );
    expect(loadConfig(root, globalPath).registerPath).toBe('.new/r.yaml');
  });
});
