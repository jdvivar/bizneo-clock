import { requireClient, persistIfChanged } from "../context.js";
import { getState, clockIn, finish } from "../chrono.js";
import { formatStatus } from "../ui.js";

export async function clockInCommand(): Promise<void> {
  const client = await requireClient();
  let state = await getState(client, client.session);

  if (state.clockedIn) {
    console.log("Already clocked in — nothing to do.");
    console.log(formatStatus(state));
    await persistIfChanged(client);
    return;
  }

  state = await clockIn(client, client.session, state);
  await persistIfChanged(client);

  if (state.clockedIn) {
    console.log("✅ Clocked in.");
  } else {
    console.log("⚠️  Request sent, but you still appear clocked out. Check the Bizneo app.");
  }
  console.log(formatStatus(state));
}

export async function clockOutCommand(opts: { comment?: string }): Promise<void> {
  const client = await requireClient();
  let state = await getState(client, client.session);

  if (!state.clockedIn) {
    console.log("Already clocked out — nothing to do.");
    console.log(formatStatus(state));
    await persistIfChanged(client);
    return;
  }

  state = await finish(client, client.session, state, opts.comment ?? "");
  await persistIfChanged(client);

  if (!state.clockedIn) {
    console.log("✅ Clocked out.");
  } else {
    console.log("⚠️  Request sent, but you still appear clocked in. Check the Bizneo app.");
  }
  console.log(formatStatus(state));
}
