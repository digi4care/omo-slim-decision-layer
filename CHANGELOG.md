# Changelog

All notable changes to `@digi4care/omo-slim-decision-layer` are documented here.
The project follows [semver](https://semver.org): every release, however small,
gets a version number and a `.tgz` in `release/`.

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
