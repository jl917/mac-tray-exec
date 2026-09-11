---
name: tray
description: Build, run, restart, and debug the mac-tray-exec menu-bar app. Use when asked to 빌드/실행/재시작/종료 the tray app, add or change a menu item in menu.json, make a tray icon, check the log, or diagnose why a menu item, hotkey, or icon is not working.
---

# mac-tray-exec 실행 가이드

macOS 메뉴바 앱. Perry로 컴파일된 네이티브 바이너리라 실행에 Node가 필요 없다.
모든 명령은 저장소 루트에서 실행한다.

## 1. 빌드

```bash
npm run build          # → dist/mac-tray-exec (약 6초)
```

`ld: warning: duplicate symbol ...`이 수십 줄 나오는 것은 Perry 런타임 링크 과정의 정상 출력이다.
**`Wrote executable: dist/mac-tray-exec`** 줄이 보이면 성공. 이 경고를 실패로 보고하지 말 것.

## 2. 실행

앱은 **포그라운드로 붙잡는다**. 반드시 백그라운드로 띄운다.

```bash
./dist/mac-tray-exec --config assets/menu.json &
```

`--config`를 빼면 저장소 루트에 `./menu.json`이 없어서 `~/.config/mac-tray-exec/menu.json`으로
폴백한다. 이 저장소의 설정을 쓰려면 항상 `--config assets/menu.json`을 붙일 것.

빌드+실행을 한 번에: `npm start` (단, 포그라운드로 실행됨)

## 3. 재시작 / 종료

```bash
pkill -f 'dist/mac-tray-exec'                       # 종료
pkill -f 'dist/mac-tray-exec'; sleep 1; ./dist/mac-tray-exec --config assets/menu.json &   # 재시작
```

실행 중인 인스턴스 확인:

```bash
pgrep -fl mac-tray-exec
```

> **주의**: 다른 폴더(예: `~/Documents/tray/`)에서 띄운 이전 인스턴스가 남아 있으면
> 메뉴바에 아이콘이 두 개 뜨거나, 방금 고친 설정이 반영 안 된 것처럼 보인다.
> `pgrep -fl mac-tray-exec`로 경로를 확인하고 필요하면 전부 종료한다.

### 무엇을 바꿨는지에 따라

| 변경 대상 | 필요한 조치 |
|-----------|-------------|
| `package.json`의 `version` | `npm run build` — 버전은 빌드 시점에 인라인된다 (메뉴 첫 줄 + `--version`) |
| `menu.json`의 라벨·명령·`cwd`·`env`·`shortcut` | 메뉴바 → **메뉴 새로 고침** (재시작 불필요) |
| `hotkey` (전역 단축키) | **앱 재시작** — 핫키는 시작 시점에만 등록된다 |
| `src/*.ts` | `npm run build` 후 재시작 |

## 4. 메뉴바 없이 확인하기

```bash
./dist/mac-tray-exec --config assets/menu.json list          # 메뉴 트리 + 라벨 경로 출력
./dist/mac-tray-exec --config assets/menu.json run "시스템/IP 주소 복사"   # 항목 명령 바로 실행
./dist/mac-tray-exec path                                    # 실제 사용 중인 설정 경로
./dist/mac-tray-exec init                                    # ~/.config에 기본 설정 생성
```

`run`은 종료 코드를 그대로 반환하고 출력을 터미널에 보여준다 — **메뉴 항목을 고쳤을 때
메뉴바를 거치지 않고 검증하는 가장 빠른 방법**이다. 단 `confirm`/`terminal`은
`run`에서 무시되고 명령만 동기 실행된다.

## 5. 로그

```bash
tail -f ~/Library/Logs/mac-tray-exec.log
```

메뉴 클릭으로 실행된 명령의 stdout/stderr가 `=== 라벨 @ 날짜 ===` 헤더와 함께 누적된다.
앱은 명령이 끝나도 알림을 띄우지 않으므로, **성공·실패 확인은 로그가 유일한 경로**다.
"항목을 눌렀는데 아무 일도 안 일어난다"는 대부분 여기에 원인이 찍혀 있다.

## 6. 메뉴 항목 추가

[assets/menu.json](../../../assets/menu.json)을 수정한다.
전체 필드 예시는 [menu.example.json](../../../menu.example.json), 스키마 정의는
[src/config.ts](../../../src/config.ts)의 `MenuItem`을 볼 것.

```json
{ "label": "빌드", "command": "npm run build", "cwd": "~/proj", "terminal": true }
```

수정 후: `list`로 파싱 확인 → `run "라벨경로"`로 명령 검증 → 메뉴 새로 고침.

JSON이 깨지면 앱이 실행은 되지만 `설정 오류: JSON 파싱 실패` 경고 후 빈 메뉴가 뜬다.

## 7. 트레이 아이콘

```bash
./scripts/make-icon.sh ~/Downloads/원본.png       # → assets/tray-icon.png (36px @144dpi = 18pt)
```

Perry는 이미지를 리사이즈하지 않고 NSImage의 **포인트 크기를 그대로** 쓴다.
원본(예: 1254px)을 그대로 `icon`에 넣으면 메뉴바 아이템이 화면 폭만큼 늘어난다.
아이콘이 거대하게 나오면 리사이즈를 안 한 것이므로 이 스크립트를 다시 돌린다.

## 8. 자주 겪는 문제

| 증상 | 원인 / 조치 |
|------|-------------|
| 전역 `hotkey`가 안 먹음 | Perry macOS 백엔드가 **알파벳 키만** 매핑한다. `cmd+shift+9`, `cmd+f8`은 등록해도 무반응. `shortcut`(메뉴 단축키)에는 제약 없음 |
| `hotkey`를 고쳤는데 그대로 | 재시작 필요 (메뉴 새로 고침으로는 반영 안 됨) |
| 아이콘이 거대함 | 7번 참고 — 원본 크기를 그대로 쓴 것 |
| 메뉴는 뜨는데 항목이 비어 있음 | JSON 파싱 실패. `list`로 확인 |
| `sudo` 명령이 실패 | 비밀번호를 입력할 수 없다. `terminal: true`로 두거나 `osascript -e 'do shell script "..." with administrator privileges'` 사용 |
| 명령이 끝나도 알림이 없음 | 정상. 앱은 완료 알림을 띄우지 않는다. 로그로 확인하거나 명령 안에서 직접 `osascript -e 'display notification "..."'`를 호출한다 |
| 명령이 띄운 알림이 "스크립트 편집기" 이름으로 뜸 | 정상. `osascript`로 띄우기 때문 |
| Dock에 아이콘이 없음 | 정상. `appSetActivationPolicy("accessory")` |
| 화면이 안 잠김 | 정상. 앱이 실행 중이면 `caffeinate -d -i`로 잠금을 막는다. 메뉴의 **화면 잠금 방지** 토글이나 설정의 `"keepAwake": false`로 끈다. 확인: `pmset -g assertions \| grep caffeinate` |
