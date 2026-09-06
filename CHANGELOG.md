# Changelog

## [2.1.0](https://github.com/jl917/mac-tray-exec/compare/v2.0.1...v2.1.0) (2026-09-06)


### Features

* 메뉴 첫 줄에 현재 버전 표시 ([12af2fe](https://github.com/jl917/mac-tray-exec/commit/12af2fed2295b37911f02a0b6a7087b815fe5ea5))

## [2.0.1](https://github.com/jl917/mac-tray-exec/compare/v2.0.0...v2.0.1) (2026-09-06)


### Bug Fixes

* 새 체크아웃에서 빌드 실패하는 문제 수정 ([389bff9](https://github.com/jl917/mac-tray-exec/commit/389bff946d7e1509d75ee2be3173139a356c9011))

## [2.0.0](https://github.com/jl917/mac-tray-exec/compare/mac-tray-exec-v1.0.0...mac-tray-exec-v2.0.0) (2026-09-06)


### ⚠ BREAKING CHANGES

* menu.json의 notify 필드가 제거되었습니다. 실행 후 알림이 필요하면 명령 안에서 직접 osascript로 띄우세요.

### Features

* Perry 기반 macOS 트레이 실행기 구현 ([cacdc39](https://github.com/jl917/mac-tray-exec/commit/cacdc39a9e2bb2dbda1ee9633a0ec65fddec589a))
* 명령 실행 후 완료/실패 알림 제거 ([9488cc7](https://github.com/jl917/mac-tray-exec/commit/9488cc7ebce4ec1740e65f374ed6d72ce53dce95))
