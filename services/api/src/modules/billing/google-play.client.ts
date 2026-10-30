import { Injectable, Logger, OnModuleInit, ServiceUnavailableException } from '@nestjs/common';
import { createCipheriv, createDecipheriv, createHash, createPublicKey, createSign, createVerify, randomBytes, timingSafeEqual, type JsonWebKey } from 'crypto';
import { readFileSync } from 'fs';

/**
 * Minimal Google Play Developer API client (no googleapis dependency).
 *
 * Env:
 *  - PLAY_PACKAGE_NAME                    default app.gotcha.android
 *  - PLAY_SERVICE_ACCOUNT_JSON            service-account key JSON, or a path to it (Play Console → API access)
 *  - PLAY_RTDN_AUDIENCE + PLAY_RTDN_SA_EMAIL  Pub/Sub push OIDC check (both REQUIRED for OIDC)
 *  - PLAY_RTDN_TOKEN                      deprecated ?token= secret; only honoured when OIDC is NOT configured
 *  - PLAY_TOKEN_KEY                       key for encrypting stored purchase tokens (REQUIRED; no fallback)
 */
export interface PlayProductPurchase {
  purchaseState?: number; // 0 purchased, 1 canceled, 2 pending
  consumptionState?: number; // 0 yet to be consumed, 1 consumed
  acknowledgementState?: number; // 0 no, 1 yes
  orderId?: string;
  obfuscatedExternalAccountId?: string;
  purchaseTimeMillis?: string;
  quantity?: number;
  refundableQuantity?: number;
}

export interface PlaySubscriptionPurchaseV2 {
  subscriptionState?: string; // SUBSCRIPTION_STATE_ACTIVE | _CANCELED | _IN_GRACE_PERIOD | _ON_HOLD | _PAUSED | _EXPIRED | _PENDING ...
  acknowledgementState?: string; // ACKNOWLEDGEMENT_STATE_ACKNOWLEDGED | _PENDING
  latestOrderId?: string;
  linkedPurchaseToken?: string;
  externalAccountIdentifiers?: { obfuscatedExternalAccountId?: string };
  lineItems?: Array<{ productId: string; expiryTime?: string; autoRenewingPlan?: { autoRenewEnabled?: boolean } }>;
}

const SCOPE = 'https://www.googleapis.com/auth/androidpublisher';
const API = 'https://androidpublisher.googleapis.com/androidpublisher/v3/applications';

const b64url = (b: Buffer | string) => Buffer.from(b).toString('base64').replace(/=+$/, '').replace(/\+/g, '-').replace(/\//g, '_');

@Injectable()
export class GooglePlayClient implements OnModuleInit {
  private readonly log = new Logger(GooglePlayClient.name);
  private token: { value: string; exp: number } | null = null;
  private certs: { keys: Array<JsonWebKey & { kid: string }>; exp: number } | null = null;
  /** Injectable for tests. */
  fetchImpl: typeof fetch = (...a) => fetch(...a);

  /** PB1: fail closed at boot when Play is configured in production without a valid RTDN auth setup. */
  onModuleInit() {
    if (!this.configured()) return;
    // p2b n-3: no public fallback key in ANY environment once Play is configured.
    if (!process.env.PLAY_TOKEN_KEY?.trim()) throw new Error('PLAY_TOKEN_KEY is required when PLAY_SERVICE_ACCOUNT_JSON is set');
    const problem = this.rtdnConfigProblem();
    if (!problem) return;
    if (process.env.NODE_ENV === 'production') throw new Error(`Google Play RTDN misconfigured: ${problem}`);
    this.log.warn(`Google Play RTDN misconfigured: ${problem} (all pushes will be rejected)`);
  }

  rtdnConfigProblem(): string | null {
    const aud = process.env.PLAY_RTDN_AUDIENCE?.trim();
    const email = process.env.PLAY_RTDN_SA_EMAIL?.trim();
    if (aud && !email) return 'PLAY_RTDN_SA_EMAIL is required with PLAY_RTDN_AUDIENCE';
    if (!aud && !process.env.PLAY_RTDN_TOKEN?.trim()) return 'set PLAY_RTDN_AUDIENCE + PLAY_RTDN_SA_EMAIL';
    if (!process.env.PLAY_TOKEN_KEY?.trim()) return 'PLAY_TOKEN_KEY is required';
    return null;
  }

  packageName(): string {
    return process.env.PLAY_PACKAGE_NAME?.trim() || 'app.gotcha.android';
  }

  configured(): boolean {
    return !!this.serviceAccount();
  }

  private serviceAccount(): { client_email: string; private_key: string } | null {
    const raw = process.env.PLAY_SERVICE_ACCOUNT_JSON?.trim();
    if (!raw) return null;
    try {
      const json = raw.startsWith('{') ? raw : readFileSync(raw, 'utf8');
      const sa = JSON.parse(json);
      return sa.client_email && sa.private_key ? sa : null;
    } catch {
      return null;
    }
  }

  private async accessToken(): Promise<string> {
    if (this.token && this.token.exp > Date.now() + 60_000) return this.token.value;
    const sa = this.serviceAccount();
    if (!sa) throw new ServiceUnavailableException('Google Play billing is not configured');
    const now = Math.floor(Date.now() / 1000);
    const header = b64url(JSON.stringify({ alg: 'RS256', typ: 'JWT' }));
    const claims = b64url(JSON.stringify({ iss: sa.client_email, scope: SCOPE, aud: 'https://oauth2.googleapis.com/token', iat: now, exp: now + 3600 }));
    const sig = b64url(createSign('RSA-SHA256').update(`${header}.${claims}`).sign(sa.private_key));
    const res = await this.fetchImpl('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: { 'content-type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({ grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer', assertion: `${header}.${claims}.${sig}` }),
    });
    if (!res.ok) throw new ServiceUnavailableException('Google Play auth failed');
    const j = (await res.json()) as { access_token: string; expires_in: number };
    this.token = { value: j.access_token, exp: Date.now() + j.expires_in * 1000 };
    return j.access_token;
  }

  private async call<T>(path: string, method: 'GET' | 'POST' = 'GET', body?: unknown): Promise<T | null> {
    const res = await this.fetchImpl(`${API}/${encodeURIComponent(this.packageName())}${path}`, {
      method,
      headers: { authorization: `Bearer ${await this.accessToken()}`, ...(body ? { 'content-type': 'application/json' } : {}) },
      body: body ? JSON.stringify(body) : undefined,
    });
    if (res.status === 404 || res.status === 410 || res.status === 400) return null; // unknown/expired token
    if (!res.ok) {
      this.log.warn(`Play API ${method} ${path.split('/tokens/')[0]} → ${res.status}`);
      throw new ServiceUnavailableException('Google Play is unavailable, try again');
    }
    const text = await res.text();
    return (text ? JSON.parse(text) : {}) as T;
  }

  getProduct(sku: string, token: string) {
    return this.call<PlayProductPurchase>(`/purchases/products/${encodeURIComponent(sku)}/tokens/${encodeURIComponent(token)}`);
  }

  acknowledgeProduct(sku: string, token: string) {
    return this.call<unknown>(`/purchases/products/${encodeURIComponent(sku)}/tokens/${encodeURIComponent(token)}:acknowledge`, 'POST', {});
  }

  /** Server-side consume for consumables (import tiers) once the credit is granted. */
  consumeProduct(sku: string, token: string) {
    return this.call<unknown>(`/purchases/products/${encodeURIComponent(sku)}/tokens/${encodeURIComponent(token)}:consume`, 'POST');
  }

  getSubscription(token: string) {
    return this.call<PlaySubscriptionPurchaseV2>(`/purchases/subscriptionsv2/tokens/${encodeURIComponent(token)}`);
  }

  acknowledgeSubscription(sku: string, token: string) {
    return this.call<unknown>(`/purchases/subscriptions/${encodeURIComponent(sku)}/tokens/${encodeURIComponent(token)}:acknowledge`, 'POST', {});
  }

  /**
   * Authenticates a Pub/Sub push (RTDN), failing closed (PB1).
   * OIDC mode (PLAY_RTDN_AUDIENCE set): Google-signed RS256 token, iss accounts.google.com, exact aud,
   * email === PLAY_RTDN_SA_EMAIL (required) and email_verified === true. The query token is ignored.
   * Legacy mode (no audience): constant-time ?token= match, with a deprecation warning.
   */
  async verifyPush(authorization: string | undefined, queryToken: string | undefined): Promise<boolean> {
    const aud = process.env.PLAY_RTDN_AUDIENCE?.trim();
    const email = process.env.PLAY_RTDN_SA_EMAIL?.trim();
    if (!aud) {
      const shared = process.env.PLAY_RTDN_TOKEN?.trim();
      if (!shared || !queryToken) return false;
      if (!this.warnedToken) {
        this.warnedToken = true;
        this.log.warn('RTDN ?token= auth is deprecated (it appears in access logs); configure OIDC push auth.');
      }
      return timingSafeEq(shared, queryToken);
    }
    if (!email) return false;
    const m = /^Bearer\s+(.+)$/i.exec(authorization ?? '');
    if (!m) return false;
    const [h, p, s] = m[1].split('.');
    if (!h || !p || !s) return false;
    try {
      const header = JSON.parse(Buffer.from(h, 'base64url').toString());
      const claims = JSON.parse(Buffer.from(p, 'base64url').toString());
      if (header.alg !== 'RS256') return false;
      const jwk = (await this.googleCerts()).find((k) => k.kid === header.kid);
      if (!jwk) return false;
      const ok = createVerify('RSA-SHA256').update(`${h}.${p}`).verify(createPublicKey({ key: jwk, format: 'jwk' }), Buffer.from(s, 'base64url'));
      if (!ok) return false;
      const now = Date.now() / 1000;
      if (!['accounts.google.com', 'https://accounts.google.com'].includes(claims.iss)) return false;
      if (claims.aud !== aud || !(claims.exp > now)) return false;
      return claims.email_verified === true && claims.email === email;
    } catch {
      return false;
    }
  }

  private warnedToken = false;

  /** Voided purchases (refunds, chargebacks, revocations) since `sinceMs`, incl. subscriptions (type=1). */
  async voidedPurchases(sinceMs: number, maxPages = 10): Promise<Array<{ purchaseToken: string; orderId?: string; voidedTimeMillis?: string }>> {
    const out: Array<{ purchaseToken: string; orderId?: string; voidedTimeMillis?: string }> = [];
    let page: string | undefined;
    for (let i = 0; i < maxPages; i++) {
      const q = new URLSearchParams({ startTime: String(sinceMs), type: '1', maxResults: '1000', ...(page ? { token: page } : {}) });
      const r = await this.call<{ voidedPurchases?: typeof out; tokenPagination?: { nextPageToken?: string } }>(`/purchases/voidedpurchases?${q}`);
      if (!r) throw new ServiceUnavailableException('Google Play voided purchases unavailable');
      out.push(...(r.voidedPurchases ?? []));
      page = r.tokenPagination?.nextPageToken;
      if (!page) break;
    }
    return out;
  }

  private async googleCerts() {
    if (this.certs && this.certs.exp > Date.now()) return this.certs.keys;
    const res = await this.fetchImpl('https://www.googleapis.com/oauth2/v3/certs');
    const j = (await res.json()) as { keys: Array<JsonWebKey & { kid: string }> };
    this.certs = { keys: j.keys, exp: Date.now() + 3600_000 };
    return j.keys;
  }
}

function timingSafeEq(a: string, b: string): boolean {
  const x = Buffer.from(a);
  const y = Buffer.from(b);
  return x.length === y.length && timingSafeEqual(x, y);
}

// ---- m-p2-1: purchase tokens at rest (AES-256-GCM). Hash stays the lookup key. ----
function tokenKey(): Buffer {
  const k = process.env.PLAY_TOKEN_KEY?.trim();
  // No built-in fallback (REVIEW-p2b n-3): tests set their own key; everything else must configure it.
  if (!k) throw new ServiceUnavailableException('PLAY_TOKEN_KEY is not configured');
  return createHash('sha256').update(k).digest();
}

export function sealToken(token: string): string {
  const iv = randomBytes(12);
  const c = createCipheriv('aes-256-gcm', tokenKey(), iv);
  const body = Buffer.concat([c.update(token, 'utf8'), c.final()]);
  return `enc:v1:${Buffer.concat([iv, c.getAuthTag(), body]).toString('base64url')}`;
}

export function openToken(stored: string): string {
  if (!stored.startsWith('enc:v1:')) return stored; // legacy plaintext rows
  const raw = Buffer.from(stored.slice(7), 'base64url');
  const d = createDecipheriv('aes-256-gcm', tokenKey(), raw.subarray(0, 12));
  d.setAuthTag(raw.subarray(12, 28));
  return Buffer.concat([d.update(raw.subarray(28)), d.final()]).toString('utf8');
}
