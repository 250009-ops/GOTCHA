import { useEffect, useState } from 'react';
import { api } from './api';

export type PlusOffer = {
  enabled: boolean;
  plans: { days: number; priceUzs: number }[];
  active: boolean;
  expiresAt: string | null;
};

let cache: { at: number; value: PlusOffer } | null = null;
let inflight: Promise<PlusOffer | null> | null = null;
const TTL = 5 * 60_000;

function load(): Promise<PlusOffer | null> {
  if (cache && Date.now() - cache.at < TTL) return Promise.resolve(cache.value);
  if (!inflight) {
    inflight = api<PlusOffer>('/billing/plus/offer')
      .then((value) => {
        cache = { at: Date.now(), value };
        return value;
      })
      .catch(() => null)
      .finally(() => {
        inflight = null;
      });
  }
  return inflight;
}

/** Drop the cached offer (after a Plus purchase) so the sidebar/profile show the new state. */
export function invalidatePlusOffer() {
  cache = null;
}

/** Plus offer + status for the sidebar card and the mini app profile (prices always from the API). */
export function usePlusOffer(enabled = true): PlusOffer | null {
  const [offer, setOffer] = useState<PlusOffer | null>(cache?.value ?? null);
  useEffect(() => {
    if (!enabled) return;
    let alive = true;
    void load().then((o) => {
      if (alive) setOffer(o);
    });
    return () => {
      alive = false;
    };
  }, [enabled]);
  return offer;
}

export function plusDaysLeft(expiresAt: string | null | undefined, now = Date.now()): number {
  if (!expiresAt) return 0;
  return Math.max(0, Math.ceil((new Date(expiresAt).getTime() - now) / 86_400_000));
}
