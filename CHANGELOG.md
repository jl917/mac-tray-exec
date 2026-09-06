# Changelog

## [2.0.0](https://github.com/jl917/mac-tray-exec/compare/mac-tray-exec-v1.0.0...mac-tray-exec-v2.0.0) (2026-09-06)


### ⚠ BREAKING CHANGES

* menu.json의 notify 필드가 제거되었습니다. 실행 후 알림이 필요하면 명령 안에서 직접 osascript로 띄우세요.

### Features

* Perry 기반 macOS 트레이 실행기 구현 ([cacdc39](https://github.com/jl917/mac-tray-exec/commit/cacdc39a9e2bb2dbda1ee9633a0ec65fddec589a))
* 명령 실행 후 완료/실패 알림 제거 ([9488cc7](https://github.com/jl917/mac-tray-exec/commit/9488cc7ebce4ec1740e65f374ed6d72ce53dce95))
