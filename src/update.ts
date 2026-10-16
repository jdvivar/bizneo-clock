import { readFileSync } from "node:fs";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { CONFIG_DIR } from "./config.js";

export const PACKAGE_NAME = "bizneo-clock";

export const currentVersion: string = (
  JSON.parse(readFileSync(new URL("../package.json", import.meta.url), "utf8")) as { version: string }
).version;

const CHECK_FILE = join(CONFIG_DIR, "update-check.json");
const CHECK_INTERVAL_MS = 24 * 60 * 60 * 1000;
const CHECK_TIMEOUT_MS = 3000;
const GRACE_AFTER_COMMAND_MS = 300;

interface CheckCache {
  checkedAt: number;
  latest: string;
}

function registryUrl(): string {
  const base = (process.env.npm_config_registry || "https://registry.npmjs.org").replace(/\/+$/, "");
  return `${base}/${PACKAGE_NAME}/latest`;
}

export function compareVersions(a: string, b: string): number {
  const parse = (v: string) => v.replace(/^v/, "").split(/[-+]/)[0].split(".").map((n) => Number.parseInt(n, 10) || 0);
  const pa = parse(a);
  const pb = parse(b);
  for (let i = 0; i < Math.max(pa.length, pb.length); i++) {
    const diff = (pa[i] ?? 0) - (pb[i] ?? 0);
    if (diff !== 0) return diff < 0 ? -1 : 1;
  }
  return 0;
}

export async function fetchLatestVersion(signal: AbortSignal): Promise<string | null> {
  try {
    const res = await fetch(registryUrl(), { signal, headers: { accept: "application/json" } });
    if (!res.ok) return null;
    const body = (await res.json()) as { version?: unknown };
    return typeof body.version === "string" ? body.version : null;
  } catch {
    return null;
  }
}

async function readCache(): Promise<CheckCache | null> {
  try {
    const cache = JSON.parse(await readFile(CHECK_FILE, "utf8")) as Partial<CheckCache>;
    if (typeof cache.checkedAt === "number" && typeof cache.latest === "string") {
      return { checkedAt: cache.checkedAt, latest: cache.latest };
    }
  } catch {
    return null;
  }
  return null;
}

export async function saveLatestVersion(latest: string): Promise<void> {
  try {
    await mkdir(CONFIG_DIR, { recursive: true, mode: 0o700 });
    await writeFile(CHECK_FILE, JSON.stringify({ checkedAt: Date.now(), latest } satisfies CheckCache), { mode: 0o600 });
  } catch {
    return;
  }
}

function updateCheckEnabled(argv: string[]): boolean {
  const env = process.env;
  if (env.BIZNEO_CLOCK_NO_UPDATE_CHECK || env.NO_UPDATE_NOTIFIER || env.CI) return false;
  if (!process.stderr.isTTY) return false;
  if (argv.includes("--json")) return false;
  return true;
}

export interface UpdateCheck {
  finish(): Promise<void>;
}

export function startUpdateCheck(argv: string[]): UpdateCheck {
  if (!updateCheckEnabled(argv)) return { finish: async () => {} };

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), CHECK_TIMEOUT_MS).unref();
  const cached = readCache();
  const result = (async (): Promise<string | null> => {
    const cache = await cached;
    if (cache && Date.now() - cache.checkedAt < CHECK_INTERVAL_MS) return cache.latest;
    const latest = await fetchLatestVersion(controller.signal);
    if (latest) {
      await saveLatestVersion(latest);
      return latest;
    }
    return cache?.latest ?? null;
  })();

  return {
    async finish() {
      const latest =
        (await Promise.race([
          result,
          new Promise<null>((resolve) => setTimeout(() => resolve(null), GRACE_AFTER_COMMAND_MS).unref()),
        ])) ?? (await cached)?.latest;
      clearTimeout(timer);
      controller.abort();
      if (latest && compareVersions(latest, currentVersion) > 0) {
        console.error(`\nUpdate available: ${currentVersion} → ${latest} · run \`${PACKAGE_NAME} upgrade\``);
      }
    },
  };
}
