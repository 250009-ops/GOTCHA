# Content generation progress

Any agent can resume from the next file that is not listed under Done.

Updated: 2026-11-07

## Dictionary

The lookup key is the tapped surface form. Each entry also has `lemma`, the citation form (`eyes` → `eye`, `стал` → `стать`). Senses are everyday meanings, most common first. Uzbek uses Latin oʻ/gʻ (U+02BB).

Do not write a gloss in the source language when that language is English, Russian, or Uzbek. German, Turkish, Arabic, and Korean still need en, uz, and ru.

Files in `todo/` are the forms that cover 95% of word occurrences, most frequent first. `later/` waits; a live lookup covers those.

| Language | Lemmas | Tokens | Lemmas for 95% | Files for 95% | Later files |
| --- | ---: | ---: | ---: | ---: | ---: |
| ar | 74,744 | 326,326 | 58,428 | 195 | 55 |
| de | 29,484 | 272,914 | 15,839 | 53 | 46 |
| en | 22,830 | 489,800 | 6,716 | 23 | 54 |
| ko | 40,197 | 102,252 | 35,085 | 117 | 18 |
| ru | 35,947 | 207,689 | 25,563 | 86 | 35 |
| tr | 18,389 | 63,244 | 15,227 | 51 | 11 |
| uz | 26,713 | 99,576 | 21,735 | 73 | 17 |
| **Total** | **248,304** | | **178,593** | **598** | **236** |

- Todo: `content-gen/dictionary/todo/<lang>-NNN.json`
- Later: `content-gen/dictionary/later/<lang>-NNN.json`
- Done: `content-gen/dictionary/done/<same name>.json`
- Done files: 0 / 598

Work the 95% files by how many occurrences that file covers, not alphabetically. First chunk:

`en-001`, `de-001`, `ar-001`, `ru-001`, `en-002`, `uz-001`, `ko-001`, `tr-001`, `en-003`, `de-002`, `ar-002`, `ru-002`, `en-004`, `ar-003`, `de-003`, `en-005`, `ar-004`, `ru-003`, `uz-002`, `en-006`

## Mashq

Published catalog pages: 19,569. Too short to quiz: 1,921. Pages with at least 5 active questions: 11,091. Pages still to write: 6,557 across 137 books, 404 files.

Each page carries `contentId` and the real `segmentIndex`. `page_index` is not the page number: on The Pearl it stays 0 for later segments (segments 37, 122, and 177 were all stored as page 0).

Reader order uses distinct users in `reading_progress` or `reading_sessions`. Production has 1 such user and 1 book (Şahmerdan). That book is not in this queue. Every remaining book has 0 readers, so the files are title order. The first file is `001-…-001.json` (Anor).

- Todo: `content-gen/mashq/todo/<rank>-<contentId>-NNN.json`
- Done: `content-gen/mashq/done/<same name>.json`
- Done files: 0 / 404

## Quality sample

Re-checked after the fixes. Not imported.

- Dictionary: 50 entries. `sind` is now `-dir / boʻlmoq`, lemma `sein`. Validator: dictOk 50, dictRejected 0.
- Mashq: 20 pages, 100 questions. Pearl segments are 0, 37, 122, 177. Ses segments are 0, 9, 13, 14. Validator: mashqQuestions 100, mashqRejected 0.
- Mashq shuffles options when a session is served (`shuffleAnswerOptions`). A stored answer at index 0 is not served at index 0.

## Resume

Next dictionary chunk: the 20 files listed above.
Next Mashq file: the first name in `content-gen/mashq/todo/`.
Import with `services/api/scripts/content/import-content.ts --apply` after migration `0049_dictionary_headword`.
Do not commit `done/` when the folder is over 50 MB.
