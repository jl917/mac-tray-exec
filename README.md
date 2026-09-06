# mac-tray-exec

macOS 메뉴바(트레이) 아이콘을 클릭하면 메뉴가 열리고, 항목을 고르면 지정한 셸 명령이 실행됩니다.
JSON 파일 하나로 메뉴를 구성하며, [Perry](https://github.com/PerryTS/perry)로 컴파일된 네이티브 바이너리라 실행에 Node가 필요 없습니다.

macOS 전용입니다 (`NSStatusItem` 기반).

## 설치

[릴리스](https://github.com/jl917/mac-tray-exec/releases)에서 Apple Silicon(arm64)용 바이너리를 받습니다.
빌드 도구 없이 이것만 있으면 됩니다.

```bash
# 최신 버전 다운로드 + 체크섬 검증 + 설치
URL=$(curl -fsSL https://api.github.com/repos/jl917/mac-tray-exec/releases/latest \
  | grep -o '"browser_download_url": *"[^"]*darwin-arm64\.tar\.gz"' | cut -d'"' -f4)

curl -fsSL -O "$URL" && curl -fsSL -O "$URL.sha256"
shasum -a 256 -c ./*.sha256                    # → OK 가 떠야 합니다

tar -xzf mac-tray-exec-*-darwin-arm64.tar.gz
mkdir -p ~/.local/bin && mv mac-tray-exec ~/.local/bin/
~/.local/bin/mac-tray-exec --version
```

버전을 고정하려면 URL을 직접 쓰면 됩니다:

```
https://github.com/jl917/mac-tray-exec/releases/download/v2.0.1/mac-tray-exec-2.0.1-darwin-arm64.tar.gz
```

`~/.local/bin`이 `PATH`에 없다면 셸 설정에 추가하세요 (`export PATH="$HOME/.local/bin:$PATH"`).

### 브라우저로 받았다면 quarantine을 지워야 합니다

이 바이너리는 ad-hoc 서명만 되어 있고 Apple 공증(notarization)을 받지 않았습니다.
브라우저로 내려받으면 macOS가 `com.apple.quarantine` 속성을 붙이고, 그 상태로 실행하면
**아무 메시지 없이 즉시 종료됩니다** (exit 137 — Gatekeeper가 SIGKILL).

```bash
xattr -d com.apple.quarantine ~/.local/bin/mac-tray-exec
```

위 `curl` 방식으로 받으면 quarantine이 붙지 않으므로 이 단계가 필요 없습니다.

지원 아키텍처는 현재 arm64뿐입니다. Intel Mac이라면 아래 "소스에서 빌드"를 따르세요.

## 소스에서 빌드

Xcode Command Line Tools가 필요합니다 (`xcode-select --install`).

```bash
npm install
npm run build          # → dist/mac-tray-exec
```

## 실행

```bash
mac-tray-exec                  # 메뉴바에 아이콘이 뜹니다 (Dock 아이콘 없음)
./dist/mac-tray-exec           # 소스에서 빌드한 경우
```

설정 파일이 하나도 없으면 `~/.config/mac-tray-exec/menu.json`에 기본 설정을 만들어 놓고 시작합니다.

### CLI

| 명령 | 설명 |
|------|------|
| `mac-tray-exec` | 메뉴바 앱 실행 |
| `mac-tray-exec list` | 메뉴 트리를 라벨 경로와 함께 출력 |
| `mac-tray-exec run "그룹/항목"` | 메뉴를 거치지 않고 해당 항목의 명령을 바로 실행 (종료 코드 그대로 반환) |
| `mac-tray-exec init` | 기본 설정 파일 생성 |
| `mac-tray-exec path` | 실제로 사용 중인 설정 파일 경로 출력 |
| `mac-tray-exec --config <path>` | 설정 파일 지정 |

## 설정 파일

탐색 순서: `--config` → `$MAC_TRAY_EXEC_CONFIG` → `./menu.json` → `~/.config/mac-tray-exec/menu.json`

`menu.example.json`을 복사해서 시작하면 됩니다.

```json
{
  "tooltip": "mac-tray-exec",
  "icon": "~/icons/tray.png",
  "items": [
    { "label": "터미널 열기", "command": "open -a Terminal ~" },
    { "type": "separator" },
    {
      "label": "개발",
      "items": [
        { "label": "빌드", "command": "npm run build", "cwd": "~/proj", "hotkey": "cmd+shift+b" },
        { "label": "테스트", "command": "npm test", "cwd": "~/proj", "terminal": true }
      ]
    }
  ]
}
```

### 최상위 필드

| 필드 | 설명 |
|------|------|
| `items` | 메뉴 항목 배열 (필수) |
| `tooltip` | 아이콘 위에 마우스를 올렸을 때 표시할 문구 |
| `icon` | 메뉴바 아이콘 PNG/`.icns` 경로 (`~` 확장). 생략하면 기본 아이콘(●) |

### 아이콘 만들기

Perry는 이미지를 리사이즈하지 않고 NSImage의 **포인트 크기를 그대로** 사용합니다.
1254px짜리 원본을 그대로 지정하면 메뉴바 아이템이 1272pt로 늘어나 화면이 깨지므로 반드시 줄여서 쓰세요.

```bash
./scripts/make-icon.sh ~/Downloads/mc.png        # → assets/tray-icon.png
```

36px 이미지에 144dpi를 넣어 18pt로 잡히게 하는 방식입니다. 메뉴바 높이(24pt)에 맞으면서 Retina에서도 선명합니다.
직접 만든다면 18×18px(비Retina) 또는 36×36px @144dpi로 준비하면 됩니다.

### 항목 필드

| 필드 | 타입 | 설명 |
|------|------|------|
| `label` | string | 메뉴에 표시할 이름 |
| `command` | string | `/bin/sh -c`로 실행할 명령 |
| `type` | `"separator"` | 구분선 |
| `items` | array | 하위 항목. 지정하면 서브메뉴가 됩니다 |
| `cwd` | string | 작업 디렉터리 (`~` 확장) |
| `env` | object | 명령에 추가로 넘길 환경변수 |
| `shortcut` | string | 메뉴에 표시되는 단축키 (예: `"cmd+t"`). 메뉴가 열려 있을 때 동작 |
| `hotkey` | string | 전역 단축키 (예: `"cmd+shift+b"`). 앱이 백그라운드여도 동작 |
| `terminal` | boolean | `true`면 백그라운드 대신 Terminal.app 창에서 실행 |
| `confirm` | boolean | `true`면 실행 전에 확인 대화상자 표시 |

명령이 끝나도 앱은 알림을 띄우지 않습니다. 결과는 로그(`~/Library/Logs/mac-tray-exec.log`)에 남고,
알림이 필요하면 명령 안에서 직접 `osascript -e 'display notification "..."'`를 띄우면 됩니다.

### 실행할 때 값 입력받기

입력을 받는 필드는 따로 없지만, 명령 안에서 `osascript`로 대화상자를 띄우면 됩니다.
`menu.example.json`의 **시스템 → 포트 종료…** 항목이 이 방식으로 포트 번호를 물어본 뒤 해당 포트의 리스닝 프로세스를 종료합니다.

```sh
PORT=$(/usr/bin/osascript -e 'text returned of (display dialog "종료할 포트 번호를 입력하세요" default answer "3000")' 2>/dev/null) || exit 0
case "$PORT" in ''|*[!0-9]*) exit 1;; esac       # 취소하면 위에서 exit 0, 숫자가 아니면 여기서 중단
kill $(/usr/sbin/lsof -ti "tcp:$PORT" -sTCP:LISTEN)
```

메뉴에는 사용자 항목 아래에 **설정 파일 편집… / 로그 보기 / 메뉴 새로 고침 / 종료**가 자동으로 붙습니다.
`menu.json`을 고친 뒤 **메뉴 새로 고침**을 누르면 앱을 재시작하지 않고 메뉴가 갱신됩니다.

## 동작 방식

- 명령은 분리된(detached) 자식 프로세스로 실행되므로, 오래 걸리는 명령이 메뉴바를 멈추게 하지 않습니다.
- 명령이 끝나도 앱은 알림을 띄우지 않습니다. 성공·실패 여부는 로그에서 확인합니다.
- 라벨·경로·환경변수는 셸 문자열에 직접 끼워 넣지 않고 환경변수로 전달합니다. 따옴표나 공백이 들어간 값 때문에 명령이 깨지지 않습니다.
- 모든 출력(stdout/stderr)은 `~/Library/Logs/mac-tray-exec.log`에 누적됩니다.
- `terminal: true` 항목은 `~/Library/Caches/mac-tray-exec/`에 임시 `.command` 스크립트를 만들어 `open -a Terminal`로 실행하고, 1시간이 지난 임시 파일은 자동으로 지웁니다.

## 알아둘 점

- **전역 핫키(`hotkey`)는 알파벳 키만 동작합니다.** Perry의 macOS 백엔드가 숫자·F키를 매핑하지 않아 `cmd+shift+9`나 `cmd+f8`은 등록해도 반응하지 않습니다. `shortcut`(메뉴 단축키)에는 이 제약이 없습니다.
- `hotkey`는 앱 시작 시점에만 등록됩니다. 핫키를 바꿨다면 **메뉴 새로 고침**이 아니라 앱을 재시작해야 합니다.
- 명령 안에서 직접 `osascript`로 알림·대화상자를 띄우는 경우, 처음 실행할 때 macOS가 권한을 물어볼 수 있고 "스크립트 편집기" 이름으로 표시될 수 있습니다.
- `sudo`가 필요한 명령은 비밀번호를 입력할 수 없으므로 그대로는 실패합니다. `terminal: true`로 두거나 `osascript -e 'do shell script "..." with administrator privileges'`를 쓰세요.

## 로그인 시 자동 실행

`~/Library/LaunchAgents/com.mac-tray-exec.plist`:

```xml
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
  <key>Label</key><string>com.mac-tray-exec</string>
  <key>ProgramArguments</key>
  <array><string>/Users/사용자명/.local/bin/mac-tray-exec</string></array>
  <key>RunAtLoad</key><true/>
</dict>
</plist>
```

`ProgramArguments`는 절대 경로여야 하고 `~`가 확장되지 않습니다.
설정 파일을 지정하려면 배열에 `<string>--config</string><string>/절대경로/menu.json</string>`을 이어서 넣으세요.

```bash
launchctl load ~/Library/LaunchAgents/com.mac-tray-exec.plist
```

## 업데이트

"설치"의 명령을 그대로 다시 실행하면 됩니다. 실행 중인 앱은 파일을 덮어써도 계속 돌아가므로,
새 버전을 쓰려면 메뉴바에서 **종료**한 뒤 다시 실행하세요.

```bash
pkill -f 'mac-tray-exec'      # 필요하면 강제 종료
```

## 라이선스

MIT
