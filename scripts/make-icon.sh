#!/bin/sh
# 임의의 이미지를 메뉴바용 트레이 아이콘으로 변환합니다.
#
#   ./scripts/make-icon.sh ~/Downloads/mc.png [assets/tray-icon.png]
#
# Perry는 이미지를 리사이즈하지 않고 NSImage의 포인트 크기를 그대로 씁니다.
# 36px 이미지에 144dpi를 넣으면 18pt로 잡혀 메뉴바(24pt)에 맞으면서
# Retina에서도 선명하게 표시됩니다.

set -e

SRC="$1"
OUT="${2:-assets/tray-icon.png}"

if [ -z "$SRC" ]; then
  echo "사용법: $0 <원본이미지> [출력경로]" >&2
  exit 1
fi

if [ ! -f "$SRC" ]; then
  echo "원본 이미지를 찾을 수 없습니다: $SRC" >&2
  exit 1
fi

mkdir -p "$(dirname "$OUT")"
sips -Z 36 "$SRC" --out "$OUT" -s dpiWidth 144 -s dpiHeight 144 >/dev/null

echo "생성됨: $OUT (36px @ 144dpi = 18pt)"
echo "menu.json의 \"icon\" 값을 이 경로로 지정한 뒤 '메뉴 새로 고침'을 누르세요."
