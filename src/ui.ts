import { select } from "@inquirer/prompts";
import type { ChronoState, PauseReason } from "./chrono.js";

export function formatStatus(state: ChronoState): string {
  if (state.clockedIn) {
    return "🟢 Clocked IN (working)";
  }
  return "⚪ Clocked OUT (not working)";
}

export function describeReasons(reasons: PauseReason[]): string {
  if (reasons.length === 0) return "(none configured)";
  return reasons.map((r, i) => `${i + 1}. ${r.label} (id ${r.id})`).join("\n  ");
}

/**
 * Resolve a pause reason from a flag (id or 1-based index) or interactively.
 * Returns null if there are no reasons available.
 */
export async function resolveReason(reasons: PauseReason[], flag?: string): Promise<PauseReason | null> {
  if (reasons.length === 0) return null;

  if (flag) {
    const byId = reasons.find((r) => r.id === flag);
    if (byId) return byId;
    const idx = Number.parseInt(flag, 10);
    if (Number.isInteger(idx) && idx >= 1 && idx <= reasons.length) return reasons[idx - 1];
    throw new Error(`Unknown pause reason "${flag}". Available:\n  ${describeReasons(reasons)}`);
  }

  if (reasons.length === 1) return reasons[0];

  const id = await select({
    message: "Pause reason:",
    choices: reasons.map((r) => ({ name: r.label, value: r.id })),
  });
  return reasons.find((r) => r.id === id) ?? null;
}
