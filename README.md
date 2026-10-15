# omo-slim-decision-layer

An [OpenCode](https://opencode.ai) plugin that adds a **decision layer** to
AI-assisted development: a typed, git-native decision register that records the
*why* of a project — requirements, constraints, assumptions and decisions —
with the same ergonomics that [beads](https://github.com/steveyegge/beads)
gives work items.

Built as a companion plugin for
[oh-my-opencode-slim](https://github.com/alvinunreal/oh-my-opencode-slim).

## What it does

- **Typed decision records** — `REQ` (requirement), `CONSTRAINT`
  (non-negotiable), `ASSUMPTION` (unverified, with `needed_to_close`) and `DEC`
  (decision with rejected alternatives and consequences).
- **Single source of truth** — one YAML register at `.decisions/register.yaml`.
  All writes go through the plugin's tools; the generated markdown view is
  disposable and never authoritative.
- **Closed vocabularies** — status is `proposed | accepted | rejected |
  superseded`. Supersede instead of edit: history stays append-only.
- **Owner ratification** — agents draft records; only the owner ratifies.
  This is a convention enforced by discipline, not by a technical gate.
- **Interview integration** — when oh-my-opencode-slim's `/interview` command
  runs, the plugin injects a discipline prompt so a closed interview ends as
  records in the register instead of loose markdown.
- **Skill availability** — on OpenCode v2 the plugin registers its own
  `skills/decision-layer/SKILL.md` at startup via `ctx.skill.transform`, so the
  discipline is loaded automatically without a separate install step. OpenCode
  v1 has no `skill.transform`; installing the skill to
  `~/.config/opencode/skills/decision-layer/` is not yet implemented.

## Compatibility

One package, two registration paths, sharing the same register and tool logic:

- **v1** (`@opencode-ai/plugin` 1.x): the default export provides a v1 `server`
  that registers the nine tools and the `command.execute.before` hook.
- **v2** (`@opencode/plugin` 2.x): the same default export also provides a v2
  `setup` that registers the tools via `ctx.tool.transform` and injects the
  prompt via `ctx.session.hook('prompt')`.

## Agent tools

The nine tools carry no embedded discipline of their own. The discipline is
carried by the skill and by a short reminder in the system prompt — the
reminder is fixed text, never register contents, because injecting changing bytes
on every request would invalidate the provider prompt cache. The register is
fetched on demand through `decision-list`.

| Tool | Purpose |
|---|---|
| `decision-init` | Create the register (idempotent, never overwrites) |
| `decision-add` | Create a record (status `proposed`) |
| `decision-ratify` | `proposed` → `accepted` — owner act, never self-invoked |
| `decision-reject` | `proposed` → `rejected` |
| `decision-supersede` | Replace a record, preserving history |
| `decision-list` | List records, filter by status/type |
| `decision-query` | Orphans, or "what links to this record" |
| `decision-validate` | Validate the register against the schema |
| `decision-view` | Regenerate the markdown view |

## Configuration

By default the plugin is inert: it registers its nine tools and does nothing
else. Enabling it turns on the always-available reminder, the interview
discipline, and — on v2 — the self-registered skill.

```jsonc
// in your OpenCode config
{
  "decision-layer": { "enabled": true }
}
```

Two sources, merged **per key**, not per file:

| Source | Key it contributes |
|---|---|
| `<project>/opencode.json(c)` | both keys |
| `~/.config/opencode/opencode.jsonc` | `enabled` only |
| `<project>/.opencode/decision-layer.json` (deprecated) | both keys |

| Key | Meaning | Scope |
|---|---|---|
| `enabled` | turns the guidance on | **user** — safe to set globally |
| `registerPath` | where the register lives | **repository** — never read from the global file, or one path would apply to every repo on the machine |

Because precedence is per key, a project file that sets only `registerPath`
does not erase an `enabled` you set globally.

`OPENCODE_CONFIG` overrides the config root, either as a directory or as an
explicit file path.

A config file that exists but cannot be parsed is skipped with a `console.warn`
rather than failing silently — silent failure is the worst possible symptom of a
flag that defaults to off.

## Install

Add the plugin to your OpenCode config:

```jsonc
{
  "plugin": ["@digi4care/omo-slim-decision-layer@latest"]
}
```

OpenCode installs the plugin automatically from npm on the next start. To pin
a version, replace `@latest` with a specific version (e.g. `@0.2.1`).

**Local development.** For a local or private build, reference the build output
directly instead of a package name. The form depends on the host version:

- **OpenCode v1** (`@opencode-ai/plugin` 1.x) expects the bundle file:

  ```jsonc
  {
    "plugin": ["file:///absolute/path/to/node_modules/@digi4care/omo-slim-decision-layer/dist/index.js"]
  }
  ```

- **OpenCode v2** (`@opencode/plugin` 2.x) expects the directory:

  ```jsonc
  {
    "plugin": ["file:///absolute/path/to/node_modules/@digi4care/omo-slim-decision-layer/dist"]
  }
  ```

  Using the file path in v2 logs `configured plugin path must be a directory`
  and the plugin is not loaded.

`dist/index.js` is a single bundle; only `@opencode-ai/plugin` and `zod` are
external, so the host supplies those.

**If you use `min-release-age` in your npm config:** OpenCode's own installer
enforces it too. A freshly published version cannot be installed by OpenCode
until it is older than that many days. `min-release-age-exclude` helps for
direct `npm install` calls but **not** for OpenCode's bundled installer
(observed on OpenCode 1.18.35). Until the window passes, use the `file://`
form above that matches your host version, or install into the OpenCode package
cache yourself (`bun add <pkg>` in `~/.cache/opencode/packages/<pkg>@latest`).

## Development

```bash
bun install
bun test          # bun test
bun run typecheck # tsc --noEmit
bun run check     # biome
bun run release   # build + pack tgz into release/
```

## Author

**Chris Engelhard** — [chrisengelhard.nl](https://chrisengelhard.nl) —
[chris@chrisengelhard.nl](mailto:chris@chrisengelhard.nl) —
[@digi4care](https://github.com/digi4care)

## License

MIT
