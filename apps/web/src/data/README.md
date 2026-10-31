# Landing data

## lookup-capture.json (hero word pop-up)
- **Edited from a real capture.** The hero pop-up copy is edited from a real production lookup that QA captured (`team/qa/lookup-capture-hesitation-uz.json`, 31 Oct 2026 14:09 UTC+5). It is not typed from scratch.
- **Unedited response:** `lookup-capture-hesitation-uz.raw.json`.
- **Edits (Kai's decision, 31 Oct 14:09):**
  - `translation`: the live gloss was the verb `ikkilanmoq` for the noun "hesitation", so it is shown as the noun `ikkilanish`.
  - `contextualMeaning`: kept as captured, with the apostrophe U+2018 normalised to U+02BB.
- **Sentence:** Crime and Punishment, Ch. IV: "He stood still in hesitation at the door, asking himself the strange question: 'Must he tell her who killed Lizaveta?'"
- **Languages:**
  - The `ru` and `en` QA files were byte-identical copies of the Uzbek gloss, so there is no real Russian or English capture.
  - The ru page shows no pop-up.
  - The en page shows the Uzbek capture, as in the design.
  - Don't add ru/en glosses by hand. Paste a real capture instead.
