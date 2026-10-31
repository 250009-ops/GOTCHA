import { api } from './api';

export type BillingCopy = {
  today: string;
  thisMonth: string;
  thisYear: string;
  importsFree: string;
  freeImportsLeft: (remaining: number, total: number, cycle: string) => string;
  freePagesLeft: (remaining: number, total: number, cycle: string) => string;
  configuredPool: (dailyImports: number, pageLimit: number, cycle: string) => string;
};

export type ImportType = 'paste' | 'url' | 'pdf' | 'epub';

export type ImportFreeAllowance = {
  gatewayEnabled: boolean;
  resetCycle: string;
  allowedFormats: string[];
  dailyFreeImportsPerUser: number;
  dailyFreeUsed: number;
  dailyFreeRemaining: number;
  monthlyFreePageLimit: number;
  monthlyPagesUsed: number;
  monthlyPagesRemaining: number;
};

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
  freeLimits?: ImportFreeAllowance;
  listAmountUzs?: number;
  discountUzs?: number;
  promo?: { id: string; code: string } | null;
};

export type ImportCheckout = {
  quote: ImportQuote;
  paymentId: string;
  account: string;
  transactionId: number | null;
  status: string;
  isFree: boolean;
  step: 'done' | 'card' | 'otp' | 'paid';
};

export type PreApplyResult = {
  paymentId: string;
  maskedPhone?: string;
  step: 'otp';
};

export type ApplyResult = {
  paymentId: string;
  status: string;
  ofdUrl?: string;
  step: 'paid' | 'otp' | 'card';
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
  promoCode?: string;
}) {
  return api<ImportQuote>('/billing/imports/quote', {
    method: 'POST',
    body: JSON.stringify(body),
  });
}

export async function inspectImportFile(file: File) {
  const form = new FormData();
  form.append('file', file);
  return api<{ importType: 'pdf' | 'epub'; pageCount: number }>('/imports/inspect', {
    method: 'POST',
    body: form,
  });
}

export async function checkoutImport(body: {
  importType: ImportType;
  contentFormat?: string;
  textLength?: number;
  wordCount?: number;
  pageCount?: number;
  platform?: 'web' | 'android';
  promoCode?: string;
}) {
  return api<ImportCheckout>('/billing/imports/checkout', {
    method: 'POST',
    body: JSON.stringify({ ...body, platform: body.platform ?? 'web' }),
  });
}

export async function preApplyPayment(paymentId: string, cardNumber: string, expiry: string) {
  return api<PreApplyResult>(`/billing/imports/payments/${paymentId}/pre-apply`, {
    method: 'POST',
    body: JSON.stringify({ cardNumber, expiry }),
  });
}

export async function applyPayment(paymentId: string, otp: string) {
  return api<ApplyResult>(`/billing/imports/payments/${paymentId}/apply`, {
    method: 'POST',
    body: JSON.stringify({ otp }),
  });
}

export async function retryOtp(paymentId: string) {
  return api<{ paymentId: string; step: 'otp' }>(`/billing/imports/payments/${paymentId}/retry-otp`, {
    method: 'POST',
  });
}

export async function cancelPayment(paymentId: string, reason?: string) {
  return api<{ paymentId: string; status: string }>(`/billing/imports/payments/${paymentId}/cancel`, {
    method: 'POST',
    body: JSON.stringify({ reason }),
  });
}

export type CatalogAccess = {
  contentId: string;
  title: string;
  isFree: boolean;
  priceUzs: number;
  currency: 'UZS';
  accessGranted: boolean;
  gatewayEnabled: boolean;
};

export type CatalogCheckout = CatalogAccess & {
  paymentId: string | null;
  account: string | null;
  transactionId: number | null;
  status: string;
  step: 'done' | 'card' | 'otp' | 'paid';
};

export async function catalogAccess(contentId: string) {
  return api<CatalogAccess>(`/billing/content/${contentId}/access`);
}

export async function checkoutCatalog(contentId: string, promoCode?: string) {
  return api<CatalogCheckout>(`/billing/content/${contentId}/checkout`, {
    method: 'POST',
    body: JSON.stringify(promoCode ? { promoCode } : {}),
  });
}

export async function getImportPayment(paymentId: string) {
  return api<{ id: string; status: string; paymentUrl?: string | null; amountTiyins: number; ofdUrl?: string }>(
    `/billing/imports/payments/${paymentId}`,
  );
}

export function wordCountOf(text: string) {
  return text.trim().split(/\s+/).filter(Boolean).length;
}

export function pageWindowLabel(resetCycle: string | null | undefined, billing: BillingCopy) {
  if (resetCycle === 'daily') return billing.today;
  if (resetCycle === 'yearly') return billing.thisYear;
  return billing.thisMonth;
}

export function formatFreeAllowance(allowance: ImportFreeAllowance, billing: BillingCopy) {
  const pagesWindow = pageWindowLabel(allowance.resetCycle, billing);
  // final-5 (b): the free allowance is enforced with the gateway off too, so always show what is left.
  const line = `${billing.freeImportsLeft(
    allowance.dailyFreeRemaining,
    allowance.dailyFreeImportsPerUser,
    billing.today,
  )} · ${billing.freePagesLeft(
    allowance.monthlyPagesRemaining,
    allowance.monthlyFreePageLimit,
    pagesWindow,
  )}.`;
  return line.charAt(0).toUpperCase() + line.slice(1);
}

export function isValidCardNumber(cardNumber: string) {
  const digits = cardNumber.replace(/\s/g, '');
  return digits.length >= 16 && digits.length <= 19 && /^\d+$/.test(digits);
}

export function isValidCardExpiry(expiry: string) {
  const digits = expiry.replace(/\D/g, '');
  if (digits.length !== 4) return false;
  const month = Number(digits.slice(0, 2));
  return month >= 1 && month <= 12;
}
