// Menu configuration: schema, path resolution, loading and defaults.

import * as fs from "fs";

export interface MenuItem {
  /** Text shown in the menu. Required unless `type` is "separator". */
  label?: string;
  /** "separator" draws a divider line. Anything else is a normal item. */
  type?: string;
  /** Shell command executed by `/bin/sh -c` when the item is clicked. */
  command?: string;
  /** Working directory for the command. `~` is expanded. */
  cwd?: string;
  /** Extra environment variables handed to the command. */
  env?: Record<string, string>;
  /** Shortcut shown in the menu, e.g. "cmd+b". Only fires while the menu is open. */
  shortcut?: string;
  /** System-wide hotkey, e.g. "cmd+shift+b". Works even when the app is in the background. */
  hotkey?: string;
  /** Run the command in a visible Terminal.app window instead of in the background. */
  terminal?: boolean;
  /** Ask for confirmation before running. */
  confirm?: boolean;
  /** Nested items. Turns this entry into a submenu. */
  items?: MenuItem[];
}

export interface TrayConfig {
  /** Path to a PNG/.icns file for the menu-bar icon. Empty uses the built-in placeholder. */
  icon?: string;
  /** Tooltip shown when hovering the icon. */
  tooltip?: string;
  items: MenuItem[];
}

export const APP_NAME = "mac-tray-exec";

/** Expand a leading `~` to the user's home directory. */
export function expandHome(p: string): string {
  const home = process.env.HOME || "";
  if (p === "~") return home;
  if (p.indexOf("~/") === 0) return home + p.substring(1);
  return p;
}

export function configDir(): string {
  return expandHome("~/.config/" + APP_NAME);
}

export function defaultConfigPath(): string {
  return configDir() + "/menu.json";
}

export function cacheDir(): string {
  return expandHome("~/Library/Caches/" + APP_NAME);
}

export function logPath(): string {
  return expandHome("~/Library/Logs/" + APP_NAME + ".log");
}

/**
 * Config lookup order:
 *   1. explicit path (`--config`)
 *   2. $MAC_TRAY_EXEC_CONFIG
 *   3. ./menu.json in the current directory
 *   4. ~/.config/mac-tray-exec/menu.json
 * Returns an empty string when nothing exists yet.
 */
export function resolveConfigPath(explicit: string): string {
  if (explicit !== "") return expandHome(explicit);

  const fromEnv = process.env.MAC_TRAY_EXEC_CONFIG || "";
  if (fromEnv !== "") return expandHome(fromEnv);

  const local = process.cwd() + "/menu.json";
  if (fs.existsSync(local)) return local;

  const user = defaultConfigPath();
  if (fs.existsSync(user)) return user;

  return "";
}

export function defaultConfig(): TrayConfig {
  return {
    tooltip: APP_NAME,
    items: [
      { label: "크롬 열기", command: "open -a 'Google Chrome'" },
      { label: "Notion 열기", command: "open -a Notion" },
      { type: "separator" },
      { label: "Finder에서 홈 열기", command: "open ~" },
      { label: "터미널 열기", command: "open -a Terminal ~" },
      { type: "separator" },
      {
        label: "예제",
        items: [
          { label: "날짜 기록", command: "date" },
          { label: "터미널에서 실행", command: "ls -la ~", terminal: true },
          { label: "확인 후 실행", command: "say done", confirm: true },
        ],
      },
    ],
  };
}

function ensureDir(dir: string): void {
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
}

/** Write the starter config to ~/.config/mac-tray-exec/menu.json and return its path. */
export function writeDefaultConfig(): string {
  const path = defaultConfigPath();
  ensureDir(configDir());
  fs.writeFileSync(path, JSON.stringify(defaultConfig(), null, 2) + "\n");
  return path;
}

export interface LoadResult {
  config: TrayConfig;
  path: string;
  error: string;
}

/** Read and parse the config file. On failure `error` is non-empty and a safe fallback is returned. */
export function loadConfig(explicit: string): LoadResult {
  let path = resolveConfigPath(explicit);

  if (path === "") {
    path = writeDefaultConfig();
    return { config: defaultConfig(), path: path, error: "" };
  }

  if (!fs.existsSync(path)) {
    return { config: { items: [] }, path: path, error: "설정 파일이 없습니다: " + path };
  }

  let raw = "";
  try {
    raw = fs.readFileSync(path, "utf8").toString();
  } catch (e) {
    return { config: { items: [] }, path: path, error: "설정 파일을 읽을 수 없습니다: " + path };
  }

  let parsed: TrayConfig;
  try {
    parsed = JSON.parse(raw) as TrayConfig;
  } catch (e) {
    return { config: { items: [] }, path: path, error: "JSON 파싱 실패: " + path };
  }

  if (!parsed || !parsed.items || !Array.isArray(parsed.items)) {
    return { config: { items: [] }, path: path, error: "설정에 items 배열이 없습니다: " + path };
  }

  return { config: parsed, path: path, error: "" };
}

export function isSeparator(item: MenuItem): boolean {
  return item.type === "separator";
}

export function itemLabel(item: MenuItem): string {
  return item.label || "(제목 없음)";
}
