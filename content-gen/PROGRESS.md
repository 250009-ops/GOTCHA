# Content generation progress

Any agent can resume from the next file that is not listed under Done.

Updated: 2026-11-07

## Dictionary

Lemmas are lowercase surface forms from every published catalog book (not user imports). Scripts kept: Latin, Cyrillic, Arabic, Hangul. Uzbek oʻ/gʻ uses U+02BB. 300 lemmas per file, most frequent first.

| Language | Lemmas | Files | Tokens | Lemmas that cover 95% of tokens |
| --- | ---: | ---: | ---: | ---: |
| ar | 74,744 | 250 | 326,326 | 58,428 |
| de | 29,484 | 99 | 272,914 | 15,839 |
| en | 22,830 | 77 | 489,800 | 6,716 |
| ko | 40,197 | 134 | 102,252 | 35,085 |
| ru | 35,947 | 120 | 207,689 | 25,563 |
| tr | 18,389 | 62 | 63,244 | 15,227 |
| uz | 26,713 | 90 | 99,576 | 21,735 |
| **Total** | **248,304** | **832** | | |

- Todo: `content-gen/dictionary/todo/<lang>-NNN.json`
- Done: `content-gen/dictionary/done/<same name>.json`
- Done files: 0 / 832

## Mashq

Published catalog pages: 19,569. Too short to quiz: 1,921. Pages with at least 5 active questions after the free revalidation: 11,091. Pages still to write: 6,557 across 137 books, 404 files, 20 pages per file.

Paid OpenAI batch revalidation (no new model calls): 17,423 lines, 5,399 pages already had a bank, 5,680 pages newly accepted (36,940 questions inserted), 6,344 pages still failed the 5–8 rule.

- Todo: `content-gen/mashq/todo/<contentId>-NNN.json`
- Done: `content-gen/mashq/done/<same name>.json`
- Done files: 0 / 404

## Resume

Next dictionary file: `ar-001.json` (or the language you are assigned).
Next Mashq file: the first name in `content-gen/mashq/todo/`.
Do not commit `done/` when the folder is over 50 MB. Import with `services/api/scripts/content/import-content.ts --apply`.
