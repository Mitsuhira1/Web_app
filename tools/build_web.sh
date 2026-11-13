#!/usr/bin/env bash
# Web 版を作って web/ に入れる。
#  1) core(規則・CPU・効果音の計算)を JS にして web/core/ へ(CPU の思考と音の計算は Worker でこれを使う)
#  2) app(元のアプリの Compose の画面)を Wasm にして web/ へ(asobi.js・asobi.wasm・Skiko・composeResources)
#  3) web/sw.js(オフラインのための保存の一覧)を作り直す
# 使い方: tools/build_web.sh   (Wasm の最適化に10分ほどかかる)
set -euo pipefail
cd "$(dirname "$0")/.."
gradle -q :core:jsBrowserProductionLibraryDistribution :app:wasmJsBrowserDistribution "$@"
rm -rf web/core && mkdir -p web/core
cp core/build/dist/js/productionLibrary/*.mjs web/core/
D=app/build/dist/wasmJs/productionExecutable
rm -f web/*.wasm
cp "$D"/asobi.js "$D"/*.wasm web/
rm -rf web/composeResources && cp -r "$D"/composeResources web/
cp app/src/wasmJsMain/resources/index.html app/src/wasmJsMain/resources/boot.js web/
python3 "$(dirname "$0")/make_sw.py"
echo "web/ を更新しました"
