import { useLayoutEffect, useMemo, useRef, useState, type RefObject } from 'react';

/** Prefer 3 wrapped lines per stanza; use 2 when that avoids a leftover single line. */
export const STANZA_LINE_MAX = 3;

/**
 * How many wrapped lines sit in each stanza for a paragraph of `lineCount` lines.
 * 7 → [3, 2, 2], 8 → [3, 3, 2], 4 → [2, 2], 3 → [3].
 */
export function stanzaSizes(lineCount: number): number[] {
  if (lineCount <= 0) return [];
  if (lineCount <= STANZA_LINE_MAX) return [lineCount];
  const sizes: number[] = [];
  let left = lineCount;
  while (left > 0) {
    if (left <= STANZA_LINE_MAX) {
      sizes.push(left);
      break;
    }
    if (left === 4) {
      sizes.push(2, 2);
      break;
    }
    sizes.push(STANZA_LINE_MAX);
    left -= STANZA_LINE_MAX;
  }
  return sizes;
}

export function stanzaBreakTokenIs(lineStartTokenIs: number[], sizes = stanzaSizes(lineStartTokenIs.length)): number[] {
  const breaks: number[] = [];
  let offset = 0;
  for (let s = 0; s < sizes.length - 1; s++) {
    offset += sizes[s]!;
    const tokenI = lineStartTokenIs[offset];
    if (tokenI != null) breaks.push(tokenI);
  }
  return breaks;
}

export function splitParagraphsByGap<T extends { top: number }>(lines: T[], lineHeight: number): T[][] {
  if (!lines.length) return [];
  const paras: T[][] = [[lines[0]!]];
  const gapLimit = Math.max(8, lineHeight * 1.55);
  for (let i = 1; i < lines.length; i++) {
    const prev = lines[i - 1]!;
    const cur = lines[i]!;
    if (cur.top - prev.top > gapLimit) paras.push([cur]);
    else paras[paras.length - 1]!.push(cur);
  }
  return paras;
}

export function visualLineStartsFromContainer(container: HTMLElement): Array<{ tokenI: number; top: number }> {
  const nodes = container.querySelectorAll<HTMLElement>('[data-reader-token]');
  const lines: Array<{ tokenI: number; top: number }> = [];
  let lastTop = Number.NaN;
  for (const node of nodes) {
    const tokenI = Number(node.getAttribute('data-reader-token'));
    if (!Number.isFinite(tokenI)) continue;
    const top = node.offsetTop;
    if (!Number.isFinite(lastTop) || Math.abs(top - lastTop) > 8) {
      lines.push({ tokenI, top });
      lastTop = top;
    }
  }
  return lines;
}

/** Hide our own spacers so measurement sees original wrapping (avoids a layout loop). */
export function stanzaBreaksFromContainer(container: HTMLElement): number[] {
  const spacers = [...container.querySelectorAll<HTMLElement>('[data-stanza-break]')];
  for (const spacer of spacers) spacer.style.display = 'none';
  void container.offsetHeight;

  try {
    const lines = visualLineStartsFromContainer(container);
    if (lines.length < 4) return [];
    const sample = container.querySelector<HTMLElement>('[data-reader-token]');
    const lineHeight =
      (sample ? sample.getBoundingClientRect().height : 0) ||
      parseFloat(getComputedStyle(container).lineHeight) ||
      24;
    const breaks: number[] = [];
    for (const para of splitParagraphsByGap(lines, lineHeight)) {
      breaks.push(...stanzaBreakTokenIs(para.map((line) => line.tokenI)));
    }
    return breaks;
  } finally {
    for (const spacer of spacers) spacer.style.display = '';
  }
}

export function useReaderStanzaBreaks(
  containerRef: RefObject<HTMLElement | null>,
  layoutKey: string,
): Set<number> {
  const [breaks, setBreaks] = useState<number[]>([]);
  const sigRef = useRef('');

  useLayoutEffect(() => {
    const el = containerRef.current;
    if (!el) {
      sigRef.current = '';
      setBreaks([]);
      return;
    }

    const apply = () => {
      const next = stanzaBreaksFromContainer(el);
      const sig = `${layoutKey}:${next.join(',')}`;
      if (sig === sigRef.current) return;
      sigRef.current = sig;
      setBreaks(next);
    };

    apply();
    const ro = new ResizeObserver(apply);
    ro.observe(el);
    return () => ro.disconnect();
  }, [containerRef, layoutKey]);

  return useMemo(() => new Set(breaks), [breaks]);
}
