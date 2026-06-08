import { homedir } from "node:os";
import { join } from "node:path";
import { mkdir, readFile, writeFile, rm } from "node:fs/promises";

export interface Session {
  /** Company host, e.g. "ctaima.bizneohr.com" */
  host: string;
  /** Employee id used in the chrono routes, e.g. "18496179" */
  userId: string;
  /** Auth cookies captured from the browser (_hcmex_key, device_id, ...) */
  cookies: Record<string, string>;
  /** User-agent the session was created with, replayed on every request */
  userAgent: string;
  /** ISO timestamp of when the session was saved */
  savedAt: string;
}

const CONFIG_DIR = process.env.XDG_CONFIG_HOME
  ? join(process.env.XDG_CONFIG_HOME, "bizneo-clock")
  : join(homedir(), ".config", "bizneo-clock");

export const CONFIG_FILE = join(CONFIG_DIR, "config.json");

export async function loadSession(): Promise<Session | null> {
  try {
    const raw = await readFile(CONFIG_FILE, "utf8");
    return JSON.parse(raw) as Session;
  } catch {
    return null;
  }
}

export async function saveSession(session: Session): Promise<void> {
  await mkdir(CONFIG_DIR, { recursive: true, mode: 0o700 });
  await writeFile(CONFIG_FILE, JSON.stringify(session, null, 2), { mode: 0o600 });
}

export async function clearSession(): Promise<boolean> {
  try {
    await rm(CONFIG_FILE);
    return true;
  } catch {
    return false;
  }
}
