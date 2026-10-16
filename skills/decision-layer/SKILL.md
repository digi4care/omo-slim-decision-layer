---
name: decision-layer
description: Discipline for the decision-layer plugin's decision register. Use when working in a repo that has .decisions/register.yaml — when recording requirements, constraints, assumptions or decisions, when referencing existing records, or when an interview produces a decision. Triggers - decision record, decision register, beslissing vastleggen, .decisions, design.yaml alternative, interview outcome.
---

# decision-layer discipline

The register at `.decisions/register.yaml` is the single source of truth for
*why* a project is built the way it is: requirements (REQ), non-negotiables
(CONSTRAINT), unverified assumptions (ASSUMPTION) and decisions (DEC).

## Rules

1. **One write-source.** Records are written only through the `decision-*`
   tools. Never edit `register.yaml` by hand. Never write a second set of
   files next to the register. The markdown view under `.decisions/views/` is
   generated and disposable — never edit it, never treat it as truth.
2. **Validate after every change.** Run `decision-validate` after writing. A
   register that does not validate is an open error, not a done task.
3. **Never ratify yourself.** `decision-ratify` is only called when the user
   explicitly asks for it. Ratification is an owner act; there is no
   technical gate, the discipline is this rule.
4. **Supersede, don't edit.** To change a decision, call `decision-supersede`
   and create the new record. History stays append-only.
5. **Assumptions are records.** Anything you cannot verify is an ASSUMPTION
   record with `needed_to_close` — not a plausible sentence in prose.
   When that question is answered, close it with `decision-close`
   (`verified` or `refuted`). An open assumption is an open question in the
   register; a closed one is settled.
6. **Interviews end in records.** For promotion, only explicit candidates in
    the completed spec's `## Current spec` section are considered. Obtain user
    confirmation before promotion. Use a fenced `decision-record-proposals`
    YAML array; every entry has stable `key`, `type`, `title`, and `context`.
    DEC entries also require `decision`, `consequences`, and
    `alternatives_rejected`; ASSUMPTION entries require `needed_to_close`.
    Example:
    ```decision-record-proposals
    - key: chosen-approach
      type: DEC
      title: Use bounded promotion
      context: The interview established a need for explicit proposals.
      decision: Promote only confirmed entries.
      consequences: Entries remain proposed for owner review.
      alternatives_rejected:
        - alternative: Infer records from interview prose
          rejected_because: Prose is ambiguous.
    ```
    Call `decision-promote-interview` with the completed spec path to retry
    promotion; records are proposed, never ratified by promotion.
7. **Work stays in beads.** Records never carry work status. Link to beads
   issues by id, never duplicate lifecycle state.
8. **Hand off with choices.** When a scoped result is ready but the user's
   broader objective is still open, state what is established and what remains.
   Offer two or three concrete next actions, their costs or trade-offs, and one
   recommendation. Continue already-authorized work without asking again.
   Ask only for a new permission or decision that actually blocks progress;
   never turn a settled choice into another question. This is agent guidance,
   not a technical guarantee or an instruction to create records.
9. **Pause only dependent architecture work.** Before coding a structural
   boundary, data/interface contract, or hard-to-reverse choice, check source
   and register. If the determining decision is missing or merely proposed,
   pause only code that depends on it, explain concrete choices and costs, and
   ask the owner to decide and ratify through the decision tools. Continue
   independent work; other proposed records do not block by default. If the
   register is missing, ask before initializing it. This is an agent stop,
   not a universal technical gate.
10. **Use the bead as the work/evidence index.** For delegated or multi-round
    work, ask before `br init` if `.beads/` is missing. At bead creation include
    the spec/source path and relevant current register IDs with their statuses.
    After verification, add a comment with code and test paths, test command,
    result, and unknowns. Add a commit hash only after that commit exists.
    Find closed as well as open work with `br search '<record-id>' --all --json`.
    Mark retrospective reconstruction explicitly and never invent old evidence.
    Do not supersede an accepted record solely to add an administrative bead
    link; the register explains why, the bead tracks work and evidence, and Git
    shows what changed. These instructions do not create links automatically.

## Reference

Record shape and allowed values: `schema/register.schema.json`. Do not
enumerate record types or statuses from memory — read the schema.
