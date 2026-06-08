import { load } from "cheerio";
import type { Session } from "./config.js";
import { BizneoClient } from "./client.js";

export type ChronoStatus = "working" | "paused" | "out";

export interface PauseReason {
  id: string;
  label: string;
}

export interface ChronoState {
  status: ChronoStatus;
  /** Fresh masked CSRF token from the form. */
  csrfToken: string;
  shiftId: string;
  kind: string;
  pauseReasons: PauseReason[];
  /** Value to submit to resume from a break (present only when paused). */
  resumeValue?: string;
  /** Clock-in / pause-start timestamp (wall-clock string from the timer). */
  since?: string;
  /** IANA time zone the `since` timestamp is expressed in. */
  timeZone?: string;
  /** Raw fields parsed from the form, for debugging / fallbacks. */
  fields: Record<string, string>;
}

function hubChronoPath(userId: string): string {
  return `/chrono/${userId}/hub_chrono`;
}

/** Fetch and parse the live chronometer fragment. */
export async function getState(client: BizneoClient, session: Session): Promise<ChronoState> {
  const html = await client.getHtml(hubChronoPath(session.userId));
  return parseChronoFragment(html);
}

export function parseChronoFragment(html: string): ChronoState {
  const $ = load(html);

  const fields: Record<string, string> = {};
  $("input, select, textarea").each((_, el) => {
    const name = $(el).attr("name");
    if (!name) return;
    fields[name] = $(el).attr("value") ?? "";
  });

  const csrfToken = fields["_csrf_token"] ?? $('meta[name="csrf"]').attr("content") ?? "";
  const shiftId = fields["shift_id"] ?? "";
  const kind = fields["kind"] || "rest";

  const pauseReasons: PauseReason[] = [];
  let resumeValue: string | undefined;
  $('button[name="pause"]').each((_, el) => {
    const value = $(el).attr("value");
    if (!value) return;
    const action = ($(el).attr("data-gtm-action") || "").toLowerCase();
    const text = $(el).text().trim();
    if (action.includes("stop rest") || /reanud|resume/i.test(text)) {
      resumeValue = value;
      return;
    }
    pauseReasons.push({ id: value, label: text || action || `Reason ${value}` });
  });

  const isPut = (fields["_method"] || "").toLowerCase() === "put";
  const hasStop = $('button[data-gtm-action="chrono stop"]').length > 0;

  let status: ChronoStatus;
  if (resumeValue) status = "paused";
  else if (isPut || hasStop || pauseReasons.length > 0) status = "working";
  else status = "out";

  const timerEl = $("[data-from]").first();
  const since = timerEl.attr("data-from")?.trim() || undefined;
  const timeZone = timerEl.attr("data-time-zone")?.trim() || undefined;

  return {
    status,
    csrfToken,
    shiftId,
    kind,
    pauseReasons,
    resumeValue,
    since,
    timeZone,
    fields,
  };
}

const CHRONO = "/chrono";

/** Clock in (start / resume work). POST /chrono */
export async function clockIn(client: BizneoClient, session: Session, state: ChronoState): Promise<ChronoState> {
  await client.submitForm(
    "POST",
    CHRONO,
    {
      _csrf_token: state.csrfToken,
      location_id: "",
      user_id: session.userId,
      shift_id: state.shiftId,
    },
    state.csrfToken,
  );
  return getState(client, session);
}

/** Finish work (clock out). PUT /chrono/{userId} without a pause reason. */
export async function finish(client: BizneoClient, session: Session, state: ChronoState, comment = ""): Promise<ChronoState> {
  await client.submitForm(
    "PUT",
    `${CHRONO}/${session.userId}`,
    {
      _method: "put",
      _csrf_token: state.csrfToken,
      location_id: "",
      shift_id: state.shiftId,
      kind: state.kind,
      comment,
    },
    state.csrfToken,
  );
  return getState(client, session);
}

/** Pause work with a reason. PUT /chrono/{userId} with pause=<reasonId>. */
export async function pause(client: BizneoClient, session: Session, state: ChronoState, reasonId: string, comment = ""): Promise<ChronoState> {
  await client.submitForm(
    "PUT",
    `${CHRONO}/${session.userId}`,
    {
      _method: "put",
      _csrf_token: state.csrfToken,
      location_id: "",
      shift_id: state.shiftId,
      kind: state.kind,
      comment,
      pause: reasonId,
    },
    state.csrfToken,
  );
  return getState(client, session);
}

/** Resume from a break. PUT /chrono/{userId} with pause=<resumeValue> and no kind. */
export async function resume(client: BizneoClient, session: Session, state: ChronoState): Promise<ChronoState> {
  if (!state.resumeValue) {
    throw new Error("No active break to resume.");
  }
  await client.submitForm(
    "PUT",
    `${CHRONO}/${session.userId}`,
    {
      _method: "put",
      _csrf_token: state.csrfToken,
      location_id: "",
      shift_id: state.shiftId,
      comment: "",
      pause: state.resumeValue,
    },
    state.csrfToken,
  );
  return getState(client, session);
}
