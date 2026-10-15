# Changelog

All notable changes to `@digi4care/omo-slim-decision-layer` are documented here.
The project follows [semver](https://semver.org): every release, however small,
gets a version number and a `.tgz` in `release/`.

## [Unreleased]

### Added

- **v2 self-registered skill.** On OpenCode v2 the plugin registers its own
  `skills/decision-layer/SKILL.md` during `setup` via `ctx.skill.transform`, so
  the decision-layer discipline is available without a manual install step.
  Empirically verified on `@opencode/plugin` 2.0.29.

### Fixed

- README now correctly distinguishes local plugin paths: OpenCode v1 needs
  `.../dist/index.js`, while OpenCode v2 needs `.../dist` (the directory).
  Using the file path in v2 logs `configured plugin path must be a directory`
  and fails to load the plugin.

## [0.4.0] - 2026-10-14

### Breaking

- Record schemas are now strict: unknown top-level fields are REJECTED with an
  `unrecognized_keys` error instead of being silently stripped (R2: no silent
  data loss). Legacy extras must be moved to `meta` explicitly. Registers
  written against 0.3.0 that carry undeclared top-level keys will now fail
  validation instead of loading with those keys dropped.

### Added

- Optional `context` free-text field on all record types (R1: a decision
  register needs its "why"-narrative, not just title + links), also rendered in
  the markdown view. Optional `meta` free-form bag for explicitly preserved
  legacy/import data.
- New link relation types `decides`, `implements`, `satisfies` (R5) and
  `external` (R4): external links take free-form targets (beads issues, URLs,
  legacy ids) and are exempt from referential-integrity checks; internal link
  types still require `TYPE-NNNN` register ids.

### Changed

- Verified after the change against the directus-headless brownfield dogfood:
  104 converted records now preserve 100% of links (was 37%) and all ADR
  context (was 0%), v1 `server` and v2 `setup` paths both green, 102 tests.

## [0.3.0] - 2026-10-14

### Added

- **v2 compatibility.** The default export now also provides a v2 `setup`
  (next to the existing v1 `server`), following oh-my-opencode-slim's pattern.
  The nine tools are registered via `ctx.tool.transform` and the interview
  prompt is injected via `ctx.session.hook('prompt')`. The project root is
  captured from `ctx.location.directory` because v2 tool contexts do not expose
  `worktree`/`directory`.
- `@opencode/plugin` 2.0.29 added as a devDependency for typechecking.

## [0.2.2] - 2026-10-14

### Changed

- `@opencode-ai/plugin` 1.18.32 → 1.18.35 (matches the host version).
- `js-yaml` 4 → 5.4.3. Migrated to named imports (`load`/`dump`) and the new
  `quoteStyle: 'double'` dump option; `@types/js-yaml` removed (v5 bundles types).
- `typescript` 5.9 → 7.0.2; `rootDir: "src"` added to `tsconfig.json` (required
  by TS 7 declaration builds).
- `@biomejs/biome` 2.5.14 → 2.5.15 (and the matching `$schema` URL).

### Fixed

- Corrected the repository URL in `package.json` to
  `https://github.com/digi4care/omo-slim-decision-layer` and made the repo public.

## [0.2.1] - 2026-10-14

First public npm release.

### Added

- Typed decision records: `REQ`, `CONSTRAINT`, `ASSUMPTION`, `DEC` with closed
  status vocabulary (`proposed | accepted | rejected | superseded`) and typed links.
- One YAML register per repo (`.decisions/register.yaml`) with deterministic,
  byte-stable serialization and in-memory validation before every write.
- Nine agent tools: `decision-init`, `decision-add`, `decision-ratify`,
  `decision-reject`, `decision-supersede`, `decision-list`, `decision-query`,
  `decision-validate`, `decision-view`.
- `decision-reject` and `decision-supersede` store their reason in
  `status_reason`.
- `command.execute.before` hook that appends a discipline prompt to
  `/interview`, idempotent via a sentinel comment.
- JSON Schema generated from the zod model (`schema/register.schema.json`).
- `skills/decision-layer/SKILL.md` with the discipline rules.
- 93 tests (`bun test`), typecheck and biome clean.
