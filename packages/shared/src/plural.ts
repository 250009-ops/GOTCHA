/** Locale-aware plural pickers (BUG-08). Uzbek nouns don't inflect after numerals. */
export function pluralEn(n: number, one: string, other: string): string {
  return Math.abs(n) === 1 ? one : other;
}

/** Russian: one (1, 21, 101…), few (2–4, 22–24…), many (0, 5–20, 11–14…). Fractions use `few`. */
export function pluralRu(n: number, one: string, few: string, many: string): string {
  if (!Number.isInteger(n)) return few;
  const a = Math.abs(n) % 100;
  const b = a % 10;
  if (a >= 11 && a <= 14) return many;
  if (b === 1) return one;
  if (b >= 2 && b <= 4) return few;
  return many;
}
