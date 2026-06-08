import { loadSession, saveSession } from "./config.js";
import { BizneoClient } from "./client.js";

/** Load the saved session or exit with a helpful message. */
export async function requireClient(): Promise<BizneoClient> {
  const session = await loadSession();
  if (!session) {
    throw new Error("Not logged in. Run `bizneo-clock login` first.");
  }
  return new BizneoClient(session);
}

/** Persist the session if the server rotated its cookies during requests. */
export async function persistIfChanged(client: BizneoClient): Promise<void> {
  if (client.cookiesChanged) {
    await saveSession({ ...client.session, savedAt: new Date().toISOString() });
  }
}
