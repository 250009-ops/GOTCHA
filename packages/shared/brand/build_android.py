"""Converts the canonical logo SVGs (assets/, from team/BRAND-logo.md) into Android VectorDrawables.
Run: python3 packages/shared/brand/build_android.py  (sync.mjs copies the results into the app)."""
import re, os
here = os.path.dirname(os.path.abspath(__file__)); A = os.path.join(here, 'assets'); OUT = os.path.join(here, 'android')
os.makedirs(OUT, exist_ok=True)
HDR = '<?xml version="1.0" encoding="utf-8"?>\n<!-- Generated from packages/shared/brand/assets/{src} (canonical learner-panel logo, BRAND-logo.md). Do not edit. -->\n'

def paths(svg):
    return re.findall(r'<path fill="([^"]+)" d="([^"]+)"', svg)

def argb(c):
    c = c.lstrip('#').upper(); c = ''.join(ch * 2 for ch in c) if len(c) == 3 else c
    return '#FF' + c

def vb(svg):
    return [float(x) for x in re.search(r'viewBox="([^"]+)"', svg).group(1).split()]

def write(name, src, body, w, h):
    open(os.path.join(OUT, name), 'w').write(HDR.format(src=src) + f'<vector xmlns:android="http://schemas.android.com/apk/res/android" android:width="{w:g}dp" android:height="{h:g}dp" android:viewportWidth="{w:g}" android:viewportHeight="{h:g}">{body}\n</vector>\n')

def p(color, d):
    return f'\n  <path android:fillColor="{color}" android:pathData="{d}"/>'

# Mark: rounded tile (r = 0.3125 * 32 = 10) + G
s = open(os.path.join(A, 'gotcha-mark.svg')).read()
tile = 'M10,0H22A10,10 0,0 1,32,10V22A10,10 0,0 1,22,32H10A10,10 0,0 1,0,22V10A10,10 0,0 1,10,0Z'
write('ic_gotcha_mark.xml', 'gotcha-mark.svg', p('#FF2107AA', tile) + ''.join(p(argb(c), d) for c, d in paths(s)), 32, 32)
# Wordmark (white master; tinted in Compose)
s = open(os.path.join(A, 'gotcha-wordmark-dark.svg')).read(); _, _, w, h = vb(s)
write('ic_gotcha_wordmark.xml', 'gotcha-wordmark-dark.svg', ''.join(p('#FFFFFFFF', d) for _, d in paths(s)), w, h)
# Adaptive launcher foreground / monochrome (108dp, G at translate(18,18) scale(2.25))
for kind, color in (('foreground', '#FFFFFFFF'), ('monochrome', '#FF000000')):
    s = open(os.path.join(A, f'android-ic_launcher_{kind}.svg')).read()
    body = '\n  <group android:translateX="18" android:translateY="18" android:scaleX="2.25" android:scaleY="2.25">' + ''.join(
        p(color, d).replace('\n  ', '\n    ') for _, d in paths(s)) + '\n  </group>'
    write(f'ic_launcher_{kind}.xml', f'android-ic_launcher_{kind}.svg', body, 108, 108)
print('ok', os.listdir(OUT))
