import { createHash } from 'crypto';
import { Injectable, Logger, ServiceUnavailableException } from '@nestjs/common';

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
    status_code?: string | null;
    status_message?: string | null;
    prepay_time?: number | null;
    confirm_time?: number | null;
  };
  ofd_url?: string;
  phone?: string;
};

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
    const terminalId = process.env.ATMOS_TERMINAL_ID?.trim();

    const payload: Record<string, unknown> = {
      amount: params.amountTiyins,
      account: params.account,
      store_id: storeId,
      lang: process.env.ATMOS_LANG?.trim() || 'ru',
    };
    if (terminalId) payload.terminal_id = terminalId;

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
      this.logger.error(`Atmos merchant/pay/create failed: ${res.status} ${JSON.stringify(raw)}`);
      const detail = raw.result?.description || `HTTP ${res.status}`;
      throw new ServiceUnavailableException(`Unable to create Atmos transaction (${detail}).`);
    }

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
      card_number: params.cardNumber.replace(/\s+/g, ''),
      expiry: params.expiry.replace(/\//g, ''),
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
      this.logger.error(`Atmos merchant/pay/pre-apply failed: ${res.status} ${JSON.stringify(raw)}`);
      const detail = raw.result?.description || `HTTP ${res.status}`;
      throw new ServiceUnavailableException(`Card verification failed (${detail}).`);
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

    const payload = {
      transaction_id: params.transactionId,
      otp: params.otp.replace(/\s+/g, ''),
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

    if (!res.ok || resultCode !== 'OK') {
      this.logger.error(`Atmos merchant/pay/apply failed: ${res.status} ${JSON.stringify(raw)}`);
      const detail = raw.result?.description || `HTTP ${res.status}`;
      throw new ServiceUnavailableException(`Payment confirmation failed (${detail}).`);
    }

    const storeTx = raw.store_transaction;
    return {
      transactionId: Number(raw.transaction_id ?? params.transactionId),
      successTransId: storeTx?.success_trans_id != null ? Number(storeTx.success_trans_id) : undefined,
      confirmed: storeTx?.confirmed === true,
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
