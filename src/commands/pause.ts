import { requireClient, persistIfChanged } from "../context.js";
import { getState, pause } from "../chrono.js";
import { formatStatus, resolveReason } from "../ui.js";

export async function pauseCommand(opts: { reason?: string; comment?: string }): Promise<void> {
  const client = await requireClient();
  let state = await getState(client, client.session);

  if (!state.clockedIn) {
    console.log("You're not clocked in, so there's nothing to pause. Use `bizneo-clock in` first.");
    console.log(formatStatus(state));
    await persistIfChanged(client);
    return;
  }

  const reason = await resolveReason(state.pauseReasons, opts.reason);
  if (!reason) {
    console.log("No pause reasons are available for your company. Use `bizneo-clock out` to clock out instead.");
    await persistIfChanged(client);
    return;
  }

  state = await pause(client, client.session, state, reason.id, opts.comment ?? "");
  await persistIfChanged(client);

  console.log(`✅ Paused (${reason.label}).`);
  console.log(formatStatus(state));
}
