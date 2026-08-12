import { useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { api } from '../lib/api';
import {
  clearPendingImport,
  getImportPayment,
  loadPendingImport,
  type PendingImport,
} from '../lib/importBilling';

type ImportItem = {
  id: string;
  ingestionStatus: string;
  errorMessage?: string | null;
  content?: { id: string } | null;
};

async function runPendingImport(pending: PendingImport): Promise<ImportItem> {
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
    throw new Error('Payment received. Please re-select your PDF/EPUB on the Import page to finish.');
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
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const [message, setMessage] = useState('Confirming payment…');

  useEffect(() => {
    const paymentId = params.get('paymentId');
    if (!paymentId) {
      toast.error('Missing payment reference');
      navigate('/app/import', { replace: true });
      return;
    }

    let cancelled = false;
    (async () => {
      try {
        // Poll until paid (webhook or Atmos invoice status).
        let paid = false;
        for (let i = 0; i < 20 && !cancelled; i++) {
          const payment = await getImportPayment(paymentId);
          if (payment.status === 'paid') {
            paid = true;
            break;
          }
          setMessage('Waiting for Atmos confirmation…');
          await new Promise((r) => setTimeout(r, 1500));
        }
        if (!paid) {
          toast.error('Payment not confirmed yet. If you were charged, open Import and try again in a moment.');
          navigate('/app/import', { replace: true });
          return;
        }

        const pending = loadPendingImport();
        if (!pending || pending.paymentId !== paymentId) {
          // Paid but no pending payload — user can import with this paymentId from Import page.
          sessionStorage.setItem('gotcha_paid_payment_id', paymentId);
          toast.success('Payment confirmed. Finish your import.');
          navigate('/app/import', { replace: true });
          return;
        }

        setMessage('Payment confirmed — importing…');
        const item = await runPendingImport(pending);
        clearPendingImport();
        if (item.ingestionStatus === 'ready' && item.content?.id) {
          toast.success('Import ready');
          navigate(`/app/read/${item.content.id}`, { replace: true });
          return;
        }
        toast.success('Import submitted');
        navigate('/app/import', { replace: true });
      } catch (err) {
        toast.error(err instanceof Error ? err.message : 'Could not finish import after payment');
        navigate('/app/import', { replace: true });
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [params, navigate]);

  return (
    <div className="min-h-[60vh] flex flex-col items-center justify-center gap-3 text-sm text-slate-600">
      <Loader2 className="w-6 h-6 animate-spin text-[#7f22fe]" />
      <p>{message}</p>
    </div>
  );
}
