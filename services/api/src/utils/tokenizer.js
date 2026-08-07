"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.tokenizeText = tokenizeText;
exports.slugify = slugify;
exports.uniqueWordCount = uniqueWordCount;
const WORD_RE = /[\p{L}\p{M}']+/u;
const SENTENCE_END_RE = /[.!?…]+["')\]]*\s+/g;
function tokenizeText(text) {
    const tokenMap = [];
    const sentenceMap = [];
    let wordCount = 0;
    let tokenIndex = 0;
    const boundaries = [0];
    let match;
    const boundaryRe = /[.!?…]+["')\]]*\s+/g;
    while ((match = boundaryRe.exec(text)) !== null) {
        boundaries.push(match.index + match[0].length);
    }
    if (boundaries[boundaries.length - 1] !== text.length) {
        boundaries.push(text.length);
    }
    for (let s = 0; s < boundaries.length - 1; s++) {
        const start = boundaries[s];
        const end = boundaries[s + 1];
        if (end <= start)
            continue;
        sentenceMap.push({ index: s, start, end });
    }
    const wordRe = new RegExp(WORD_RE.source, 'gu');
    while ((match = wordRe.exec(text)) !== null) {
        const surface = match[0];
        const start = match.index;
        const end = start + surface.length;
        if (start > tokenIndex) {
            const gap = text.slice(tokenIndex, start);
            if (gap.length > 0) {
                tokenMap.push({
                    i: tokenMap.length,
                    start: tokenIndex,
                    end: start,
                    surface: gap,
                    lemma: null,
                    isWord: false,
                });
            }
        }
        tokenMap.push({
            i: tokenMap.length,
            start,
            end,
            surface,
            lemma: surface.toLowerCase(),
            isWord: true,
        });
        wordCount++;
        tokenIndex = end;
    }
    if (tokenIndex < text.length) {
        tokenMap.push({
            i: tokenMap.length,
            start: tokenIndex,
            end: text.length,
            surface: text.slice(tokenIndex),
            lemma: null,
            isWord: false,
        });
    }
    return { tokenMap, sentenceMap, wordCount };
}
function slugify(input) {
    return input
        .toLowerCase()
        .replace(/[^\p{L}\p{N}]+/gu, '-')
        .replace(/^-+|-+$/g, '')
        .slice(0, 120);
}
function uniqueWordCount(tokenMap) {
    const lemmas = new Set();
    for (const t of tokenMap) {
        if (t.isWord && t.lemma)
            lemmas.add(t.lemma);
    }
    return lemmas.size;
}
