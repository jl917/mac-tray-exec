// Command execution: background runs, Terminal.app runs and logging.

import * as fs from "fs";
import { spawn, spawnSync } from "child_process";
import { MenuItem, expandHome, cacheDir, logPath, itemLabel } from "./config";

function ensureDir(dir: string): void {
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
}

function ensureLogFile(): string {
  const path = logPath();
  const dir = path.substring(0, path.lastIndexOf("/"));
  ensureDir(dir);
  return path;
}

/**
 * Environment handed to the child. The command itself never sees the config
 * strings inline — they travel as variables so no quoting can be broken by a
 * label or path containing shell metacharacters.
 */
function childEnv(item: MenuItem, log: string): Record<string, string> {
  const label = itemLabel(item);
  const env: Record<string, string> = Object.assign({}, process.env);

  env["MTE_LOG"] = log;
  env["MTE_LABEL"] = label;
  env["MTE_CWD"] = item.cwd ? expandHome(item.cwd) : "";

  if (item.env) {
    const keys = Object.keys(item.env);
    for (let i = 0; i < keys.length; i++) env[keys[i]] = item.env[keys[i]];
  }
  return env;
}

/**
 * Build the `/bin/sh` program that runs one menu item's command.
 *
 * `toLog` sends the command's output to the log file — what a menu click
 * wants, since there is no terminal attached. The `run` subcommand passes
 * false so the user sees the output where they typed the command.
 */
function buildScript(item: MenuItem, toLog: boolean): string {
  const lines: string[] = [];
  const redirect = toLog ? ' >>"$MTE_LOG" 2>&1' : "";

  if (toLog) lines.push('echo "=== $MTE_LABEL @ $(date) ===" >>"$MTE_LOG" 2>&1');
  lines.push("{");
  lines.push('  if [ -n "$MTE_CWD" ]; then cd "$MTE_CWD" || exit 127; fi');
  lines.push("  " + (item.command || ""));
  lines.push("}" + redirect);
  lines.push("__mte_code=$?");
  lines.push("exit $__mte_code");
  return lines.join("\n");
}

let terminalScriptSeq = 0;

/** Drop `.command` scratch files older than an hour so the cache dir stays small. */
function pruneTerminalScripts(dir: string): void {
  const cutoff = Date.now() - 60 * 60 * 1000;
  let names: string[] = [];
  try {
    names = fs.readdirSync(dir) as string[];
  } catch (e) {
    return;
  }

  for (let i = 0; i < names.length; i++) {
    const name = names[i];
    if (name.indexOf("run-") !== 0) continue;
    if (name.lastIndexOf(".command") !== name.length - 8) continue;

    const full = dir + "/" + name;
    try {
      const stat = fs.statSync(full);
      if (stat.mtimeMs < cutoff) fs.unlinkSync(full);
    } catch (e) {
      // Ignore files that vanished or cannot be read.
    }
  }
}

/**
 * Run the item in a visible Terminal.app window. The command is written to a
 * temporary `.command` file and opened, which sidesteps the nested quoting
 * that an inline `osascript ... do script` would require.
 */
function runInTerminal(item: MenuItem, log: string): void {
  const dir = cacheDir();
  ensureDir(dir);
  pruneTerminalScripts(dir);

  terminalScriptSeq++;
  const path = dir + "/run-" + Date.now().toString() + "-" + terminalScriptSeq.toString() + ".command";

  const env = childEnv(item, log);
  const header: string[] = ["#!/bin/sh"];
  const keys = ["MTE_LOG", "MTE_LABEL", "MTE_CWD"];
  for (let i = 0; i < keys.length; i++) {
    header.push(keys[i] + "=" + JSON.stringify(env[keys[i]] || ""));
    header.push("export " + keys[i]);
  }
  if (item.env) {
    const extra = Object.keys(item.env);
    for (let i = 0; i < extra.length; i++) {
      header.push(extra[i] + "=" + JSON.stringify(item.env[extra[i]]));
      header.push("export " + extra[i]);
    }
  }
  header.push('if [ -n "$MTE_CWD" ]; then cd "$MTE_CWD" || exit 127; fi');
  header.push(item.command || "");

  fs.writeFileSync(path, header.join("\n") + "\n");
  fs.chmodSync(path, 0o755);

  const child = spawn("/usr/bin/open", ["-a", "Terminal", path], {
    detached: true,
    stdio: "ignore",
  });
  child.unref();
}

/**
 * Execute a menu item's command. Returns immediately — the command runs in a
 * detached child so a long-running task never blocks the menu bar.
 */
export function runItem(item: MenuItem): void {
  if (!item.command || item.command === "") return;

  const log = ensureLogFile();

  if (item.terminal === true) {
    runInTerminal(item, log);
    return;
  }

  const script = buildScript(item, true);
  const child = spawn("/bin/sh", ["-c", script], {
    detached: true,
    stdio: "ignore",
    env: childEnv(item, log),
  });
  child.unref();
}

/** Run an item synchronously and return its exit code. Used by the `run` subcommand. */
export function runItemForeground(item: MenuItem): number {
  if (!item.command || item.command === "") return 0;

  const log = ensureLogFile();
  const script = buildScript(item, false);
  const result = spawnSync("/bin/sh", ["-c", script], {
    env: childEnv(item, log),
    stdio: "inherit",
  });
  const status = result && typeof result.status === "number" ? result.status : 0;
  return status;
}
