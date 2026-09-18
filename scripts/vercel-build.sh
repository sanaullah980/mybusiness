#!/usr/bin/env bash
set -euo pipefail

FLUTTER_VERSION="3.35.7"
FLUTTER_DIR="$HOME/flutter"
if [ ! -x "$FLUTTER_DIR/bin/flutter" ]; then
  mkdir -p "$HOME"
  curl -fsSL "https://storage.googleapis.com/flutter_infra_release/releases/stable/linux/flutter_linux_${FLUTTER_VERSION}-stable.tar.xz" -o /tmp/flutter.tar.xz
  tar -xJf /tmp/flutter.tar.xz -C "$HOME"
fi
export PATH="$FLUTTER_DIR/bin:$PATH"
flutter config --no-analytics
flutter pub get
flutter build web --release
