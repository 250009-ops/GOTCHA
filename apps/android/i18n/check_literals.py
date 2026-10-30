#!/usr/bin/env python3
"""M1 CI gate: fail on hard-coded user-visible English literals in routed Android UI.

Flags string literals that contain letters passed to Text(...), text = "...", label/title/placeholder
params, and apiErrorMessage("..."), in ui/learner, ui/onboarding, ui/auth, ui/components.
A line can opt out with a trailing `// i18n-ok: <reason>` (brand names, debug-only text, symbols).
Usage: python3 apps/android/i18n/check_literals.py [--list]
"""
import pathlib, re, sys

ROOT = pathlib.Path(__file__).resolve().parents[1] / "app/src/main/java/app/gotcha/android/ui"
DIRS = ["learner", "onboarding", "auth", "components"]
PATTERNS = [
    re.compile(r'\bText\(\s*"((?:[^"\\]|\\.)*[A-Za-z]{2}(?:[^"\\]|\\.)*)"'),
    re.compile(r'\b(?:text|label|title|placeholder|contentDescription|subtitle|message|hint|cta|body)\s*=\s*"((?:[^"\\]|\\.)*[A-Za-z]{2}(?:[^"\\]|\\.)*)"'),
    re.compile(r'apiErrorMessage\(\s*"((?:[^"\\]|\\.)*)"'),
    re.compile(r'\bText\(\s*"(?:[^"\\]|\\.)*\$\{?[A-Za-z_][^"]*?[A-Za-z]{2}[^"]*"'),
]

def scan():
    hits = []
    for d in DIRS:
        base = ROOT / d
        if not base.exists():
            continue
        for f in sorted(base.rglob("*.kt")):
            for n, line in enumerate(f.read_text(encoding="utf-8").splitlines(), 1):
                s = line.strip()
                if s.startswith("//") or "i18n-ok" in line or s.startswith("*"):
                    continue
                if re.search(r"\b(animate\w*|rememberInfiniteTransition|updateTransition|AnimatedContent|Crossfade)\b", line):
                    continue
                for p in PATTERNS:
                    m = p.search(line)
                    if m and re.search(r"[A-Za-z]{2}", re.sub(r"\$\{[^}]*\}|\$\w+", "", m.group(0).split('"', 1)[1])):
                        hits.append((f.relative_to(ROOT.parents[4]), n, s[:140]))
                        break
    return hits

if __name__ == "__main__":
    hits = scan()
    if "--count" in sys.argv:
        from collections import Counter
        for k, v in Counter(str(h[0]).split("/")[-1] for h in hits).most_common():
            print(f"{v:4d} {k}")
    for f, n, s in hits if "--count" not in sys.argv else []:
        print(f"{f}:{n}: {s}")
    print(f"{len(hits)} hard-coded UI literal(s)", file=sys.stderr)
    sys.exit(1 if hits else 0)
