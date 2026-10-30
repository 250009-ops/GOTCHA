/**
 * Tolerant answer grading shared by API (authoritative), web and Android fixtures.
 * Spec: team/PRD-practice.md §4.1.
 */

export type Verdict = 'correct' | 'almost' | 'wrong';

export interface GradeOptions {
  /** Target language of the expected answer (en, ru, uz, ...). */
  lang?: string;
  /** Extra accepted answers (inflections, synonyms the user saved). */
  variants?: string[];
  /** Normalized words from the learner's deck: a typo that lands on another real word is wrong. */
  knownWords?: Iterable<string>;
}

export interface GradeResult {
  verdict: Verdict;
  correct: boolean;
  /** Accepted answer that matched best (display form). */
  matched: string | null;
  distance: number;
  /** Why it was "almost" (or why it is wrong), for feedback copy. */
  reason?: 'typo' | 'diacritics' | 'uz_apostrophe' | 'wrong_script' | 'real_word' | 'empty' | 'ai_accepted';
  /** Per-character diff of the learner's answer vs the expected answer. */
  diff: DiffPart[];
}

export interface DiffPart {
  text: string;
  op: 'same' | 'add' | 'del';
}

// --- normalization ---------------------------------------------------------------

const APOS_RE = /['\u2019\u2018\u02BB\u02BC\u0060\u00B4\u02B9\u2032]/g;
const EDGE_PUNCT_RE = /^[\s.,!?;:"«»„“”()[\]{}…\u2014\u2013-]+|[\s.,!?;:"«»„“”()[\]{}…\u2014\u2013-]+$/g;
const STRESS_RE = /[\u0301\u0300]/g;

/** NFC, trim, collapse spaces, lowercase, strip edge punctuation, unify apostrophes, ё→е, drop stress marks. */
export function normalize(input: string, lang?: string): string {
  let s = (input ?? '').normalize('NFD').replace(STRESS_RE, '').normalize('NFC');
  try {
    s = s.toLocaleLowerCase(lang || undefined);
  } catch {
    s = s.toLowerCase();
  }
  s = s
    .replace(/\s+/g, ' ')
    .trim()
    .replace(EDGE_PUNCT_RE, '')
    .replace(/[.,!?;:"«»„“”…]/g, '')
    .replace(/\s+/g, ' ')
    .replace(/ё/g, 'е');
  // Uzbek apostrophes: ʻ after o/g, ʼ elsewhere.
  s = s.replace(APOS_RE, "'").replace(/([og])'/g, '$1\u02BB').replace(/'/g, '\u02BC');
  // English: optional articles and infinitive "to".
  if (!lang || lang === 'en') s = s.replace(/^(to|the|a|an) /, '');
  return s;
}

// --- Uzbek Cyrillic → Latin ------------------------------------------------------

const UZ_MAP: Record<string, string> = {
  а: 'a', б: 'b', в: 'v', г: 'g', д: 'd', ж: 'j', з: 'z', и: 'i', й: 'y', к: 'k', л: 'l', м: 'm',
  н: 'n', о: 'o', п: 'p', р: 'r', с: 's', т: 't', у: 'u', ф: 'f', х: 'x', ч: 'ch', ш: 'sh',
  ъ: '\u02BC', ь: '', э: 'e', ю: 'yu', я: 'ya', ў: 'o\u02BB', қ: 'q', ғ: 'g\u02BB', ҳ: 'h', ё: 'yo', ц: 's', щ: 'sh', ы: 'i',
};
const VOWELS = 'аеёиоуэюяўaeiou';

export function hasCyrillic(s: string): boolean {
  return /[\u0400-\u04FF]/.test(s);
}

export function hasLatinLetters(s: string): boolean {
  return /[a-z]/i.test(s);
}

/** Deterministic Uzbek Cyrillic→Latin (input already lowercased). */
export function uzCyrToLat(s: string): string {
  let out = '';
  for (let i = 0; i < s.length; i++) {
    const ch = s[i];
    if (ch === 'е') {
      const prev = s[i - 1];
      out += !prev || /\s/.test(prev) || VOWELS.includes(prev) ? 'ye' : 'e';
    } else if (ch === 'ц') {
      const prev = s[i - 1];
      out += !prev || /\s/.test(prev) || VOWELS.includes(prev) ? 's' : 'ts';
    } else {
      out += UZ_MAP[ch] ?? ch;
    }
  }
  return out;
}

function canonical(s: string, lang?: string): string {
  const n = normalize(s, lang);
  return lang === 'uz' && hasCyrillic(n) ? normalize(uzCyrToLat(n), lang) : n;
}

/** Uzbek oʻ/gʻ and the tutuq belgisi dropped → plain letters (used for "almost"). */
function uzLoose(s: string): string {
  return s.replace(/[\u02BB\u02BC]/g, '');
}

function foldDiacritics(s: string): string {
  return s.normalize('NFD').replace(/[\u0300-\u036f]/g, '').normalize('NFC');
}

// --- distance ----------------------------------------------------------------------

/** Optimal-string-alignment Damerau–Levenshtein distance. */
export function damerauLevenshtein(a: string, b: string): number {
  const A = [...a];
  const B = [...b];
  const d: number[][] = Array.from({ length: A.length + 1 }, (_, i) => {
    const row = new Array<number>(B.length + 1).fill(0);
    row[0] = i;
    return row;
  });
  for (let j = 0; j <= B.length; j++) d[0][j] = j;
  for (let i = 1; i <= A.length; i++) {
    for (let j = 1; j <= B.length; j++) {
      const cost = A[i - 1] === B[j - 1] ? 0 : 1;
      d[i][j] = Math.min(d[i - 1][j] + 1, d[i][j - 1] + 1, d[i - 1][j - 1] + cost);
      if (i > 1 && j > 1 && A[i - 1] === B[j - 2] && A[i - 2] === B[j - 1]) {
        d[i][j] = Math.min(d[i][j], d[i - 2][j - 2] + 1);
      }
    }
  }
  return d[A.length][B.length];
}

/** Allowed edits: 0 for ≤3 chars, 1 for 4–7, 2 for ≥8. */
export function typoAllowance(len: number): number {
  if (len <= 3) return 0;
  if (len <= 7) return 1;
  return 2;
}

function withinTypo(given: string, expected: string): { ok: boolean; distance: number } {
  const gw = given.split(' ');
  const ew = expected.split(' ');
  if (ew.length > 1 && gw.length === ew.length) {
    let total = 0;
    for (let i = 0; i < ew.length; i++) {
      const d = damerauLevenshtein(gw[i], ew[i]);
      if (d > Math.min(1, typoAllowance([...ew[i]].length))) return { ok: false, distance: d };
      total += d;
    }
    return { ok: true, distance: total };
  }
  const d = damerauLevenshtein(given, expected);
  return { ok: d <= typoAllowance([...expected].length), distance: d };
}

/** Character diff (LCS) for feedback rendering. */
export function charDiff(given: string, expected: string): DiffPart[] {
  const a = [...given];
  const b = [...expected];
  const L: number[][] = Array.from({ length: a.length + 1 }, () => new Array<number>(b.length + 1).fill(0));
  for (let i = a.length - 1; i >= 0; i--)
    for (let j = b.length - 1; j >= 0; j--)
      L[i][j] = a[i] === b[j] ? L[i + 1][j + 1] + 1 : Math.max(L[i + 1][j], L[i][j + 1]);
  const out: DiffPart[] = [];
  const push = (text: string, op: DiffPart['op']) => {
    const last = out[out.length - 1];
    if (last && last.op === op) last.text += text;
    else out.push({ text, op });
  };
  let i = 0;
  let j = 0;
  while (i < a.length && j < b.length) {
    if (a[i] === b[j]) {
      push(a[i], 'same');
      i++;
      j++;
    } else if (L[i + 1][j] >= L[i][j + 1]) push(a[i++], 'del');
    else push(b[j++], 'add');
  }
  while (i < a.length) push(a[i++], 'del');
  while (j < b.length) push(b[j++], 'add');
  return out;
}

/** "run, sprint / dash (fast)" → candidate answers. */
export function expandVariants(expected: string, extra: string[] = []): string[] {
  const out: string[] = [];
  const add = (s: string) => {
    const t = s.trim();
    if (t && !out.includes(t)) out.push(t);
  };
  for (const raw of [expected, ...extra]) {
    if (!raw) continue;
    add(raw);
    for (const part of raw.split(/[,;/|]/)) {
      add(part);
      add(part.replace(/\([^)]*\)/g, ''));
    }
  }
  return out;
}

// --- grade -------------------------------------------------------------------------

export function gradeAnswer(input: string, expected: string, opts: GradeOptions = {}): GradeResult {
  const lang = opts.lang;
  const rawGiven = normalize(input, lang);
  const candidates = expandVariants(expected, opts.variants);
  const primary = candidates[0] ?? expected;
  const mk = (verdict: Verdict, matched: string | null, distance: number, reason?: GradeResult['reason']): GradeResult => ({
    verdict,
    correct: verdict !== 'wrong',
    matched,
    distance,
    reason,
    diff: charDiff(rawGiven, normalize(matched ?? primary, lang)),
  });
  if (!rawGiven) return mk('wrong', primary, Infinity, 'empty');

  // Russian target typed in Latin → keyboard hint.
  if (lang === 'ru' && !hasCyrillic(rawGiven) && hasLatinLetters(rawGiven) && candidates.some((c) => hasCyrillic(c))) {
    return mk('wrong', primary, Infinity, 'wrong_script');
  }

  const given = canonical(input, lang);
  const known = new Set<string>();
  for (const w of opts.knownWords ?? []) known.add(canonical(w, lang));

  let best: { cand: string; d: number } | null = null;
  for (const cand of candidates) {
    const c = canonical(cand, lang);
    if (!c) continue;
    if (c === given) return mk('correct', cand, 0);
    if (lang === 'uz' && uzLoose(c) === uzLoose(given)) return mk('almost', cand, 1, 'uz_apostrophe');
    if (foldDiacritics(c) === foldDiacritics(given)) return mk('almost', cand, 1, 'diacritics');
    const d = damerauLevenshtein(given, c);
    if (!best || d < best.d) best = { cand, d };
  }
  if (best) {
    const c = canonical(best.cand, lang);
    const t = withinTypo(given, c);
    if (t.ok) {
      if (known.has(given) && given !== c) return mk('wrong', best.cand, t.distance, 'real_word');
      return mk('almost', best.cand, t.distance, 'typo');
    }
  }
  return mk('wrong', best?.cand ?? primary, best?.d ?? Infinity);
}
