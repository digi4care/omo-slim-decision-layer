export const DECISION_DISCIPLINE_PROMPT = `At the end of this interview, the outcome is not yet a decision. Record it in the decision register.

Record in \`.decisions/register.yaml\` (following \`schema/register.schema.json\`):
- the problem as a requirement record;
- what is fixed and non-negotiable as a constraint record;
- every assumption you could not verify as an assumption record, with \`needed_to_close\`;
- the decision itself as a decision record, with rejected alternatives and consequences.

\`.decisions/register.yaml\` is the single source of truth. You call \`decision-add\` yourself to add records; do not write a second set of files next to the register. Always run \`decision-validate\` after writing. Only ratify (\`decision-ratify\`) when the user explicitly asks you to.`;
