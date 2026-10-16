import { describe, expect, it } from 'bun:test';
import { copyFileSync, existsSync, mkdirSync, mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { loadDecisionSkill, parseFrontmatter } from '../src/skills/register.js';

describe('parseFrontmatter', () => {
  it('returns name and description from a realistic frontmatter block whose description contains a colon', () => {
    const raw = `---\nname: decision-layer\ndescription: Discipline for the decision-layer plugin's decision register. Triggers - decision record, decision register, .decisions.\n---\n\n# decision-layer discipline\n`;

    const result = parseFrontmatter(raw);

    expect(result.data.name).toBe('decision-layer');
    expect(result.data.description).toContain('decision register');
    expect(result.body).toBe('\n# decision-layer discipline\n');
  });

  it('returns empty data and the original body when text has no frontmatter', () => {
    const raw = '# just markdown\nno frontmatter here.\n';

    const result = parseFrontmatter(raw);

    expect(result.data).toEqual({});
    expect(result.body).toBe(raw);
  });

  it('does not throw on malformed YAML', () => {
    const raw = `---\nname: decision-layer\ndescription: [unclosed\n---\n\nbody\n`;

    expect(() => parseFrontmatter(raw)).not.toThrow();
    const result = parseFrontmatter(raw);
    expect(result.data).toEqual({});
    expect(result.body).toBe(raw);
  });
});

describe('loadDecisionSkill', () => {
  it('loads the bundled/development skill with the expected id and content', () => {
    const skill = loadDecisionSkill();

    expect(skill).toBeDefined();
    expect(skill?.id).toBe('decision-layer');
    expect(skill?.content).toContain('decision-layer discipline');
    expect(skill?.content).toContain('Pause only dependent architecture work');
    expect(skill?.content).toContain('not a universal technical gate');
    expect(skill?.content).toContain("br search '<record-id>' --all --json");
    expect(skill?.content).toContain('Add a commit hash only after that commit exists');
    expect(skill?.content).toContain('ask before `br init`');
    expect(existsSync(skill?.path ?? '')).toBe(true);
  });

  it('returns undefined for a missing file without throwing', () => {
    const skill = loadDecisionSkill('/nonexistent/path/SKILL.md');

    expect(skill).toBeUndefined();
  });

  it('preserves the description containing the decision register trigger phrase', () => {
    const skill = loadDecisionSkill();

    expect(skill?.description).toContain('decision register');
  });

  it('finds the skill from a bundled dist-like layout when given a baseDir', () => {
    const tmpDir = mkdtempSync(join(tmpdir(), 'decision-layer-test-'));
    try {
      const distDir = join(tmpDir, 'dist');
      const skillsDir = join(tmpDir, 'skills', 'decision-layer');
      mkdirSync(skillsDir, { recursive: true });
      const skillSource = resolve(
        fileURLToPath(new URL('../skills/decision-layer/SKILL.md', import.meta.url)),
      );
      copyFileSync(skillSource, join(skillsDir, 'SKILL.md'));

      const skill = loadDecisionSkill(undefined, distDir);

      expect(skill).toBeDefined();
      expect(skill?.id).toBe('decision-layer');
      expect(skill?.content).toContain('decision-layer discipline');
    } finally {
      rmSync(tmpDir, { recursive: true, force: true });
    }
  });

  it('returns undefined for a baseDir that resolves to no skill file', () => {
    const tmpDir = mkdtempSync(join(tmpdir(), 'decision-layer-test-'));
    try {
      const skill = loadDecisionSkill(undefined, tmpDir);

      expect(skill).toBeUndefined();
    } finally {
      rmSync(tmpDir, { recursive: true, force: true });
    }
  });
});
