# Firebase版のUI回帰試験

リポジトリのルートを `python -m http.server 8040 --directory .` で配信した上で実行します。

- `python tools/tests/check_firebase_ui.py`
- `python tools/tests/check_records_ui.py`
- `node tools/tests/check_transient_audio.cjs`
- `node tools/tests/check_cursor_send.cjs`

Python試験はPlaywrightと `/usr/bin/chromium` を使用します。通信APIだけを `firebase-memory-net.js` に差し替え、実際のKotlinゲームcoreと製品UIを読み込みます。本番Firebaseへ試験用データを作成しません。この代替APIは製品ページから読み込まないでください。
