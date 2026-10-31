/**
 * Stable billing error codes (PAYMENTS.md §5). Every HttpException leaving BillingController gets a
 * `code` the web maps to localized `pay.err.*` copy. Explicit codes already set by a thrower win.
 */
import { ArgumentsHost, Catch, ExceptionFilter, HttpException } from '@nestjs/common';

export const BILLING_ERROR_CODES = [
  'card_failed', 'card_invalid', 'card_expired', 'insufficient_funds', 'card_format',
  'otp_wrong', 'otp_expired', 'otp_attempts', 'otp_format', 'session_expired',
  'provider_error', 'amount_not_allowed', 'gateway_unavailable', 'not_priced',
  'payment_not_pending', 'payment_completed', 'payment_cancelled', 'payment_not_found',
] as const;
export type BillingErrorCode = (typeof BILLING_ERROR_CODES)[number];

const RULES: Array<[RegExp, BillingErrorCode]> = [
  [/card number must|invalid expiry|expiry must/i, 'card_format'],
  [/otp must be/i, 'otp_format'],
  [/invalid card number or expiry/i, 'card_invalid'],
  [/card has expired/i, 'card_expired'],
  [/insufficient funds/i, 'insufficient_funds'],
  [/card (token )?verification failed/i, 'card_failed'],
  [/incorrect sms code|invalid or expired sms code|check the sms code/i, 'otp_wrong'],
  [/sms code expired/i, 'otp_expired'],
  [/too many incorrect attempts/i, 'otp_attempts'],
  [/session has expired|payment is expired/i, 'session_expired'],
  [/billing system error|unable to resend otp|unable to cancel transaction/i, 'provider_error'],
  [/below the minimum|amount is not allowed|could not be processed for this (import|book)/i, 'amount_not_allowed'],
  [/terminal is not configured|not configured|gateway is not available|unable to authenticate with atmos|unable to start payment/i, 'gateway_unavailable'],
  [/not priced yet/i, 'not_priced'],
  [/already completed/i, 'payment_completed'],
  [/was cancelled/i, 'payment_cancelled'],
  [/payment not found/i, 'payment_not_found'],
  [/status changed|payment is (failed|refunded)/i, 'payment_not_pending'],
];

export function classifyBillingError(message: string | string[] | undefined | null): BillingErrorCode | null {
  const text = Array.isArray(message) ? message.join(' ') : String(message ?? '');
  for (const [re, code] of RULES) if (re.test(text)) return code;
  return null;
}

@Catch(HttpException)
export class BillingErrorFilter implements ExceptionFilter {
  catch(exception: HttpException, host: ArgumentsHost) {
    const res = host.switchToHttp().getResponse<{ status: (n: number) => { json: (b: unknown) => void } }>();
    const status = exception.getStatus();
    const raw = exception.getResponse();
    const body: Record<string, unknown> =
      typeof raw === 'string' ? { statusCode: status, message: raw } : { statusCode: status, ...(raw as object) };
    if (!body.code) {
      const code = classifyBillingError(body.message as string | string[] | undefined);
      if (code) body.code = code;
    }
    res.status(status).json(body);
  }
}
