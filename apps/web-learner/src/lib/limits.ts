import { useSyncExternalStore } from 'react';
import { limitNoticeFromError, type LimitNotice } from '@gotcha/shared';
import { api } from './api';

/**
 * final-5.1: the payments flag comes ONLY from the server (GET /billing/gateway-status ->
 * paymentGatewayEnabled, i.e. the API env PAYMENT_GATEWAY_ENABLED). No build-time flag, no hardcoded value.
 * Until the server answers, paid upsells stay hidden (unknown is not "on").
 */
let serverPayments: boolean | null = null;
let loading: Promise<void> | null = null;
const listeners = new Set<() => void>();

export function setPaymentsFromServer(status: { paymentGatewayEnabled?: unknown } | null | undefined): void {
  const next = status?.paymentGatewayEnabled === true;
  if (next === serverPayments) return;
  serverPayments = next;
  listeners.forEach((l) => l());
}

export function loadPaymentsStatus(): Promise<void> {
  if (!loading) {
    loading = api<{ paymentGatewayEnabled?: boolean }>('/billing/gateway-status')
      .then(setPaymentsFromServer)
      .catch(() => { loading = null; });
  }
  return loading;
}

export function paymentsEnabled(): boolean {
  return serverPayments === true;
}

export function usePaymentsEnabled(): boolean {
  return useSyncExternalStore(
    (cb) => { listeners.add(cb); void loadPaymentsStatus(); return () => { listeners.delete(cb); }; },
    paymentsEnabled,
    () => false,
  );
}

export const LIMIT_EVENT = 'gotcha:limit-notice';

export function showLimitNotice(notice: LimitNotice): void {
  window.dispatchEvent(new CustomEvent<LimitNotice>(LIMIT_EVENT, { detail: notice }));
}

/** Shows the limit screen when `err` is a limit/payments-off 403. Returns true if handled. */
export function handleLimitError(err: unknown, lang: string = typeof document !== 'undefined' ? document.documentElement.lang : 'en'): boolean {
  const e = err as { code?: string; body?: Record<string, unknown> } | null;
  const notice = limitNoticeFromError(e, lang === 'ru' || lang === 'uz' ? lang : 'en');
  if (!notice) return false;
  showLimitNotice(notice);
  return true;
}
