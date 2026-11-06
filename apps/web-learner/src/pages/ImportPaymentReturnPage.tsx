import { invalidatePlusOffer } from '../lib/plusOffer';
import { useEffect, useRef, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { toast } from 'sonner';
import { api } from '../lib/api';
import { useLearnerCopy } from '../lib/learnerLocaleContext';
import {
  clearPendingImport,
  getImportPayment,
  loadPendingImport,
  type PendingImport,
} from '../lib/importBilling';
import { paymentKindOf, plusSuccessLine } from '../lib/payments';
import { PayExpired, PayPending, PayResult, PayButton, PayTrust, usePay, usePaymentPolling } from '../components/payments';

type ImportItem = {
  id: string;
  ingestionStatus: string;
  errorMessage?: string | null;
  content?: { id: string } | null;
};

async function runPendingImport(pending: PendingImport, reselectFileMsg: string): Promise<ImportItem> {
  if (pending.kind === 'url') {
    return api<ImportItem>('/imports/url', {
      method: 'POST',
      body: JSON.stringify({
        url: pending.url,
        language: pending.lang,
        title: pending.title || undefined,
        paymentId: pending.paymentId,
      }),
    });
  }
  if (pending.kind === 'paste') {
    return api<ImportItem>('/imports/paste', {
      method: 'POST',
      body: JSON.stringify({
        title: pending.title,
        text: pending.text,
        language: pending.lang,
        paymentId: pending.paymentId,
      }),
    });
  }
  // file
  if (pending.needsReupload || !pending.fileBase64) {
    throw new Error(reselectFileMsg);
  }
  const bin = atob(pending.fileBase64);
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  const file = new File([bytes], pending.fileName, { type: pending.fileType || 'application/pdf' });
  const form = new FormData();
  form.append('file', file);
  form.append('language', pending.lang);
  form.append('paymentId', pending.paymentId);
  if (pending.title.trim()) form.append('title', pending.title.trim());
  return api<ImportItem>('/imports/file', { method: 'POST', body: form });
}

export default function ImportPaymentReturnPage() {
  // A Plus purchase lands here: drop the cached offer so the sidebar card shows the new end date.
  invalidatePlusOffer();
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const copy = useLearnerCopy();
  const { t, errOr } = usePay();
  const paymentId = params.get('paymentId');
  const [payment, setPayment] = useState<{ status: string; contentId?: string | null; contentFormat?: string | null; needsAttention?: boolean; account?: string } | null>(null);
  const [phase, setPhase] = useState<'polling' | 'importing' | 'done'>('polling');
  const [plusUntil, setPlusUntil] = useState<string | null>(null);
  const ran = useRef(false);

  useEffect(() => {
    if (!paymentId) { toast.error(copy.importReturn.missingReference); navigate('/app/import', { replace: true }); }
  }, [paymentId, navigate, copy]);

  // 2 s for 20 s, then 10 s up to 2 min (PAYMENTS §6). Webhook or Atmos status fallback flips it to paid.
  const poll = usePaymentPolling(async () => {
    const p = await getImportPayment(paymentId!);
    setPayment(p as never);
    return p as { status: string; needsAttention?: boolean };
  }, Boolean(paymentId));

  useEffect(() => {
    if (!paymentId || !payment || payment.status !== 'paid' || ran.current) return;
    ran.current = true;
    const kind = paymentKindOf(payment);
    if (kind === 'plus') {
      // 11d: "Plus is active until {date}. No daily limit on word lookups." (pay-copy.json plus.successSub), date from the pass.
      api<{ expiresAt: string | null }>('/billing/plus/offer').then((o) => setPlusUntil(o.expiresAt)).catch(() => undefined);
      setPhase('done'); return;
    }
    if (kind === 'catalog' && payment.contentId) {
      // Book resume: the purchase unlocks the content; reopen it in the reader.
      toast.success(copy.importReturn.paymentConfirmed);
      navigate(`/app/read/${payment.contentId}`, { replace: true });
      return;
    }
    const pending = loadPendingImport();
    if (!pending || pending.paymentId !== paymentId) {
      sessionStorage.setItem('gotcha_paid_payment_id', paymentId);
      toast.success(copy.importReturn.paymentConfirmed);
      navigate('/app/import', { replace: true });
      return;
    }
    setPhase('importing');
    runPendingImport(pending, copy.importReturn.reselectFile)
      .then((item) => {
        clearPendingImport();
        if (item.ingestionStatus === 'ready' && item.content?.id) {
          toast.success(copy.importReturn.importReady);
          navigate(`/app/read/${item.content.id}`, { replace: true });
          return;
        }
        toast.success(copy.importReturn.importSubmitted);
        navigate('/app/import', { replace: true });
      })
      .catch((err) => {
        toast.error(errOr(err, copy.importReturn.couldNotFinishImport));
        navigate('/app/import', { replace: true });
      });
  }, [payment, paymentId, navigate, copy, errOr]);

  const startAgain = () => {
    const kind = payment ? paymentKindOf(payment) : 'import';
    if (kind === 'plus') navigate('/app/plus', { replace: true });
    else if (kind === 'catalog' && payment?.contentId) navigate(`/app/read/${payment.contentId}`, { replace: true });
    else navigate('/app/import', { replace: true });
  };

  const status = payment?.status ?? 'pending';
  return (
    <div className="min-h-[60vh] mx-auto w-full max-w-md flex flex-col items-center justify-center gap-4 px-4 py-8">
      {status === 'pending' && (
        <PayPending slow={poll.slow} reference={payment?.account ?? null} needsAttention={payment?.needsAttention} onCheckAgain={poll.checkAgain} />
      )}
      {status === 'paid' && phase !== 'done' && (
        <PayResult tone="ok" title={t('success.title')} body={copy.importReturn.importing} />
      )}
      {status === 'paid' && phase === 'done' && (
        <PayResult tone="ok" title={t('plus.success')} body={plusUntil ? plusSuccessLine(t('plus.successSub'), plusUntil) : t('plus.noRenew')}>
          <PayButton type="button" label={t('plus.ctaShort')} onClick={() => navigate('/app/plus', { replace: true })} />
        </PayResult>
      )}
      {status === 'expired' && <PayExpired onStartAgain={startAgain} />}
      {(status === 'failed' || status === 'refunded') && (
        <PayResult tone="bad" title={status === 'refunded' ? t('status.refunded') : t('fail.title')} body={t('fail.noCharge')}>
          {payment?.needsAttention && <p className="text-sm" style={{ color: 'var(--g-warn)' }}>{t('support.review')}</p>}
          <PayButton type="button" label={t('startAgain')} onClick={startAgain} />
        </PayResult>
      )}
      {/* 11d Plus success uses the Plus refund sentence (pay-copy.json / gen_pay.py trust(plus=True)); imports/books: generic. */}
      <PayTrust plus={payment ? paymentKindOf(payment) === 'plus' : false} />
    </div>
  );
}
