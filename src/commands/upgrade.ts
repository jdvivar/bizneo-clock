import { execFileSync, spawnSync } from "node:child_process";
import { readFileSync, realpathSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { PACKAGE_NAME, compareVersions, currentVersion, fetchLatestVersion, saveLatestVersion } from "../update.js";

const NPM = process.platform === "win32" ? "npm.cmd" : "npm";

function globalNpmPackageDir(): string | null {
  try {
    const root = execFileSync(NPM, ["root", "-g"], {
      encoding: "utf8",
      stdio: ["ignore", "pipe", "ignore"],
      shell: process.platform === "win32",
    }).trim();
    return realpathSync(join(root, PACKAGE_NAME));
  } catch {
    return null;
  }
}

function runningPackageDir(): string {
  return realpathSync(fileURLToPath(new URL("../..", import.meta.url)));
}

function installedVersion(dir: string): string | null {
  try {
    return (JSON.parse(readFileSync(join(dir, "package.json"), "utf8")) as { version?: string }).version ?? null;
  } catch {
    return null;
  }
}

export async function upgradeCommand(): Promise<void> {
  const latest = await fetchLatestVersion(AbortSignal.timeout(15000));
  if (!latest) {
    throw new Error("Couldn't reach the npm registry to check for a new version. Check your connection and try again.");
  }
  await saveLatestVersion(latest);

  if (compareVersions(latest, currentVersion) <= 0) {
    console.log(`✅ Already up to date (${currentVersion}).`);
    return;
  }

  const here = runningPackageDir();
  const globalDir = globalNpmPackageDir();
  if (!globalDir || globalDir !== here) {
    console.log(`A new version is available: ${currentVersion} → ${latest}.`);
    console.log(`This copy (${here}) isn't a global npm install, so it can't update itself.`);
    console.log(`Update it the way you installed it, e.g.  npm install -g ${PACKAGE_NAME}@latest`);
    process.exitCode = 1;
    return;
  }

  console.log(`Updating ${PACKAGE_NAME} ${currentVersion} → ${latest} …\n`);
  const result = spawnSync(NPM, ["install", "-g", `${PACKAGE_NAME}@${latest}`], {
    stdio: "inherit",
    shell: process.platform === "win32",
  });

  if (result.status !== 0) {
    console.error(`\nnpm install failed${result.status != null ? ` (exit ${result.status})` : ""}.`);
    console.error(
      "If it's a permissions error (EACCES), your global npm folder needs elevated rights: " +
        "https://docs.npmjs.com/resolving-eacces-permissions-errors-when-installing-packages-globally",
    );
    process.exitCode = 1;
    return;
  }

  const now = installedVersion(globalDir);
  if (now && compareVersions(now, latest) >= 0) {
    console.log(`\n✅ Updated ${currentVersion} → ${now}.`);
  } else {
    console.log(`\n⚠️  npm finished, but the installed version is ${now ?? "unknown"}. Run \`${PACKAGE_NAME} --version\` to check.`);
    process.exitCode = 1;
  }
}
