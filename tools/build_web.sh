#!/usr/bin/env bash
# core(Kotlin)を JS にして web/core/ へ入れる。使い方: tools/build_web.sh
set -euo pipefail
cd "$(dirname "$0")/.."
gradle -q :core:jsBrowserProductionLibraryDistribution "$@"
rm -rf web/core && mkdir -p web/core
cp core/build/dist/js/productionLibrary/*.mjs web/core/
echo "web/core を更新しました"
