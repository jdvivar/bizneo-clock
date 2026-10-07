import { requireClient, persistIfChanged } from "../context.js";
import { getState, clockIn, finish, resume } from "../chrono.js";
import { formatStatus } from "../ui.js";

export async function clockInCommand(): Promise<void> {
  const client = await requireClient();
  let state = await getState(client, client.session);

  if (state.status === "working") {
    console.log("Already clocked in — nothing to do.");
    console.log(formatStatus(state));
    await persistIfChanged(client);
    return;
  }
  if (state.status === "paused") {
    console.log("You're on a break — use `bizneo-clock resume` to get back to work.");
    console.log(formatStatus(state));
    await persistIfChanged(client);
    process.exitCode = 1;
    return;
  }

  state = await clockIn(client, client.session, state);
  await persistIfChanged(client);

  if (state.status === "working") {
    console.log("✅ Clocked in.");
  } else {
    console.log("⚠️  Request sent, but you still appear clocked out. Check the Bizneo app.");
    process.exitCode = 1;
  }
  console.log(formatStatus(state));
}

export async function clockOutCommand(opts: { comment?: string }): Promise<void> {
  const client = await requireClient();
  let state = await getState(client, client.session);

  if (state.status === "out") {
    console.log("Already clocked out — nothing to do.");
    console.log(formatStatus(state));
    await persistIfChanged(client);
    return;
  }
  if (state.status === "paused") {
    state = await resume(client, client.session, state);
    if (state.status !== "working") {
      await persistIfChanged(client);
      console.log("⚠️  Couldn't end your break before clocking out. Check the Bizneo app.");
      console.log(formatStatus(state));
      process.exitCode = 1;
      return;
    }
    console.log("Ended your break.");
  }

  state = await finish(client, client.session, state, opts.comment ?? "");
  await persistIfChanged(client);

  if (state.status === "out") {
    console.log("✅ Clocked out.");
  } else {
    console.log("⚠️  Request sent, but you still appear clocked in. Check the Bizneo app.");
    process.exitCode = 1;
  }
  console.log(formatStatus(state));
}

export async function resumeCommand(): Promise<void> {
  const client = await requireClient();
  let state = await getState(client, client.session);

  if (state.status === "working") {
    console.log("Already working — nothing to resume.");
    console.log(formatStatus(state));
    await persistIfChanged(client);
    return;
  }

  state = state.status === "paused" ? await resume(client, client.session, state) : await clockIn(client, client.session, state);
  await persistIfChanged(client);

  if (state.status === "working") {
    console.log("✅ Back to work.");
  } else {
    console.log("⚠️  Request sent, but you're not working yet. Check the Bizneo app.");
    process.exitCode = 1;
  }
  console.log(formatStatus(state));
}
