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
- **Closed assumptions** — an `ASSUMPTION` has a question in `needed_to_close`
  but no field for the answer. `decision-close` supplies it: `verified` or
  `refuted`, plus an optional reason, moving the record to `accepted`.
- **Single source of truth** — one YAML register at `.decisions/register.yaml`.
  All writes go through the plugin's tools; the generated markdown view is
  disposable and never authoritative.
- **Closed vocabularies** — status is `proposed | accepted | rejected |
  superseded`. Supersede instead of edit: history stays append-only.
- **Owner ratification** — agents draft records; only the owner ratifies.
  This is a convention enforced by discipline, not by a technical gate.
- **Interview integration (opt-in)** — a completed interview can be promoted
  only from explicit typed `decision-record-proposals` YAML inside `## Current
  spec`. The post-completion bridge requires a compatible interview host in the
  same JavaScript realm; this integration has not yet been live-verified.
  Missing registers and other unresolved conflicts return `needs-review`; the
  plugin never initializes a register or ratifies/rejects proposals.
- **Skill availability** — on OpenCode v2 the plugin registers its own
  `skills/decision-layer/SKILL.md` at startup via `ctx.skill.transform`, so the
  discipline is loaded automatically without a separate install step. OpenCode
  v1 has no `skill.transform`; installing the skill to
  `~/.config/opencode/skills/decision-layer/` is not yet implemented.

- **Availability** — the reminder only fires when `.decisions/register.yaml`
  actually exists on disk, so it never claims a register that isn't there. Run
  `decision-init` once per project to turn it on for that project.
- **Compatibility**

One package, two registration paths, sharing the same register and tool logic:

- **v1** (`@opencode-ai/plugin` 1.x): the default export provides a v1 `server`
  that registers the ten tools, the `command.execute.before` hook, and the
  prompt reminder via `experimental.chat.system.transform`.
- **v2** (`@opencode/plugin` 2.x): the same default export also provides a v2
  `setup` that registers the tools via `ctx.tool.transform`, injects the
  prompt via `ctx.session.hook('prompt')`, and the reminder via
  `ctx.session.hook('context')`.

## Agent tools

The ten tools carry no embedded discipline of their own. The discipline is
carried by the skill and by a short reminder in the system prompt — the
reminder is fixed text, never register contents, because injecting changing bytes
on every request would invalidate the provider prompt cache. The register is
fetched on demand through `decision-list`.
For enabled projects with a register, the reminder also asks the agent to
recommend concrete next actions when a scoped result leaves the larger task
unfinished. This is prompt guidance, not enforced host behavior; it does not
start `/implement`, change records, or apply where the reminder is disabled.
The same guidance asks agents to pause only code dependent on an unaccepted
determining architecture decision, while independent work may continue. It
cannot detect such decisions or enforce that pause for every execution path.

| Tool | Purpose |
|---|---|
| `decision-init` | Create the register (idempotent, never overwrites) |
| `decision-add` | Create a record (status `proposed`) |
| `decision-ratify` | `proposed` → `accepted` — owner act, never self-invoked |
| `decision-reject` | `proposed` → `rejected` |
| `decision-supersede` | Replace a record, preserving history |
| `decision-close` | Close an `ASSUMPTION` with `verified` or `refuted` |
| `decision-list` | List records, filter by status/type |
| `decision-query` | Orphans, or "what links to this record" |
| `decision-validate` | Validate the register against the schema |
| `decision-view` | Regenerate the markdown view |
| `decision-promote-interview` | Retry promotion from a completed spec; only explicit typed proposals in `## Current spec` are considered |

Proposal blocks use a fenced `decision-record-proposals` YAML array with stable
`key`, `type`, `title`, and `context`; type-specific fields follow the register
schema. A completed interview that returns `needs-review` can be retried with
`decision-promote-interview` or `/implement`. Normal-chat reminders are
read-only and do not instruct agents to write records.

## Configuration

By default the plugin is inert: it registers its ten tools and does nothing
else. Enabling it turns on the always-available reminder, the interview
discipline, and — on v2 — the self-registered skill.

```jsonc
// in your OpenCode config
{
  "decision-layer": {
    "enabled": true,
    "requireBeadsForDelegation": true
  }
}
```

Two sources, merged **per key**, not per file:

| Source | Keys it contributes |
|---|---|
| `<project>/opencode.json(c)` | all four |
| `~/.config/opencode/opencode.jsonc` | `enabled`, `log` |
| `<project>/.opencode/decision-layer.json` (deprecated) | all four |

| Key | Meaning | Scope |
|---|---|---|
| `enabled` | turns the guidance on | **user** — safe to set globally |
| `log` | append one line per session to `.decisions/activation.log` | **user** — a debugging aid, off by default; gitignore the log |
| `registerPath` | where the register lives | **repository** — never read from the global file, or one path would apply to every repo on the machine |
| `requireBeadsForDelegation` | require a project `.beads/` directory before known delegation tool calls | **repository** — project-only, defaults to `false` |

Set both `enabled` and `requireBeadsForDelegation` in a project's config to opt
in; reload OpenCode after enabling. This checks known `task` (v1) and `subagent`
(v2) tool calls only. It is not a universal gate for OMO commands, multi-round
delegation, or architecture decisions.

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
