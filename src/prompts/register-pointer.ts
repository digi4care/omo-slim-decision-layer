/**
 * The always-available reminder.
 *
 * This string is deliberately FIXED. Nothing from the register is interpolated
 * into it: injecting changing bytes on every request would invalidate the
 * provider prompt cache, and cache breakpoints are a metered resource (the host
 * decrements a budget per `cache: {type:'ephemeral'}` marker), not a free hint.
 *
 * The register's contents are fetched on demand through `decision-list`.
 */
export const REGISTER_POINTER = `This project keeps a decision register. Before deciding, designing or changing behaviour, call \`decision-list\` (and \`decision-query\` when a record is named) to check what is already recorded. Do not change or add register records unless the user asks. When a determining architectural choice about structural boundaries, data/interface contracts, or hard-to-reverse behavior lacks an accepted decision record, pause only dependent code changes and ask the owner; continue independent work. Never ratify yourself. When a scoped result is reached but the user's broader objective remains open, do not stop at a status report: offer concrete next actions with costs and a recommendation. Continue already-authorized work; ask only when a new permission or decision is actually needed. Do not present this guidance as a technical gate.`;

export function pointerAlreadyPresent(lines: string[]): boolean {
  return lines.some((line) => line.includes(REGISTER_POINTER));
}
