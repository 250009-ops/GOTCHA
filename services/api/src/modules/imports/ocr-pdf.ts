import { execFile } from 'child_process';
import { mkdtemp, rm, writeFile } from 'fs/promises';
import { availableParallelism, cpus, tmpdir } from 'os';
import { join } from 'path';
import { promisify } from 'util';
import { Logger } from '@nestjs/common';
import { PDFParse } from 'pdf-parse';
import { cleanPdfPageText, hasUsableLearnerText } from './import-text-cleaner';

const execFileAsync = promisify(execFile);
const logger = new Logger('OcrPdf');

/** Max pages rendered at once — keep small so screenshots + OCR stay under PM2 RAM. */
export const OCR_RENDER_BATCH = 4;
/** Target page width (~180 DPI on letter). Caps huge scans without hurting novel accuracy. */
export const OCR_TARGET_WIDTH_PX = 1600;
/** Per-page OCR wall clock — skip a hung page instead of failing the whole book. */
export const OCR_PAGE_TIMEOUT_MS = 45_000;
/** PSM 4: single column, variable sizes — faster than auto layout, accurate for books. */
const TESSERACT_PSM = '4';
const TESSERACT_OEM = '1';
const TESSERACT_DPI = '180';

let nativeBinCache: string | null | undefined;
let nativeLangsCache: Set<string> | null = null;

async function listNativeLangs(bin: string): Promise<Set<string>> {
  if (nativeLangsCache) return nativeLangsCache;
  try {
    const { stdout, stderr } = await execFileAsync(bin, ['--list-langs'], {
      timeout: 5_000,
      windowsHide: true,
    });
    nativeLangsCache = new Set(
      `${stdout}\n${stderr}`
        .split(/\r?\n/)
        .map((s) => s.trim())
        .filter((s) => s && !/^list of (available )?languages/i.test(s)),
    );
  } catch {
    nativeLangsCache = new Set();
  }
  return nativeLangsCache;
}

function nativeSupportsLang(available: Set<string>, lang: string): boolean {
  if (available.size === 0) return false;
  return lang.split('+').every((code) => available.has(code));
}

export function cpuCount(): number {
  try {
    return Math.max(1, availableParallelism());
  } catch {
    return Math.max(1, cpus()?.length ?? 1);
  }
}

/**
 * Native tesseract is ~5–10× faster than WASM and uses far less Node heap.
 * WASM stays as fallback when the OS package is missing.
 */
export function ocrConcurrency(native: boolean): number {
  const raw = Number(process.env.OCR_CONCURRENCY);
  if (Number.isFinite(raw) && raw >= 1) {
    return Math.min(8, Math.floor(raw));
  }
  const cpusN = cpuCount();
  return Math.max(1, Math.min(native ? 4 : 2, cpusN));
}

/** Map app language to a tesseract traineddata code. Uzbek has no solid pack — use eng. */
export function tesseractLangFor(language?: string | null): { lang: string; note?: string } {
  const code = (language || 'en').toLowerCase();
  if (code === 'ru' || code === 'rus') {
    return {
      lang: 'rus+eng',
      note: 'Russian OCR uses rus+eng; accuracy is lower than English text PDFs.',
    };
  }
  if (code === 'uz' || code === 'uzb') {
    return {
      lang: 'eng',
      note: 'Uzbek OCR is not well supported; English OCR is used and accuracy may be poor for Cyrillic/Latin UZ text.',
    };
  }
  const tess: Record<string, string> = {
    fr: 'fra+eng',
    es: 'spa+eng',
    de: 'deu+eng',
    pt: 'por+eng',
    ja: 'jpn+eng',
    ko: 'kor+eng',
  };
  if (tess[code]) return { lang: tess[code] };
  return { lang: 'eng' };
}

function tesseractCandidates(): string[] {
  if (process.platform === 'win32') {
    return [
      'tesseract',
      'C:\\Program Files\\Tesseract-OCR\\tesseract.exe',
      'C:\\Program Files (x86)\\Tesseract-OCR\\tesseract.exe',
    ];
  }
  return ['tesseract', '/usr/bin/tesseract'];
}

export async function resolveNativeTesseract(): Promise<string | null> {
  if (nativeBinCache !== undefined) return nativeBinCache;
  for (const cmd of tesseractCandidates()) {
    try {
      await execFileAsync(cmd, ['--version'], { timeout: 5_000, windowsHide: true });
      nativeBinCache = cmd;
      return cmd;
    } catch {
      // try next
    }
  }
  nativeBinCache = null;
  return null;
}

/** Test helper — do not use in production paths. */
export function resetNativeTesseractCache(): void {
  nativeBinCache = undefined;
  nativeLangsCache = null;
}

async function nativeRecognize(bin: string, image: Buffer, lang: string): Promise<string> {
  const dir = await mkdtemp(join(tmpdir(), 'gotcha-ocr-'));
  const imgPath = join(dir, 'page.png');
  try {
    await writeFile(imgPath, image);
    const { stdout } = await execFileAsync(
      bin,
      [imgPath, 'stdout', '-l', lang, '--oem', TESSERACT_OEM, '--psm', TESSERACT_PSM, '--dpi', TESSERACT_DPI],
      { timeout: OCR_PAGE_TIMEOUT_MS, maxBuffer: 8 * 1024 * 1024, windowsHide: true },
    );
    return String(stdout || '');
  } finally {
    await rm(dir, { recursive: true, force: true }).catch(() => undefined);
  }
}

type RecognizeFn = (image: Buffer) => Promise<string>;

function withTimeout<T>(promise: Promise<T>, ms: number, message: string): Promise<T> {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error(message)), ms);
    promise.then(
      (value) => {
        clearTimeout(timer);
        resolve(value);
      },
      (err) => {
        clearTimeout(timer);
        reject(err);
      },
    );
  });
}

async function createWasmRecognizer(lang: string, workers: number): Promise<{
  recognize: RecognizeFn;
  terminate: () => Promise<void>;
}> {
  const { createWorker, createScheduler } = await import('tesseract.js');
  const scheduler = createScheduler();
  const cachePath = join(tmpdir(), 'gotcha-tessdata');
  await Promise.all(
    Array.from({ length: Math.max(1, workers) }, async () => {
      const worker = await createWorker(lang, 1, { cachePath, gzip: true });
      await worker.setParameters({
        tessedit_pageseg_mode: TESSERACT_PSM as never,
        user_defined_dpi: TESSERACT_DPI,
        preserve_interword_spaces: '1',
      });
      scheduler.addWorker(worker);
    }),
  );

  return {
    recognize: async (image) => {
      const result = await scheduler.addJob('recognize', image, undefined, { text: true });
      return result.data.text || '';
    },
    terminate: async () => {
      await scheduler.terminate().catch(() => undefined);
    },
  };
}

/**
 * OCR specific 1-based page numbers. Renders a few pages at a time, OCRs them
 * in parallel, and reports progress after each page.
 */
export async function ocrPdfPageNumbers(
  buffer: Buffer,
  pageNumbers: number[],
  options?: {
    language?: string | null;
    onPageDone?: (completed: number) => void | Promise<void>;
  },
): Promise<Map<number, string>> {
  const out = new Map<number, string>();
  if (pageNumbers.length === 0) return out;

  const { lang } = tesseractLangFor(options?.language);
  const nativeBin = await resolveNativeTesseract();
  const nativeLangs = nativeBin ? await listNativeLangs(nativeBin) : new Set<string>();
  const native = Boolean(nativeBin && nativeSupportsLang(nativeLangs, lang));
  const concurrency = ocrConcurrency(native);
  const renderBatch = Math.max(1, Math.min(OCR_RENDER_BATCH, concurrency));

  logger.log(
    `OCR ${pageNumbers.length} page(s) via ${native ? 'native tesseract' : 'tesseract.js'} (concurrency=${concurrency}, lang=${lang})`,
  );
  const started = Date.now();

  const wasm = native
    ? null
    : await createWasmRecognizer(lang, concurrency);
  const recognize: RecognizeFn = native && nativeBin
    ? (image) => nativeRecognize(nativeBin, image, lang)
    : wasm!.recognize;

  const parser = new PDFParse({ data: buffer });
  try {
    for (let i = 0; i < pageNumbers.length; i += renderBatch) {
      const batch = pageNumbers.slice(i, i + renderBatch);
      const shots = await parser.getScreenshot({
        partial: batch,
        desiredWidth: OCR_TARGET_WIDTH_PX,
        imageBuffer: true,
        imageDataUrl: false,
      });

      const counted = new Set<number>();
      await Promise.all(
        shots.pages.map(async (page) => {
          const data = page.data;
          const pageNum = page.pageNumber;
          try {
            if (!data?.length || !pageNum) return;
            const raw = await withTimeout(
              recognize(Buffer.from(data)),
              OCR_PAGE_TIMEOUT_MS,
              `OCR timed out on page ${pageNum}`,
            );
            const text = cleanPdfPageText(raw);
            if (hasUsableLearnerText(text)) out.set(pageNum, text);
          } catch (err) {
            logger.warn(
              `OCR failed on page ${pageNum}: ${err instanceof Error ? err.message : err}`,
            );
          } finally {
            if (pageNum) {
              counted.add(pageNum);
              if (options?.onPageDone) await options.onPageDone(1);
            }
          }
        }),
      );
      for (const pageNum of batch) {
        if (counted.has(pageNum)) continue;
        counted.add(pageNum);
        if (options?.onPageDone) await options.onPageDone(1);
      }
    }
  } finally {
    await parser.destroy().catch(() => undefined);
    if (wasm) await wasm.terminate().catch(() => undefined);
  }

  logger.log(
    `OCR finished ${out.size}/${pageNumbers.length} page(s) in ${Math.round((Date.now() - started) / 1000)}s`,
  );
  return out;
}
