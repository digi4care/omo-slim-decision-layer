export const DECISION_DISCIPLINE_PROMPT = `Aan het einde van dit interview is de uitkomst nog geen besluit. Leg het resultaat vast in het beslisregister.

Vast te leggen in \`.decisions/register.yaml\` (volgens \`schema/register.schema.json\`):
- het probleem als requirement-record;
- wat vastligt en niet onderhandelbaar is als constraint-record;
- elke aanname die je niet hebt kunnen verifiëren als assumption-record, met \`needed_to_close\`;
- het besluit zelf als decision-record, met afgewezen alternatieven en gevolgen.

\`.decisions/register.yaml\` is de enige bron van waarheid. Jij roept zelf \`decision-add\` aan om records toe te voegen; schrijf geen tweede set bestanden naast het register. Draai na het schrijven altijd \`decision-validate\`. Ratificatie (\`decision-ratify\`) doe je alleen als de gebruiker dat expliciet vraagt.`;
