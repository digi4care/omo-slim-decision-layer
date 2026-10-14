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
6. **Interviews end in records.** When an `/interview` closes, record the
   outcome: the problem (REQ), what is fixed (CONSTRAINT), unverified
   assumptions (ASSUMPTION), and the decision (DEC with alternatives and
   consequences). Call `decision-add` yourself; the plugin only reminds you.
7. **Work stays in beads.** Records never carry work status. Link to beads
   issues by id, never duplicate lifecycle state.

## Reference

Record shape and allowed values: `schema/register.schema.json`. Do not
enumerate record types or statuses from memory — read the schema.
