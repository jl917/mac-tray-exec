// 화면 잠금 방지: 앱이 떠 있는 동안 macOS 전원 어서션을 붙잡아 둔다.
//
// Perry에는 Electron의 powerSaveBlocker 같은 API가 없어서, macOS 기본
// `/usr/bin/caffeinate`를 자식 프로세스로 띄워 어서션을 유지한다.

import { spawn } from "child_process";

// caffeinate 자식 프로세스. null이면 잠금 방지가 꺼진 상태다.
let child: any = null;
// 메뉴에서 직접 켜고 끈 뒤에는 설정 파일 값이 이를 덮어쓰지 않게 한다.
let manual = false;

/**
 * `-d` 디스플레이 유휴 슬립 방지 — 화면 보호기와 잠금이 걸리지 않는다.
 * `-i` 시스템 유휴 슬립 방지.
 * `-w <pid>` 우리 프로세스가 사라지면 어서션도 함께 풀린다. 크래시나 SIGKILL로
 *   stopKeepAwake()가 불리지 못해도 caffeinate가 남아 시스템을 붙잡는 일은 없다.
 */
function caffeinateArgs(): string[] {
  return ["-d", "-i", "-w", String(process.pid)];
}

/** 이미 켜져 있으면 아무 것도 하지 않는다. 성공 여부를 반환한다. */
export function startKeepAwake(): boolean {
  if (child) return true;

  try {
    const proc = spawn("/usr/bin/caffeinate", caffeinateArgs(), {
      detached: true,
      stdio: "ignore",
    });
    proc.unref();
    child = proc;
    return true;
  } catch (e) {
    child = null;
    return false;
  }
}

export function stopKeepAwake(): void {
  if (!child) return;

  try {
    child.kill("SIGTERM");
  } catch (e) {
    // 이미 죽었으면 `-w`가 알아서 정리했다는 뜻이다.
  }
  child = null;
}

export function isKeepAwake(): boolean {
  return child !== null;
}

/**
 * 설정 파일의 `keepAwake` 값을 반영한다. 메뉴에서 수동으로 토글한 뒤에는
 * "메뉴 새로 고침"이 그 선택을 되돌리지 않도록 무시한다.
 */
export function applyKeepAwakeConfig(enabled: boolean): void {
  if (manual) return;
  if (enabled) startKeepAwake();
  else stopKeepAwake();
}

/** 메뉴 토글. 켠 뒤의 상태를 반환한다. */
export function toggleKeepAwake(): boolean {
  manual = true;
  if (child) {
    stopKeepAwake();
    return false;
  }
  return startKeepAwake();
}
