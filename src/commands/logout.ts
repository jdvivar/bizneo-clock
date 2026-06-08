import { clearSession, CONFIG_FILE } from "../config.js";

export async function logoutCommand(): Promise<void> {
  const removed = await clearSession();
  if (removed) {
    console.log(`✅ Logged out. Removed ${CONFIG_FILE}.`);
  } else {
    console.log("You were not logged in.");
  }
}
