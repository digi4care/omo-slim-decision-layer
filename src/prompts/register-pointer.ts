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
export const REGISTER_POINTER = `This project keeps a decision register. Before deciding, designing or changing behaviour, call \`decision-list\` (and \`decision-query\` when a record is named) to check what is already recorded. Do not change or add register records unless the user asks.`;

export function pointerAlreadyPresent(lines: string[]): boolean {
  return lines.some((line) => line.includes(REGISTER_POINTER));
}
