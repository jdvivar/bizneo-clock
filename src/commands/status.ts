import { requireClient, persistIfChanged } from "../context.js";
import { getState } from "../chrono.js";
import { formatStatus, describeReasons } from "../ui.js";
import { elapsedSeconds } from "../time.js";

export async function statusCommand(opts: { json?: boolean }): Promise<void> {
  const client = await requireClient();
  const state = await getState(client, client.session);
  await persistIfChanged(client);

  if (opts.json) {
    console.log(
      JSON.stringify(
        {
          host: client.session.host,
          userId: client.session.userId,
          status: state.status,
          shiftId: state.shiftId,
          since: state.since ?? null,
          elapsedSeconds:
            state.status !== "out" && state.since
              ? elapsedSeconds(state.since, state.timeZone || Intl.DateTimeFormat().resolvedOptions().timeZone)
              : null,
          pauseReasons: state.pauseReasons,
        },
        null,
        2,
      ),
    );
    return;
  }

  console.log(formatStatus(state));
  console.log(`Company: ${client.session.host}  ·  Employee: ${client.session.userId}`);
  if (state.status === "working" && state.pauseReasons.length > 0) {
    console.log(`Pause reasons:\n  ${describeReasons(state.pauseReasons)}`);
  } else if (state.status === "paused") {
    console.log("Run `bizneo-clock resume` to get back to work.");
  }
}
