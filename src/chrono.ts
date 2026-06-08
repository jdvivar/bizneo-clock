import { load } from "cheerio";
import type { Session } from "./config.js";
import { BizneoClient } from "./client.js";

export type ChronoStatus = "in" | "out";

export interface PauseReason {
  id: string;
  label: string;
}

export interface ChronoState {
  /** "in" = currently working (can pause/finish); "out" = not working (can clock in). */
  status: ChronoStatus;
  clockedIn: boolean;
  /** Fresh masked CSRF token from the form. */
  csrfToken: string;
  shiftId: string;
  kind: string;
  pauseReasons: PauseReason[];
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
  $('button[name="pause"]').each((_, el) => {
    const id = $(el).attr("value");
    if (!id) return;
    const label = $(el).text().trim() || $(el).attr("data-gtm-action") || `Reason ${id}`;
    pauseReasons.push({ id, label });
  });

  const hasStop = $('button[data-gtm-action="chrono stop"]').length > 0;
  const isPut = (fields["_method"] || "").toLowerCase() === "put";
  const clockedIn = isPut || hasStop || pauseReasons.length > 0;

  return {
    status: clockedIn ? "in" : "out",
    clockedIn,
    csrfToken,
    shiftId,
    kind,
    pauseReasons,
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
