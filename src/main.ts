// mac-tray-exec — a macOS menu-bar app that runs shell commands from a
// user-defined menu. Built with Perry (native TypeScript).

import type { Widget } from "perry/ui";
import {
  App,
  VStack,
  Text,
  appSetActivationPolicy,
  trayCreate,
  traySetIcon,
  traySetTooltip,
  trayAttachMenu,
  menuCreate,
  menuAddItem,
  menuAddItemWithShortcut,
  menuAddSeparator,
  menuAddSubmenu,
  menuClear,
  alert,
  alertWithButtons,
  registerGlobalHotkey,
} from "perry/ui";
import { spawn } from "child_process";

import {
  MenuItem,
  TrayConfig,
  APP_NAME,
  expandHome,
  logPath,
  loadConfig,
  writeDefaultConfig,
  resolveConfigPath,
  isSeparator,
  itemLabel,
} from "./config";
import { runItem, runItemForeground } from "./runner";

// ---------------------------------------------------------------------------
// Hotkeys
// ---------------------------------------------------------------------------

const MOD_CMD = 1;
const MOD_SHIFT = 2;
const MOD_ALT = 4;
const MOD_CTRL = 8;

interface Hotkey {
  ok: boolean;
  key: string;
  modifiers: number;
}

/** Parse "cmd+shift+b" into the key name plus a modifier bitfield. */
function parseHotkey(spec: string): Hotkey {
  const parts = spec.split("+");
  let modifiers = 0;
  let key = "";

  for (let i = 0; i < parts.length; i++) {
    const token = parts[i].trim().toLowerCase();
    if (token === "") continue;

    if (token === "cmd" || token === "command" || token === "meta") modifiers |= MOD_CMD;
    else if (token === "shift") modifiers |= MOD_SHIFT;
    else if (token === "alt" || token === "opt" || token === "option") modifiers |= MOD_ALT;
    else if (token === "ctrl" || token === "control") modifiers |= MOD_CTRL;
    else key = token;
  }

  if (key === "") return { ok: false, key: "", modifiers: 0 };
  // The macOS backend matches on the uppercase key name ("B", "F8").
  return { ok: true, key: key.toUpperCase(), modifiers: modifiers };
}

// ---------------------------------------------------------------------------
// Menu construction
// ---------------------------------------------------------------------------

/** Ask before running when `confirm: true`, otherwise run straight away. */
function activate(item: MenuItem): void {
  if (item.confirm === true) {
    alertWithButtons(itemLabel(item), item.command || "", ["실행", "취소"], (index: number) => {
      if (index === 0) runItem(item);
    });
    return;
  }
  runItem(item);
}

function addItems(menu: Widget, items: MenuItem[]): void {
  for (let i = 0; i < items.length; i++) {
    const item = items[i];

    if (isSeparator(item)) {
      menuAddSeparator(menu);
      continue;
    }

    if (item.items && item.items.length > 0) {
      const submenu = menuCreate();
      addItems(submenu, item.items);
      menuAddSubmenu(menu, itemLabel(item), submenu);
      continue;
    }

    const label = itemLabel(item);
    const captured = item;

    if (item.shortcut && item.shortcut !== "") {
      menuAddItemWithShortcut(menu, label, item.shortcut, () => activate(captured));
    } else {
      menuAddItem(menu, label, () => activate(captured));
    }
  }
}

/** Register every `hotkey` in the tree. Must run before `App()`. */
function registerHotkeys(items: MenuItem[]): void {
  for (let i = 0; i < items.length; i++) {
    const item = items[i];

    if (item.items && item.items.length > 0) {
      registerHotkeys(item.items);
      continue;
    }

    if (!item.hotkey || item.hotkey === "") continue;

    const parsed = parseHotkey(item.hotkey);
    if (!parsed.ok) {
      console.log("무시된 hotkey: " + item.hotkey + " (" + itemLabel(item) + ")");
      continue;
    }

    const captured = item;
    registerGlobalHotkey(parsed.key, parsed.modifiers, () => activate(captured));
  }
}

function openWith(args: string[]): void {
  const child = spawn("/usr/bin/open", args, { detached: true, stdio: "ignore" });
  child.unref();
}

// ---------------------------------------------------------------------------
// Item lookup (for the `run` subcommand)
// ---------------------------------------------------------------------------

/** Find an item by "Parent/Child" label path. Returns null when not found. */
function findItem(items: MenuItem[], segments: string[], depth: number): MenuItem | null {
  if (depth >= segments.length) return null;
  const wanted = segments[depth];

  for (let i = 0; i < items.length; i++) {
    const item = items[i];
    if (isSeparator(item)) continue;
    if (itemLabel(item) !== wanted) continue;

    if (depth === segments.length - 1) return item;
    if (item.items) return findItem(item.items, segments, depth + 1);
    return null;
  }
  return null;
}

function printTree(items: MenuItem[], prefix: string): void {
  for (let i = 0; i < items.length; i++) {
    const item = items[i];

    if (isSeparator(item)) {
      console.log(prefix + "---");
      continue;
    }

    const path = prefix === "" ? itemLabel(item) : prefix + "/" + itemLabel(item);

    if (item.items && item.items.length > 0) {
      console.log(path + "/");
      printTree(item.items, path);
      continue;
    }

    let line = path + "  →  " + (item.command || "(명령 없음)");
    if (item.terminal === true) line += "  [terminal]";
    if (item.confirm === true) line += "  [confirm]";
    if (item.hotkey) line += "  [" + item.hotkey + "]";
    console.log(line);
  }
}

// ---------------------------------------------------------------------------
// CLI
// ---------------------------------------------------------------------------

function usage(): void {
  console.log(APP_NAME + " — 메뉴바에서 셸 명령을 실행합니다 (macOS 전용)");
  console.log("");
  console.log("사용법:");
  console.log("  " + APP_NAME + " [--config <path>]        메뉴바 앱 실행");
  console.log("  " + APP_NAME + " list                     메뉴 항목 출력");
  console.log("  " + APP_NAME + " run <라벨경로>           항목의 명령을 바로 실행");
  console.log("  " + APP_NAME + " init                     기본 설정 파일 생성");
  console.log("  " + APP_NAME + " path                     사용 중인 설정 파일 경로 출력");
  console.log("  " + APP_NAME + " --help | --version");
  console.log("");
  console.log("설정 파일 탐색 순서:");
  console.log("  --config → $MAC_TRAY_EXEC_CONFIG → ./menu.json → ~/.config/" + APP_NAME + "/menu.json");
  console.log("");
  console.log("로그: " + logPath());
}

interface Args {
  command: string;
  target: string;
  configPath: string;
}

function parseArgs(): Args {
  const argv = process.argv;
  const result: Args = { command: "", target: "", configPath: "" };
  const positional: string[] = [];

  for (let i = 2; i < argv.length; i++) {
    const arg = argv[i];

    if (arg === "--config" || arg === "-c") {
      i++;
      if (i < argv.length) result.configPath = argv[i];
      continue;
    }
    if (arg.indexOf("--config=") === 0) {
      result.configPath = arg.substring("--config=".length);
      continue;
    }
    if (arg === "--help" || arg === "-h") {
      result.command = "help";
      continue;
    }
    if (arg === "--version" || arg === "-V") {
      result.command = "version";
      continue;
    }
    positional.push(arg);
  }

  if (result.command === "" && positional.length > 0) result.command = positional[0];
  if (positional.length > 1) result.target = positional[1];
  return result;
}

// ---------------------------------------------------------------------------
// Tray app
// ---------------------------------------------------------------------------

function buildMenu(menu: Widget, config: TrayConfig, configPath: string, rebuild: () => void): void {
  menuClear(menu);
  addItems(menu, config.items);

  menuAddSeparator(menu);
  menuAddItem(menu, "설정 파일 편집…", () => openWith(["-t", configPath]));
  menuAddItem(menu, "로그 보기", () => openWith(["-a", "Console", logPath()]));
  menuAddItem(menu, "메뉴 새로 고침", rebuild);
  menuAddSeparator(menu);
  menuAddItemWithShortcut(menu, "종료", "cmd+q", () => process.exit(0));
}

function runTray(args: Args): void {
  const loaded = loadConfig(args.configPath);

  if (loaded.error !== "") {
    console.log("설정 오류: " + loaded.error);
  }

  appSetActivationPolicy("accessory");

  const icon = loaded.config.icon ? expandHome(loaded.config.icon) : "";
  const tray = trayCreate(icon);
  traySetTooltip(tray, loaded.config.tooltip || APP_NAME);

  const menu = menuCreate();
  let current = loaded.config;
  const configPath = loaded.path;

  // Re-read the config from disk and rewrite the menu in place, so edits to
  // menu.json take effect without restarting the app.
  function rebuild(): void {
    const next = loadConfig(configPath);
    if (next.error !== "") {
      alert(APP_NAME, next.error);
      return;
    }
    current = next.config;
    if (current.icon) traySetIcon(tray, expandHome(current.icon));
    traySetTooltip(tray, current.tooltip || APP_NAME);
    buildMenu(menu, current, configPath, rebuild);
  }

  buildMenu(menu, current, configPath, rebuild);
  trayAttachMenu(tray, menu);

  registerHotkeys(current.items);

  if (loaded.error !== "") {
    alert(APP_NAME, loaded.error);
  }

  App({
    title: APP_NAME,
    width: 360,
    height: 200,
    body: VStack([Text(APP_NAME + " 실행 중 — 메뉴바 아이콘을 확인하세요")]),
  });
}

// ---------------------------------------------------------------------------
// Entry point
// ---------------------------------------------------------------------------

function main(): void {
  const args = parseArgs();

  if (args.command === "help") {
    usage();
    return;
  }

  if (args.command === "version") {
    console.log(APP_NAME + " 1.0.0"); // x-release-please-version
    return;
  }

  if (args.command === "init") {
    const path = writeDefaultConfig();
    console.log("기본 설정을 생성했습니다: " + path);
    return;
  }

  if (args.command === "path") {
    const path = resolveConfigPath(args.configPath);
    console.log(path === "" ? "(설정 파일 없음 — init을 실행하세요)" : path);
    return;
  }

  if (args.command === "list") {
    const loaded = loadConfig(args.configPath);
    if (loaded.error !== "") {
      console.log("설정 오류: " + loaded.error);
      process.exit(1);
      return;
    }
    console.log("# " + loaded.path);
    printTree(loaded.config.items, "");
    return;
  }

  if (args.command === "run") {
    if (args.target === "") {
      console.log("실행할 항목의 라벨 경로가 필요합니다. 예: " + APP_NAME + ' run "예제/날짜 기록"');
      process.exit(1);
      return;
    }

    const loaded = loadConfig(args.configPath);
    if (loaded.error !== "") {
      console.log("설정 오류: " + loaded.error);
      process.exit(1);
      return;
    }

    const item = findItem(loaded.config.items, args.target.split("/"), 0);
    if (!item) {
      console.log("항목을 찾을 수 없습니다: " + args.target);
      process.exit(1);
      return;
    }

    const code = runItemForeground(item);
    process.exit(code);
    return;
  }

  if (args.command !== "") {
    console.log("알 수 없는 명령: " + args.command);
    usage();
    process.exit(1);
    return;
  }

  runTray(args);
}

main();
