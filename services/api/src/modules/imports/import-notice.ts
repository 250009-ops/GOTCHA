import type { ExtractedDocument } from './extract-text';
import { MAX_PDF_PAGES, OCR_MAX_PAGES } from './extract-text';

/**
 * Structured, user-facing import notices. Stored on user_imports.notice_code / notice_data and
 * rendered by the learner app in uz/ru/en. `message` is the English fallback for old clients.
 * Replaces the stale "Imported first 500 pages" string (the real cap is MAX_PDF_PAGES).
 */
export type ImportNotice =
  | {
      code: 'ocr_page_cap';
      data: { ocrPagesDone: number; ocrSkippedPages: number; ocrCap: number; firstSkippedPage: number | null; pageCount: number | null };
    }
  | { code: 'pdf_page_cap'; data: { pagesImported: number; pagesNotExtracted: number; pageCount: number | null } };

export type ImportNoticeLang = 'en' | 'ru' | 'uz';

export function buildImportNotices(doc: Pick<ExtractedDocument, 'ocrSkippedPages' | 'ocrPagesDone' | 'ocrFirstSkippedPage' | 'truncatedPages' | 'pagesNotExtracted' | 'pageCount'>): ImportNotice[] {
  const out: ImportNotice[] = [];
  if ((doc.ocrSkippedPages ?? 0) > 0) {
    out.push({
      code: 'ocr_page_cap',
      data: {
        ocrPagesDone: doc.ocrPagesDone ?? OCR_MAX_PAGES,
        ocrSkippedPages: doc.ocrSkippedPages ?? 0,
        ocrCap: OCR_MAX_PAGES,
        firstSkippedPage: doc.ocrFirstSkippedPage ?? null,
        pageCount: doc.pageCount ?? null,
      },
    });
  }
  if (doc.truncatedPages) {
    out.push({
      code: 'pdf_page_cap',
      data: { pagesImported: MAX_PDF_PAGES, pagesNotExtracted: doc.pagesNotExtracted ?? 0, pageCount: doc.pageCount ?? null },
    });
  }
  return out;
}

export function importNoticeMessage(n: ImportNotice, lang: ImportNoticeLang = 'en'): string {
  if (n.code === 'ocr_page_cap') {
    const { ocrPagesDone: done, ocrSkippedPages: skipped, ocrCap: cap } = n.data;
    if (lang === 'ru')
      return `Скан PDF: распознано ${done} стр. (лимит ${cap}). Ещё ${skipped} отсканированных стр. не распознаны и остались без текста. Разделите файл и импортируйте остаток отдельно.`;
    if (lang === 'uz')
      return `Skaner qilingan PDF: ${done} ta sahifa tanildi (chegara ${cap}). Yana ${skipped} ta skaner sahifa tanilmadi va matnsiz qoldi. Faylni bo‘lib, qolgan qismini alohida import qiling.`;
    return `Scanned PDF: ${done} pages were read with OCR (limit ${cap}). ${skipped} more scanned pages were not read and have no text. Split the file and import the rest separately.`;
  }
  const { pagesImported, pagesNotExtracted } = n.data;
  if (lang === 'ru') return `Импортированы первые ${pagesImported} стр.; ещё ${pagesNotExtracted} стр. не вошли (лимит ${pagesImported}).`;
  if (lang === 'uz') return `Dastlabki ${pagesImported} ta sahifa import qilindi; yana ${pagesNotExtracted} ta sahifa kirmadi (chegara ${pagesImported}).`;
  return `Imported the first ${pagesImported} pages; ${pagesNotExtracted} more pages were not included (limit ${pagesImported}).`;
}
