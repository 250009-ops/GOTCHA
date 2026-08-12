import { api } from './api';

export type ImportType = 'paste' | 'url' | 'pdf' | 'epub';

export type ImportQuote = {
  gatewayEnabled: boolean;
  importType: ImportType;
  contentFormat: string;
  estimatedPages: number;
  tier: { id: string; label: string; minPages: number; maxPages: number | null; priceUzs: number } | null;
  amountUzs: number;
  amountTiyins: number;
  currency: 'UZS';
  isFree: boolean;
  freeReason: string | null;
  requiresPayment: boolean;
};

export type ImportCheckout = {
  quote: ImportQuote;
  paymentId: string;
  paymentUrl: string | null;
  status: string;
  isFree: boolean;
};

const PENDING_KEY = 'gotcha_pending_import';

export type PendingImport =
  | {
      kind: 'url';
      paymentId: string;
      url: string;
      title: string;
      lang: string;
    }
  | {
      kind: 'paste';
      paymentId: string;
      title: string;
      text: string;
      lang: string;
    }
  | {
      kind: 'file';
      paymentId: string;
      /** Stored as base64 — only for small files after pay redirect; large PDFs pay then re-upload. */
      fileName: string;
      fileType: string;
      fileBase64?: string;
      title: string;
      lang: string;
      needsReupload?: boolean;
    };

export function savePendingImport(payload: PendingImport) {
  sessionStorage.setItem(PENDING_KEY, JSON.stringify(payload));
}

export function loadPendingImport(): PendingImport | null {
  const raw = sessionStorage.getItem(PENDING_KEY);
  if (!raw) return null;
  try {
    return JSON.parse(raw) as PendingImport;
  } catch {
    return null;
  }
}

export function clearPendingImport() {
  sessionStorage.removeItem(PENDING_KEY);
}

export function formatUzs(amount: number) {
  return new Intl.NumberFormat('uz-UZ').format(Math.round(amount)) + " soʻm";
}

export async function quoteImport(body: {
  importType: ImportType;
  contentFormat?: string;
  textLength?: number;
  wordCount?: number;
  pageCount?: number;
}) {
  return api<ImportQuote>('/billing/imports/quote', {
    method: 'POST',
    body: JSON.stringify(body),
  });
}

export async function checkoutImport(body: {
  importType: ImportType;
  contentFormat?: string;
  textLength?: number;
  wordCount?: number;
  pageCount?: number;
  platform?: 'web' | 'android';
}) {
  return api<ImportCheckout>('/billing/imports/checkout', {
    method: 'POST',
    body: JSON.stringify({ ...body, platform: body.platform ?? 'web' }),
  });
}

export async function getImportPayment(paymentId: string) {
  return api<{ id: string; status: string; paymentUrl?: string | null; amountTiyins: number }>(
    `/billing/imports/payments/${paymentId}`,
  );
}

/** Quote + checkout; redirects to Atmos when payment is required. Returns paymentId when ready to import. */
export async function ensureImportPayment(opts: {
  importType: ImportType;
  contentFormat?: string;
  textLength?: number;
  wordCount?: number;
  pageCount?: number;
  onRedirect?: () => void;
  confirmPay?: (quote: ImportQuote) => boolean | Promise<boolean>;
}): Promise<{ paymentId: string | null; redirected: boolean }> {
  const quote = await quoteImport(opts);
  if (!quote.gatewayEnabled) {
    return { paymentId: null, redirected: false };
  }

  if (quote.requiresPayment) {
    const ok = opts.confirmPay ? await opts.confirmPay(quote) : true;
    if (!ok) throw new Error('Payment cancelled');
  }

  const checkout = await checkoutImport({ ...opts, platform: 'web' });
  if (checkout.paymentUrl) {
    opts.onRedirect?.();
    window.location.href = checkout.paymentUrl;
    return { paymentId: checkout.paymentId, redirected: true };
  }
  return { paymentId: checkout.paymentId, redirected: false };
}

export function wordCountOf(text: string) {
  return text.trim().split(/\s+/).filter(Boolean).length;
}
