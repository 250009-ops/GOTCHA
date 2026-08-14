import { createHash } from 'crypto';
import { BadRequestException, Injectable, Logger, ServiceUnavailableException } from '@nestjs/common';

type TokenCache = { accessToken: string; expiresAt: number };

export type AtmosTransactionCreateResult = {
  transactionId: number;
  storeTransactionId: number;
  amount: number;
  account: string;
  raw: unknown;
};

export type AtmosPreApplyResult = {
  transactionId: number;
  maskedPhone?: string;
  raw: unknown;
};

export type AtmosApplyResult = {
  transactionId: number;
  successTransId?: number;
  confirmed: boolean;
  ofdUrl?: string;
  statusCode?: string;
  statusMessage?: string;
  raw: unknown;
};

export type AtmosTransactionStatus = {
  transactionId: number;
  successTransId?: number;
  confirmed: boolean;
  amount: number;
  account: string;
  statusCode?: string;
  statusMessage?: string;
  prepayTime?: number;
  confirmTime?: number;
  ofdUrl?: string;
  raw: unknown;
};

type AtmosMerchantResponse = {
  result?: { code?: string; description?: string };
  transaction_id?: string | number;
  store_transaction?: {
    trans_id?: string | number;
    success_trans_id?: string | number | null;
    confirmed?: boolean;
    amount?: number;
    account?: string;
    terminal_id?: string | number;
    status_code?: string | null;
    status_message?: string | null;
    prepay_time?: number | null;
    confirm_time?: number | null;
  };
  ofd_url?: string;
  phone?: string;
};

export function normalizeCardNumber(cardNumber: string): string {
  return cardNumber.replace(/\s+/g, '');
}

export function normalizeExpiryToYymm(expiry: string): string {
  const digits = expiry.replace(/\D/g, '');
  if (digits.length !== 4) {
    throw new BadRequestException('Expiry must be 4 digits in MM/YY format (e.g. 03/30).');
  }

  const first = Number(digits.slice(0, 2));
  const second = Number(digits.slice(2, 4));

  if (first >= 1 && first <= 12) {
    return `${digits.slice(2, 4)}${digits.slice(0, 2)}`;
  }

  if (second >= 1 && second <= 12) {
    return digits;
  }

  throw new BadRequestException('Invalid expiry. Use MM/YY (e.g. 03/30 for March 2030).');
}

export function validateCardForAtmos(
  cardNumber: string,
  expiry: string,
): {
  cardNumber: string;
  expiry: string;
} {
  const digits = normalizeCardNumber(cardNumber);
  if (digits.length < 16 || digits.length > 19) {
    throw new BadRequestException('Card number must be 16–19 digits.');
  }
  if (!/^\d+$/.test(digits)) {
    throw new BadRequestException('Card number must contain only digits.');
  }

  const yymm = normalizeExpiryToYymm(expiry);
  const month = Number(yymm.slice(2, 4));
  if (month < 1 || month > 12) {
    throw new BadRequestException('Invalid expiry month. Use MM/YY (e.g. 03/30).');
  }

  return { cardNumber: digits, expiry: yymm };
}

function mapAtmosCardError(description: string | undefined): string {
  const raw = (description ?? '').trim();
  const lower = raw.toLowerCase();

  if (!raw) {
    return 'Card verification failed. Please check your card details and try again.';
  }
  if (
    raw.includes('\u041d\u0435\u043f\u0440\u0430\u0432\u0438\u043b') ||
    lower.includes('parametr') ||
    lower.includes('invalid')
  ) {
    return 'Invalid card number or expiry. Check the number and use expiry as MM/YY (e.g. 03/30).';
  }
  if (raw.includes('\u0438\u0441\u0442\u0435\u043a') || lower.includes('expir')) {
    return 'This card has expired. Please use a different card.';
  }
  if (raw.includes('\u043d\u0435\u0434\u043e\u0441\u0442\u0430\u0442') || lower.includes('insufficient')) {
    return 'Insufficient funds on this card.';
  }

  return 'Card verification failed. Please check your card details and try again.';
}

export function normalizeOtp(otp: string): number {
  const digits = otp.replace(/\s+/g, '');
  if (!/^\d{4,8}$/.test(digits)) {
    throw new BadRequestException('OTP must be 4–8 digits.');
  }
  return Number(digits);
}

function mapAtmosCreateError(code: string | undefined, description: string | undefined): string {
  const resultCode = String(code ?? '').toUpperCase();
  if (resultCode === 'STPIMS-ERR-042') {
    return 'Payment amount is below the minimum allowed for card payments. Please contact support.';
  }
  if (resultCode === 'STPIMS-ERR-103') {
    return 'Payment terminal is not configured correctly. Please try again in a few minutes or contact support.';
  }
  const raw = (description ?? '').trim();
  if (raw.includes('\u0442\u0435\u0440\u043c\u0438\u043d\u0430\u043b') || raw.toLowerCase().includes('terminal')) {
    return 'Payment terminal is not configured correctly. Please try again in a few minutes or contact support.';
  }
  if (raw.includes('\u0441\u0443\u043c\u043c') || raw.toLowerCase().includes('amount')) {
    return 'Payment amount is not allowed for this transaction. Please contact support.';
  }
  return 'Unable to start payment. Please try again in a few minutes or contact support.';
}

function mapAtmosApplyError(code: string | undefined, description: string | undefined): string {
  const resultCode = String(code ?? '').toUpperCase();
  if (resultCode === 'STPIMS-ERR-098') {
    return 'Incorrect SMS code. Please check the code and try again.';
  }
  if (resultCode === 'STPIMS-ERR-092') {
    return 'This payment session has expired. Go back and start checkout again.';
  }
  if (resultCode === 'STPIMS-ERR-093') {
    return 'Payment could not be completed due to a billing system error. Please try again in a few minutes or contact support.';
  }
  return mapAtmosOtpError(description);
}

function mapAtmosOtpError(description: string | undefined): string {
  const raw = (description ?? '').trim();
  const lower = raw.toLowerCase();

  if (!raw) {
    return 'Invalid or expired SMS code. Please try again or request a new code.';
  }
  if (
    lower.includes('otp') ||
    lower.includes('sms') ||
    lower.includes('code') ||
    raw.includes('\u043a\u043e\u0434') ||
    raw.includes('\u043d\u0435\u0432\u0435\u0440\u043d')
  ) {
    return 'Incorrect SMS code. Please check the code and try again.';
  }
  if (raw.includes('\u0438\u0441\u0442\u0435\u043a') || lower.includes('expir')) {
    return 'SMS code expired. Tap "Resend Code" and enter the new code.';
  }
  if (raw.includes('\u0437\u0430\u043a\u0440\u044b\u0442') || lower.includes('closed')) {
    return 'This payment session has expired. Go back and start checkout again.';
  }
  if (lower.includes('attempt') || raw.includes('\u043f\u043e\u043f\u044b\u0442')) {
    return 'Too many incorrect attempts. Request a new SMS code or use a different card.';
  }
  if (raw.includes('\u0431\u0438\u043b\u043b\u0438\u043d\u0433') || lower.includes('billing')) {
    return 'Payment could not be completed due to a billing system error. Please try again in a few minutes or contact support.';
  }

  return 'Payment confirmation failed. Please check the SMS code and try again.';
}

/** Minimum Atmos charge in UZS (soʻm). Default 500 per Atmos tech team. */
export function atmosMinAmountSom(): number {
  const minSom = Number(process.env.ATMOS_MIN_AMOUNT_SOM ?? 500);
  return Number.isFinite(minSom) ? Math.max(0, minSom) : 500;
}

/** Reject admin pricing values below the Atmos minimum (0 is allowed = free). */
export function assertAtmosMinPriceSom(price: number, fieldLabel: string): void {
  const min = atmosMinAmountSom();
  if (price > 0 && price < min) {
    throw new BadRequestException(
      `${fieldLabel} must be at least ${min.toLocaleString()} soʻm (Atmos minimum). Current value: ${Math.round(price).toLocaleString()} soʻm.`,
    );
  }
}

@Injectable()
export class AtmosClient {
  private readonly logger = new Logger(AtmosClient.name);
  private tokenCache: TokenCache | null = null;

  private baseUrl() {
    return (process.env.ATMOS_API_BASE || 'https://apigw.atmos.uz').replace(/\/$/, '');
  }

  configured(): boolean {
    return Boolean(
      process.env.ATMOS_CONSUMER_KEY?.trim() &&
        process.env.ATMOS_CONSUMER_SECRET?.trim() &&
        process.env.ATMOS_STORE_ID?.trim(),
    );
  }

  storeId(): number {
    const id = Number(process.env.ATMOS_STORE_ID);
    if (!Number.isFinite(id)) throw new ServiceUnavailableException('ATMOS_STORE_ID is not configured');
    return id;
  }

  ikpu(): string {
    return process.env.ATMOS_IKPU?.trim() || '10899001001000000';
  }

  merchantTin(): string {
    return process.env.ATMOS_MERCHANT_TIN?.trim() || '';
  }

  /**
   * Minimum transaction amount in tiyins.
   * Atmos merchant accounts require a minimum (500 soʻm per Atmos tech team).
   * Configure via ATMOS_MIN_AMOUNT_SOM env var; defaults to 500 soʻm.
   */
  minAmountTiyins(): number {
    return atmosMinAmountSom() * 100;
  }

  private basicAuthHeader() {
    const key = process.env.ATMOS_CONSUMER_KEY?.trim();
    const secret = process.env.ATMOS_CONSUMER_SECRET?.trim();
    if (!key || !secret) {
      throw new ServiceUnavailableException('Atmos credentials are not configured');
    }
    return `Basic ${Buffer.from(`${key}:${secret}`).toString('base64')}`;
  }

  async getAccessToken(): Promise<string> {
    const now = Date.now();
    if (this.tokenCache && this.tokenCache.expiresAt > now + 30_000) {
      return this.tokenCache.accessToken;
    }

    const url = `${this.baseUrl()}/token?grant_type=client_credentials`;
    const res = await fetch(url, {
      method: 'POST',
      headers: {
        Authorization: this.basicAuthHeader(),
        Accept: 'application/json',
      },
    });
    const body = (await res.json().catch(() => ({}))) as {
      access_token?: string;
      expires_in?: number;
      error?: string;
      error_description?: string;
    };
    if (!res.ok || !body.access_token) {
      this.logger.error(`Atmos token failed: ${res.status} ${JSON.stringify(body)}`);
      const detail = body.error_description || body.error || `HTTP ${res.status}`;
      throw new ServiceUnavailableException(
        `Unable to authenticate with Atmos (${detail}). Check ATMOS_CONSUMER_KEY/SECRET for this store.`,
      );
    }
    const expiresIn = Number(body.expires_in ?? 3600);
    this.tokenCache = {
      accessToken: body.access_token,
      expiresAt: now + expiresIn * 1000,
    };
    return body.access_token;
  }

  /**
   * 1. Create Transaction
   * POST /merchant/pay/create
   * Creates a draft transaction for the given amount (in tiyins).
   */
  async createTransaction(params: {
    account: string;
    amountTiyins: number;
  }): Promise<AtmosTransactionCreateResult> {
    if (!this.configured()) {
      throw new ServiceUnavailableException('Atmos is not configured');
    }
    const token = await this.getAccessToken();
    const storeId = this.storeId();

    // Do NOT send terminal_id — Atmos auto-selects the store's ePOS terminal.
    // Explicit terminal_id (even the correct ID) returns STPIMS-ERR-103 on this store.
    const payload: Record<string, unknown> = {
      amount: params.amountTiyins,
      account: params.account,
      store_id: storeId,
    };

    this.logger.log(
      `Atmos merchant/pay/create request: ${JSON.stringify({ ...payload, account: '[redacted]' })}`,
    );

    const res = await fetch(`${this.baseUrl()}/merchant/pay/create`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
        Accept: 'application/json',
      },
      body: JSON.stringify(payload),
    });
    const raw = (await res.json().catch(() => ({}))) as AtmosMerchantResponse;
    const resultCode = String(raw.result?.code ?? '').toUpperCase();
    const transactionId = Number(raw.transaction_id ?? raw.store_transaction?.trans_id);

    if (!res.ok || resultCode !== 'OK' || !Number.isFinite(transactionId)) {
      this.logger.error(
        `Atmos merchant/pay/create failed: ${res.status} code=${resultCode} ${JSON.stringify(raw)}`,
      );
      throw new ServiceUnavailableException(mapAtmosCreateError(raw.result?.code, raw.result?.description));
    }

    this.logger.log(
      `Atmos merchant/pay/create ok: transactionId=${transactionId} terminal=${raw.store_transaction?.terminal_id ?? 'auto'}`,
    );

    return {
      transactionId,
      storeTransactionId: Number(raw.store_transaction?.trans_id ?? transactionId),
      amount: Number(raw.store_transaction?.amount ?? params.amountTiyins),
      account: String(raw.store_transaction?.account ?? params.account),
      raw,
    };
  }

  /**
   * 2. Pre-confirm Transaction
   * POST /merchant/pay/pre-apply
   * Sends OTP to cardholder. Requires card number and expiry (YYmm).
   */
  async preApplyTransaction(params: {
    transactionId: number;
    cardNumber: string;
    expiry: string;
  }): Promise<AtmosPreApplyResult> {
    const token = await this.getAccessToken();
    const storeId = this.storeId();

    const payload = {
      transaction_id: params.transactionId,
      card_number: normalizeCardNumber(params.cardNumber),
      expiry: normalizeExpiryToYymm(params.expiry),
      store_id: storeId,
    };

    this.logger.log(
      `Atmos merchant/pay/pre-apply request: transaction_id=${params.transactionId} store_id=${storeId}`,
    );

    const res = await fetch(`${this.baseUrl()}/merchant/pay/pre-apply`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
        Accept: 'application/json',
      },
      body: JSON.stringify(payload),
    });
    const raw = (await res.json().catch(() => ({}))) as AtmosMerchantResponse & { phone?: string };
    const resultCode = String(raw.result?.code ?? '').toUpperCase();

    if (!res.ok || resultCode !== 'OK') {
      this.logger.error(`Atmos merchant/pay/pre-apply failed: ${res.status} ${JSON.stringify(raw)}`);
      throw new ServiceUnavailableException(mapAtmosCardError(raw.result?.description));
    }

    return {
      transactionId: Number(raw.transaction_id ?? params.transactionId),
      maskedPhone: raw.phone,
      raw,
    };
  }

  /**
   * 2b. Pre-confirm Transaction with saved card token
   * POST /merchant/pay/pre-apply
   * Uses card_token instead of card_number/expiry for saved cards.
   */
  async preApplyWithToken(params: {
    transactionId: number;
    cardToken: string;
  }): Promise<AtmosPreApplyResult> {
    const token = await this.getAccessToken();
    const storeId = this.storeId();

    const payload = {
      transaction_id: params.transactionId,
      card_token: params.cardToken,
      store_id: storeId,
    };

    const res = await fetch(`${this.baseUrl()}/merchant/pay/pre-apply`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
        Accept: 'application/json',
      },
      body: JSON.stringify(payload),
    });
    const raw = (await res.json().catch(() => ({}))) as AtmosMerchantResponse & { phone?: string };
    const resultCode = String(raw.result?.code ?? '').toUpperCase();

    if (!res.ok || resultCode !== 'OK') {
      this.logger.error(`Atmos merchant/pay/pre-apply (token) failed: ${res.status} ${JSON.stringify(raw)}`);
      const detail = raw.result?.description || `HTTP ${res.status}`;
      throw new ServiceUnavailableException(`Card token verification failed (${detail}).`);
    }

    return {
      transactionId: Number(raw.transaction_id ?? params.transactionId),
      maskedPhone: raw.phone,
      raw,
    };
  }

  /**
   * 3. Confirm Transaction (Apply)
   * POST /merchant/pay/apply
   * Confirms the transaction with the OTP received by cardholder.
   */
  async applyTransaction(params: {
    transactionId: number;
    otp: string;
  }): Promise<AtmosApplyResult> {
    const token = await this.getAccessToken();
    const storeId = this.storeId();
    const otp = normalizeOtp(params.otp);

    const payload = {
      transaction_id: params.transactionId,
      otp,
      store_id: storeId,
    };

    const res = await fetch(`${this.baseUrl()}/merchant/pay/apply`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
        Accept: 'application/json',
      },
      body: JSON.stringify(payload),
    });
    const raw = (await res.json().catch(() => ({}))) as AtmosMerchantResponse;
    const resultCode = String(raw.result?.code ?? '').toUpperCase();
    const storeTx = raw.store_transaction;
    const confirmed = storeTx?.confirmed === true;

    if (resultCode === 'OK' || confirmed) {
      return {
        transactionId: Number(raw.transaction_id ?? params.transactionId),
        successTransId: storeTx?.success_trans_id != null ? Number(storeTx.success_trans_id) : undefined,
        confirmed: true,
        ofdUrl: raw.ofd_url,
        statusCode: storeTx?.status_code ?? undefined,
        statusMessage: storeTx?.status_message ?? undefined,
        raw,
      };
    }

    const pollOnCodes = new Set(['STPIMS-ERR-092', 'STPIMS-ERR-093', 'STPIMS-ERR-065']);
    if (pollOnCodes.has(resultCode)) {
      const remote = await this.getTransaction(params.transactionId);
      if (remote?.confirmed) {
        this.logger.warn(
          `Atmos merchant/pay/apply returned ${resultCode}; transaction ${params.transactionId} is confirmed via get`,
        );
        return {
          transactionId: remote.transactionId,
          successTransId: remote.successTransId,
          confirmed: true,
          ofdUrl: remote.ofdUrl,
          statusCode: remote.statusCode,
          statusMessage: remote.statusMessage,
          raw: remote.raw,
        };
      }
    }

    if (!res.ok || resultCode !== 'OK') {
      this.logger.error(`Atmos merchant/pay/apply failed: ${res.status} ${JSON.stringify(raw)}`);
      throw new BadRequestException(mapAtmosApplyError(raw.result?.code, raw.result?.description));
    }

    return {
      transactionId: Number(raw.transaction_id ?? params.transactionId),
      successTransId: storeTx?.success_trans_id != null ? Number(storeTx.success_trans_id) : undefined,
      confirmed: false,
      ofdUrl: raw.ofd_url,
      statusCode: storeTx?.status_code ?? undefined,
      statusMessage: storeTx?.status_message ?? undefined,
      raw,
    };
  }

  /**
   * 4. Get Transaction Info
   * POST /merchant/pay/get
   * Retrieves current status of a transaction.
   */
  async getTransaction(transactionId: number): Promise<AtmosTransactionStatus | null> {
    const token = await this.getAccessToken();
    const storeId = this.storeId();

    const res = await fetch(`${this.baseUrl()}/merchant/pay/get`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
        Accept: 'application/json',
      },
      body: JSON.stringify({
        transaction_id: transactionId,
        store_id: storeId,
      }),
    });
    const raw = (await res.json().catch(() => ({}))) as AtmosMerchantResponse;

    if (!res.ok) {
      this.logger.warn(`Atmos merchant/pay/get failed: ${res.status} ${JSON.stringify(raw)}`);
      return null;
    }

    const storeTx = raw.store_transaction;
    return {
      transactionId: Number(raw.transaction_id ?? storeTx?.trans_id ?? transactionId),
      successTransId: storeTx?.success_trans_id != null ? Number(storeTx.success_trans_id) : undefined,
      confirmed: storeTx?.confirmed === true,
      amount: Number(storeTx?.amount ?? 0),
      account: String(storeTx?.account ?? ''),
      statusCode: storeTx?.status_code ?? undefined,
      statusMessage: storeTx?.status_message ?? undefined,
      prepayTime: storeTx?.prepay_time ?? undefined,
      confirmTime: storeTx?.confirm_time ?? undefined,
      ofdUrl: raw.ofd_url,
      raw,
    };
  }

  /**
   * 5. Cancel Transaction (Reverse)
   * POST /merchant/pay/reverse
   * Cancels a transaction and refunds the card.
   */
  async reverseTransaction(params: {
    transactionId: number;
    reason?: string;
  }): Promise<{ transactionId: number; raw: unknown }> {
    const token = await this.getAccessToken();

    const payload: Record<string, unknown> = {
      transaction_id: params.transactionId,
    };
    if (params.reason) payload.reason = params.reason;

    const res = await fetch(`${this.baseUrl()}/merchant/pay/reverse`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
        Accept: 'application/json',
      },
      body: JSON.stringify(payload),
    });
    const raw = (await res.json().catch(() => ({}))) as AtmosMerchantResponse;
    const resultCode = String(raw.result?.code ?? '').toUpperCase();

    if (!res.ok || resultCode !== 'OK') {
      this.logger.error(`Atmos merchant/pay/reverse failed: ${res.status} ${JSON.stringify(raw)}`);
      const detail = raw.result?.description || `HTTP ${res.status}`;
      throw new ServiceUnavailableException(`Unable to cancel transaction (${detail}).`);
    }

    return {
      transactionId: Number(raw.transaction_id ?? params.transactionId),
      raw,
    };
  }

  /**
   * Retry OTP
   * POST /merchant/pay/retry-otp
   * Resends the OTP SMS to the cardholder.
   */
  async retryOtp(transactionId: number): Promise<{ transactionId: number; raw: unknown }> {
    const token = await this.getAccessToken();
    const storeId = this.storeId();

    const res = await fetch(`${this.baseUrl()}/merchant/pay/retry-otp`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
        Accept: 'application/json',
      },
      body: JSON.stringify({
        transaction_id: transactionId,
        store_id: storeId,
      }),
    });
    const raw = (await res.json().catch(() => ({}))) as AtmosMerchantResponse;
    const resultCode = String(raw.result?.code ?? '').toUpperCase();

    if (!res.ok || resultCode !== 'OK') {
      this.logger.error(`Atmos merchant/pay/retry-otp failed: ${res.status} ${JSON.stringify(raw)}`);
      const detail = raw.result?.description || `HTTP ${res.status}`;
      throw new ServiceUnavailableException(`Unable to resend OTP (${detail}).`);
    }

    return {
      transactionId: Number(raw.transaction_id ?? transactionId),
      raw,
    };
  }

  /**
   * Atmos callback signature validation
   * sign = MD5(store_id + transaction_id + invoice + amount + api_key)
   */
  validateCallbackSignature(data: Record<string, unknown>): boolean {
    const apiKey = process.env.ATMOS_API_KEY?.trim();
    if (!apiKey) {
      this.logger.warn('ATMOS_API_KEY not set — verifying store_id only');
      return String(data.store_id) === String(this.storeId());
    }
    const required = ['store_id', 'transaction_id', 'invoice', 'amount', 'sign'];
    if (!required.every((k) => data[k] != null && data[k] !== '')) return false;
    const signString = `${data.store_id}${data.transaction_id}${data.invoice}${data.amount}${apiKey}`;
    const expected = createHash('md5').update(signString).digest('hex');
    return expected === String(data.sign);
  }
}
