#!/usr/bin/env python3
"""画面で使う字だけを取り出して、字(woff2)を軽くする。
使い方: python3 tools/subset_fonts.py <字のttfがあるフォルダ>
  Zen Maru Gothic(OFL)は、core/ の Kotlin と web/ の文字列に出てくる字+かな+記号+ASCII を残す。
  Yuji Boku(OFL)は、将棋の駒と麻雀の牌に使う字だけを残す。
"""
import sys, glob, os
from fontTools import subset
src = sys.argv[1]
chars = set()
for pat in ["core/src/**/*.kt", "web/*.js", "web/*.html", "web/*.css"]:
    for p in glob.glob(pat, recursive=True):
        chars |= set(open(p, encoding="utf-8").read())
chars |= {chr(c) for c in range(0x20, 0x7f)}
chars |= {chr(c) for c in range(0x3040, 0x30ff)} | {chr(c) for c in range(0xff00, 0xffef)} | {chr(c) for c in range(0x3000, 0x3040)}
chars = {c for c in chars if ord(c) >= 0x20 and c not in "\n\r\t"}
def run(font, out, text):
    opts = subset.Options(); opts.flavor = "woff2"; opts.layout_features = ["*"]
    f = subset.load_font(os.path.join(src, font), opts)
    s = subset.Subsetter(opts); s.populate(text="".join(sorted(text))); s.subset(f)
    subset.save_font(f, os.path.join("web/fonts", out), opts)
    print(out, os.path.getsize(os.path.join("web/fonts", out)), "bytes", len(text), "chars")
run("zen_maru_gothic_medium.ttf", "ZenMaruGothic-Medium.woff2", chars)
run("zen_maru_gothic_bold.ttf", "ZenMaruGothic-Bold.woff2", chars)
run("koma_yuji_boku.ttf", "YujiBoku-Koma.woff2", set("王玉将飛車角行金銀桂馬香歩兵竜龍成と全杏圭一二三四五六七八九萬東南西北發中し"))  # し はごいたの駒
