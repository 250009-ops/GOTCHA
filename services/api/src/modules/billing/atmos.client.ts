import { createHash, randomUUID } from 'crypto';
import { Injectable, Logger, ServiceUnavailableException } from '@nestjs/common';

type TokenCache = { accessToken: string; expiresAt: number };

export type AtmosInvoiceCreateResult = {
  paymentId: string | number;
  token: string;
  url: string;
  raw: unknown;
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
      throw new ServiceUnavailableException('Unable to authenticate with Atmos');
    }
    const expiresIn = Number(body.expires_in ?? 3600);
    this.tokenCache = {
      accessToken: body.access_token,
      expiresAt: now + expiresIn * 1000,
    };
    return body.access_token;
  }

  async createInvoice(params: {
    account: string;
    amountTiyins: number;
    successUrl: string;
    itemName: string;
    itemId?: string;
  }): Promise<AtmosInvoiceCreateResult> {
    if (!this.configured()) {
      throw new ServiceUnavailableException('Atmos is not configured');
    }
    const token = await this.getAccessToken();
    const storeId = this.storeId();
    const ikpu = this.ikpu();
    const tin = this.merchantTin();

    const details: Array<{ name: string; values: string }> = [
      { name: 'quantity', values: '1' },
    ];
    if (tin) details.push({ name: 'tin', values: tin });

    const payload = {
      request_id: randomUUID(),
      store_id: storeId,
      account: params.account,
      amount: params.amountTiyins,
      success_url: params.successUrl,
      expiration_time: 60,
      items: [
        {
          items_id: params.itemId || 'gotcha-import',
          code: ikpu,
          name: params.itemName,
          amount: params.amountTiyins,
          quantity: 1,
          details,
        },
      ],
    };

    const res = await fetch(`${this.baseUrl()}/checkout/invoice/create`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
        Accept: 'application/json',
      },
      body: JSON.stringify(payload),
    });
    const raw = await res.json().catch(() => ({}));
    if (!res.ok) {
      this.logger.error(`Atmos invoice create failed: ${res.status} ${JSON.stringify(raw)}`);
      throw new ServiceUnavailableException('Unable to create Atmos payment invoice');
    }

    const data = raw as {
      payment_id?: string | number;
      token?: string;
      url?: string;
      status?: { code?: string; description?: string };
    };
    if (!data.url || data.payment_id == null || !data.token) {
      this.logger.error(`Atmos invoice create unexpected body: ${JSON.stringify(raw)}`);
      throw new ServiceUnavailableException('Atmos invoice response incomplete');
    }

    return {
      paymentId: data.payment_id,
      token: data.token,
      url: data.url,
      raw,
    };
  }

  async getInvoiceStatus(paymentId: string | number) {
    const token = await this.getAccessToken();
    const res = await fetch(`${this.baseUrl()}/checkout/invoice/get`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
        Accept: 'application/json',
      },
      body: JSON.stringify({ payment_id: paymentId }),
    });
    const raw = await res.json().catch(() => ({}));
    if (!res.ok) {
      this.logger.warn(`Atmos invoice get failed: ${res.status} ${JSON.stringify(raw)}`);
      return null;
    }
    return raw;
  }

  /**
   * Atmos callback sign = MD5(store_id + transaction_id + invoice + amount + api_key)
   */
  validateCallbackSignature(data: Record<string, unknown>): boolean {
    const apiKey = process.env.ATMOS_API_KEY?.trim();
    if (!apiKey) {
      // Sandbox often ships without a separate callback key; fall back to store_id match only.
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
