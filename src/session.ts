import { chromium, type Browser } from "playwright-core";
import type { Session } from "./config.js";

export interface LoginResult {
  cookies: Record<string, string>;
  userId: string;
  userAgent: string;
}

const CHANNELS = ["msedge", "chrome", "chromium"] as const;

async function launchBrowser(): Promise<Browser> {
  let lastError: unknown;
  for (const channel of CHANNELS) {
    try {
      // "chromium" channel falls back to a Playwright-managed build if present.
      const opts = channel === "chromium" ? { headless: false } : { channel, headless: false };
      return await chromium.launch(opts);
    } catch (err) {
      lastError = err;
    }
  }
  throw new Error(
    "Could not launch a browser. bizneo-clock uses your installed Microsoft Edge or Google Chrome for the SSO login. " +
      "Please install one of them and try again.\n" +
      `Underlying error: ${lastError instanceof Error ? lastError.message : String(lastError)}`,
  );
}

/**
 * Open a real browser at the company's Bizneo URL, let the user complete the
 * (Microsoft SSO) login, and capture the resulting session once they're in.
 */
export async function browserLogin(host: string, timeoutMs = 5 * 60 * 1000): Promise<LoginResult> {
  const base = `https://${host}`;
  const browser = await launchBrowser();
  try {
    const context = await browser.newContext();
    const page = await context.newPage();
    await page.goto(base + "/", { waitUntil: "domcontentloaded" });

    const userAgent = await page.evaluate(() => navigator.userAgent);

    const deadline = Date.now() + timeoutMs;
    let userId: string | null = null;

    while (Date.now() < deadline) {
      // Probe with the shared cookie jar without disturbing the user's page.
      try {
        const res = await context.request.get(base + "/", { timeout: 15000 });
        if (res.ok()) {
          const body = await res.text();
          const match = body.match(/\/chrono\/(\d+)\/hub_chrono/);
          if (match) {
            userId = match[1];
            break;
          }
        }
      } catch {
        // ignore transient errors while the user is still authenticating
      }
      await page.waitForTimeout(2000);
    }

    if (!userId) {
      throw new Error("Timed out waiting for login. Please run `bizneo-clock login` again and complete the sign-in.");
    }

    const all = await context.cookies(base);
    const cookies: Record<string, string> = {};
    for (const c of all) cookies[c.name] = c.value;

    if (!cookies["_hcmex_key"]) {
      throw new Error("Logged in but the session cookie was not found. Please try `bizneo-clock login` again.");
    }

    return { cookies, userId, userAgent };
  } finally {
    await browser.close();
  }
}

export function buildSession(host: string, result: LoginResult): Session {
  return {
    host,
    userId: result.userId,
    cookies: result.cookies,
    userAgent: result.userAgent,
    savedAt: new Date().toISOString(),
  };
}
