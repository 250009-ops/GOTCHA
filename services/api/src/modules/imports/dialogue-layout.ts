/** Spoken-line detection and line-by-line conversation layout. */

function collapseWs(s: string): string {
  return s.replace(/\s+/g, ' ').trim();
}

const OPEN_QUOTE = '["“‘«‹]';
const CLOSE_QUOTE = '["”’\'»›]';
const SAID =
  'said|asked|replied|answered|whispered|shouted|cried|muttered|told|added|called';

/** Spoken lines stay in the story body — never become chapter titles. */
export function isDialogueLine(line: string): boolean {
  const t = collapseWs(line);
  if (!t) return false;
  if (/^[“”"‘’«»‹›]/.test(t)) return true;
  if (/^['’][A-Z]/.test(t)) return true;
  if (/^[—–‒-]\s*\S/.test(t) && t.length <= 220) return true;
  if (/^(?:[A-Z][A-Za-z.]+(?:\s+[A-Z][A-Za-z.]+){0,3}|[A-Z]{2,12})\s*:\s+\S/.test(t)) return true;
  if (
    /[“"‘'][^"”‘']{2,}["”’']/.test(t) &&
    new RegExp(`\\b(?:${SAID})\\b`, 'i').test(t)
  ) {
    return true;
  }
  return false;
}

function isAttributionLine(line: string): boolean {
  return new RegExp(`^(?:${SAID})\\b`, 'i').test(line.trim());
}

/** Previous spoken line is still wrapping onto this line. */
export function isDialogueContinuation(line: string, prev: string): boolean {
  const t = line.trim();
  const p = prev.trim();
  if (!t || !p) return false;
  if (isDialogueLine(t) || isAttributionLine(t)) return true;
  const prevEnded = /[.!?…]["”’']?\s*$/.test(p);
  if (!prevEnded && /^[a-z]/.test(t) && t.length < 160) return true;
  return false;
}

function splitAdjacentQuotes(line: string): string[] {
  const parts = line.split(new RegExp(`(?<=${CLOSE_QUOTE})\\s+(?=${OPEN_QUOTE}|')`));
  return parts.length > 1 ? parts : [line];
}

function splitAfterSaidThenQuote(line: string): string[] {
  const parts = line.split(
    new RegExp(`(?<=\\b(?:${SAID})\\b[^.!?\\n]{0,50}[.!?])\\s+(?=${OPEN_QUOTE}|')`, 'i'),
  );
  return parts.length > 1 ? parts : [line];
}

function splitQuoteThenProse(line: string): string[] {
  const parts = line.split(new RegExp(`(?<=[.!?]${CLOSE_QUOTE})\\s+(?=[A-Z])`));
  return parts.length > 1 ? parts : [line];
}

/** Split a smashed paragraph into printed conversation turns. */
export function splitSmashedDialogueTurns(line: string): string[] {
  const trimmed = line.trim();
  if (!trimmed) return [line];
  let parts = [trimmed];
  parts = parts.flatMap(splitAdjacentQuotes);
  parts = parts.flatMap(splitAfterSaidThenQuote);
  parts = parts.flatMap(splitQuoteThenProse);
  return parts.map((p) => p.trim()).filter(Boolean);
}

/**
 * Copy conversation layout: each spoken turn on its own line.
 * Idempotent when the source is already line-by-line.
 */
export function restoreDialogueLayout(text: string): string {
  const lines = text.replace(/\r\n/g, '\n').split('\n');
  const out: string[] = [];
  for (const line of lines) {
    if (!line.trim()) {
      out.push('');
      continue;
    }
    const turns = splitSmashedDialogueTurns(line);
    if (turns.length > 1 && turns.every((t) => isDialogueLine(t) || isAttributionLine(t))) {
      out.push(...turns);
    } else if (turns.length > 1 && turns.filter((t) => isDialogueLine(t)).length >= 2) {
      out.push(...turns);
    } else {
      out.push(line.replace(/[ \t]+$/g, ''));
    }
  }
  return out.join('\n').replace(/\n{3,}/g, '\n\n').trim();
}

export type LayoutUnit = { kind: 'prose' | 'dialogue'; text: string };

/** Group consecutive spoken lines so pagination can keep their newlines. */
export function splitDialogueAwareUnits(text: string): LayoutUnit[] {
  const restored = restoreDialogueLayout(text);
  const lines = restored.split('\n');
  const units: LayoutUnit[] = [];
  let kind: LayoutUnit['kind'] | null = null;
  let buf: string[] = [];

  const flush = () => {
    if (!kind || buf.length === 0) {
      kind = null;
      buf = [];
      return;
    }
    const joined = buf.join('\n').trim();
    if (joined) units.push({ kind, text: joined });
    kind = null;
    buf = [];
  };

  for (const raw of lines) {
    if (!raw.trim()) {
      flush();
      continue;
    }
    const line = raw.replace(/[ \t]+$/g, '');
    const prev = buf[buf.length - 1] ?? '';
    const spoken: boolean =
      isDialogueLine(line) || (kind === 'dialogue' && isDialogueContinuation(line, prev));
    const next: LayoutUnit['kind'] = spoken ? 'dialogue' : 'prose';
    if (kind && kind !== next) flush();
    kind = next;
    buf.push(line);
  }
  flush();
  return units;
}
