#!/usr/bin/env node
import { Command } from "commander";
import { SessionExpiredError } from "./client.js";
import { loginCommand } from "./commands/login.js";
import { logoutCommand } from "./commands/logout.js";
import { statusCommand } from "./commands/status.js";
import { clockInCommand, clockOutCommand } from "./commands/clock.js";
import { pauseCommand } from "./commands/pause.js";

/** Wrap a command so errors print cleanly and set a non-zero exit code. */
function run<T extends unknown[]>(fn: (...args: T) => Promise<void>) {
  return async (...args: T): Promise<void> => {
    try {
      await fn(...args);
    } catch (err) {
      if (err instanceof SessionExpiredError) {
        console.error(`\n${err.message}`);
      } else if (err instanceof Error) {
        // Swallow the inquirer "user force closed" noise on Ctrl-C.
        if (err.name === "ExitPromptError") process.exit(130);
        console.error(`\nError: ${err.message}`);
      } else {
        console.error("\nUnexpected error:", err);
      }
      process.exitCode = 1;
    }
  };
}

const program = new Command();

program
  .name("bizneo-clock")
  .description("Clock in/out of Bizneo HR (chrono) from your terminal")
  .version("0.1.0");

program
  .command("login")
  .description("Sign in via your browser and capture the session")
  .option("-c, --company <subdomain>", "company subdomain (e.g. ctaima) or full Bizneo host")
  .action(run(loginCommand));

program
  .command("logout")
  .description("Remove the stored session")
  .action(run(logoutCommand));

program
  .command("status")
  .description("Show whether you're currently clocked in")
  .option("--json", "output machine-readable JSON")
  .action(run(statusCommand));

program
  .command("in")
  .aliases(["start", "resume"])
  .description("Clock in (start or resume work)")
  .action(run(clockInCommand));

program
  .command("out")
  .aliases(["finish", "stop"])
  .description("Clock out (finish work)")
  .option("--comment <text>", "optional comment")
  .action(run(clockOutCommand));

program
  .command("pause")
  .description("Pause work with a reason (lunch, break, …)")
  .option("-r, --reason <idOrIndex>", "pause reason id or list position")
  .option("--comment <text>", "optional comment")
  .action(run(pauseCommand));

program.parseAsync(process.argv);
