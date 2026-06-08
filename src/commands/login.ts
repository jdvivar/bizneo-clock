import { input } from "@inquirer/prompts";
import { saveSession, CONFIG_FILE } from "../config.js";
import { browserLogin, buildSession } from "../session.js";

function normalizeHost(value: string): string {
  let host = value.trim().toLowerCase();
  host = host.replace(/^https?:\/\//, "").replace(/\/.*$/, "");
  if (!host.includes(".")) host = `${host}.bizneohr.com`;
  return host;
}

export async function loginCommand(opts: { company?: string }): Promise<void> {
  const companyRaw =
    opts.company ??
    (await input({
      message: "Company subdomain (e.g. ctaima) or full Bizneo host:",
      validate: (v) => (v.trim().length > 0 ? true : "Please enter your company subdomain"),
    }));

  const host = normalizeHost(companyRaw);

  console.log(`\nOpening a browser at https://${host}/ …`);
  console.log("Sign in normally (Microsoft SSO is fine). I'll detect when you're in and capture the session.\n");

  const result = await browserLogin(host);
  const session = buildSession(host, result);
  await saveSession(session);

  console.log(`✅ Logged in to ${host} as employee ${session.userId}.`);
  console.log(`   Session saved to ${CONFIG_FILE} (valid ~30 days, auto-renews on use).`);
}
