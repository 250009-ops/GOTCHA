#!/usr/bin/env python3
"""Build the self-hosted WOFF2 subsets (OFL fonts). Adds cmap entries U+02BB -> glyph of U+2018 and
U+02BC -> glyph of U+2019 when a font lacks them, so Uzbek oʻ/gʻ/ʼ never fall back to another font.
Usage: python3 scripts/build_fonts.py <dir with manrope.ttf and bagel_fat_one_regular.ttf>"""
import sys, pathlib
from fontTools.ttLib import TTFont
from fontTools import subset
src = pathlib.Path(sys.argv[1]); out = pathlib.Path(__file__).resolve().parent.parent / 'public/fonts'
JOBS = [('manrope.ttf', 'manrope-subset.woff2', 'U+0020-024F,U+02BB-02BC,U+02C6,U+02DC,U+0300-0301,U+0400-04FF,U+2000-206F,U+20AC,U+2116,U+2122,U+2190-2193,U+2212,U+2248,U+2265,U+2713,U+2715'),
        ('bagel_fat_one_regular.ttf', 'bagel-fat-one-latin.woff2', 'U+0020-007E,U+00A0-00FF,U+02BB-02BC,U+2018-2019')]
for ttf, woff, uni in JOBS:
    f = TTFont(src / ttf)
    best = f.getBestCmap()
    for new, old in ((0x02BB, 0x2018), (0x02BC, 0x2019)):
        if new not in best and old in best:
            for t in f['cmap'].tables:
                if t.isUnicode(): t.cmap[new] = best[old]
            print(f'{ttf}: mapped U+{new:04X} -> {best[old]}')
    opts = subset.Options(); opts.flavor = 'woff2'; opts.name_IDs = ['*']; opts.layout_features = ['*']
    s = subset.Subsetter(opts); s.populate(unicodes=subset.parse_unicodes(uni)); s.subset(f)
    f.flavor = 'woff2'; f.save(out / woff)
    cm = TTFont(out / woff).getBestCmap(); assert 0x02BB in cm and 0x02BC in cm, woff
    print(woff, (out / woff).stat().st_size, 'bytes, 02BB/02BC ok')
