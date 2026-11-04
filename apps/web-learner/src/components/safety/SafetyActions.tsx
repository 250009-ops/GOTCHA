import { useState, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { AlertTriangle, Ban, Flag } from 'lucide-react';
import { api } from '../../lib/api';

type L = 'uz' | 'ru' | 'en';
const T: Record<L, Record<string, string>> = {
  en: {
    report: 'Report', block: 'Block', reportTitle: 'Report this', reason: 'Reason', details: 'Details (optional)',
    send: 'Send report', cancel: 'Cancel', sent: 'Thanks — our team will review it.', alsoBlock: 'Also block this learner',
    spam: 'Spam', harassment: 'Harassment or bullying', inappropriate: 'Inappropriate content', underage: 'Under-age user', other: 'Other',
    friendsOnly: 'You can message this learner once you are friends.', addFriend: 'Send friend request', requested: 'Friend request sent',
    messagingOff: 'Messaging is not available for this account.', blocked: 'Blocked', confirmBlock: 'Block this learner? They will not be able to message you.',
    close: 'Close', blockFailed: 'Couldn’t block. Please try again.', blockTitle: 'Block {name}?', reportAbout: 'About {name}. Our team will review it; they won’t see who reported them.',
  },
  ru: {
    report: 'Пожаловаться', block: 'Заблокировать', reportTitle: 'Жалоба', reason: 'Причина', details: 'Подробности (необязательно)',
    send: 'Отправить', cancel: 'Отмена', sent: 'Спасибо — команда проверит жалобу.', alsoBlock: 'Также заблокировать',
    spam: 'Спам', harassment: 'Оскорбления или травля', inappropriate: 'Неприемлемый контент', underage: 'Пользователь младше допустимого возраста', other: 'Другое',
    friendsOnly: 'Писать этому пользователю можно, когда вы станете друзьями.', addFriend: 'Добавить в друзья', requested: 'Заявка отправлена',
    messagingOff: 'Сообщения недоступны для этого аккаунта.', blocked: 'Заблокирован', confirmBlock: 'Заблокировать? Он не сможет вам писать.',
    close: 'Закрыть', blockFailed: 'Не удалось заблокировать. Попробуйте ещё раз.', blockTitle: 'Заблокировать: {name}?', reportAbout: 'О пользователе {name}. Команда проверит жалобу; он не узнает, кто пожаловался.',
  },
  uz: {
    report: 'Shikoyat', block: 'Bloklash', reportTitle: 'Shikoyat qilish', reason: 'Sabab', details: 'Batafsil (ixtiyoriy)',
    send: 'Yuborish', cancel: 'Bekor qilish', sent: 'Rahmat — jamoamiz koʻrib chiqadi.', alsoBlock: 'Shuningdek bloklash',
    spam: 'Spam', harassment: 'Haqorat yoki tazyiq', inappropriate: 'Nomaqbul kontent', underage: 'Yoshi yetmagan foydalanuvchi', other: 'Boshqa',
    friendsOnly: 'Doʻst boʻlganingizdan keyin xabar yoza olasiz.', addFriend: 'Doʻstlikka so‘rov yuborish', requested: 'Soʻrov yuborildi',
    messagingOff: 'Bu hisob uchun xabarlar mavjud emas.', blocked: 'Bloklandi', confirmBlock: 'Bloklaysizmi? U sizga yoza olmaydi.',
    close: 'Yopish', blockFailed: 'Bloklab boʻlmadi. Qayta urinib koʻring.', blockTitle: '{name} bloklansinmi?', reportAbout: '{name} haqida. Jamoamiz koʻrib chiqadi; u kim shikoyat qilganini koʻrmaydi.',
  },
};
const REASONS = ['spam', 'harassment', 'inappropriate', 'underage', 'other'] as const;
const fill = (s: string, name?: string) => s.replace('{name}', name ?? '');

/** In-app modal (portal, so it survives a parent menu being hidden). */
function SafetyModal({ label, icon, children, onClose }: { label: string; icon: ReactNode; children: ReactNode; onClose: () => void }) {
  if (typeof document === 'undefined') return null;
  return createPortal(
    <div className="fixed inset-0 z-[90] bg-[rgba(11,12,38,0.5)] backdrop-blur-[3px] grid place-items-center p-4" role="dialog" aria-modal="true" aria-label={label}
      onKeyDown={(e) => { if (e.key === 'Escape') onClose(); }}>
      <div className="bg-white text-[#101828] rounded-[20px] w-full max-w-[460px] p-6 shadow-[0_30px_80px_rgba(11,12,38,0.35)]">
        <div className="size-11 rounded-[12px] bg-red-50 text-red-600 grid place-items-center mb-4">{icon}</div>
        {children}
      </div>
    </div>,
    document.body,
  );
}
export const safetyText = (lang?: string | null) => T[(lang === 'ru' || lang === 'uz' ? lang : 'en') as L];

/** Report dialog for a user (messaging) or a book/import (reader). */
export function ReportButton(props: {
  lang?: string | null;
  target: { kind: 'user'; userId: string; conversationId?: string } | { kind: 'content'; contentId: string };
  className?: string;
  /** Shown in the dialog intro ("About {name}…") for user reports. */
  name?: string;
  icon?: ReactNode;
}) {
  const t = safetyText(props.lang);
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState<(typeof REASONS)[number]>('inappropriate');
  const [details, setDetails] = useState('');
  const [alsoBlock, setAlsoBlock] = useState(false);
  const [state, setState] = useState<'idle' | 'busy' | 'done' | string>('idle');
  const submit = async () => {
    setState('busy');
    try {
      if (props.target.kind === 'user') {
        await api('/messaging/reports', {
          method: 'POST',
          body: JSON.stringify({ reportedUserId: props.target.userId, conversationId: props.target.conversationId, reason, details: details || undefined, alsoBlock }),
        });
      } else {
        await api('/reports/content', { method: 'POST', body: JSON.stringify({ contentId: props.target.contentId, reason, details: details || undefined }) });
      }
      setState('done');
    } catch (e) {
      setState(e instanceof Error ? e.message : 'error');
    }
  };
  const close = () => setOpen(false);
  return (
    <>
      <button type="button" className={props.className ?? 'text-xs text-[#6b7382] hover:text-red-600 px-2 py-1 rounded-lg'} onClick={() => { setOpen(true); setState('idle'); }}>
        {props.icon}{t.report}
      </button>
      {open && (
        <SafetyModal label={t.reportTitle} icon={<Flag className="w-5 h-5" />} onClose={close}>
          <h2 className="font-bold text-lg">{t.reportTitle}</h2>
          {state === 'done' ? (
            <p className="text-sm text-[#4a5565] mt-2 leading-relaxed">{t.sent}</p>
          ) : (
            <>
              {props.target.kind === 'user' && props.name && <p className="text-sm text-[#4a5565] mt-1.5 leading-relaxed">{fill(t.reportAbout, props.name)}</p>}
              <div className="mt-4 text-[13px] font-semibold text-[#4a5565] mb-2">{t.reason}</div>
              <div role="radiogroup" aria-label={t.reason} className="flex flex-wrap gap-2">
                {REASONS.map((r) => (
                  <button key={r} type="button" role="radio" aria-checked={reason === r} onClick={() => setReason(r)}
                    className={`min-h-9 px-3 rounded-[10px] border text-[13px] font-semibold ${reason === r ? 'border-red-500 bg-red-50 text-red-700' : 'border-[#e3e5ee] text-[#4a5565] hover:bg-gray-50'}`}>
                    {t[r]}
                  </button>
                ))}
              </div>
              <label className="block mt-4 text-[13px] font-semibold text-[#4a5565]">{t.details}
                <textarea className="mt-2 w-full rounded-[12px] border border-[#e3e5ee] bg-[#f9faff] p-3 text-sm text-[#101828] font-normal outline-none focus:border-g-blue-600 focus:ring-4 focus:ring-g-blue-50" maxLength={1000} rows={3} value={details} onChange={(e) => setDetails(e.target.value)} />
              </label>
              {props.target.kind === 'user' && (
                <label className="flex items-center gap-2.5 mt-3 text-sm cursor-pointer"><input type="checkbox" className="h-[18px] w-[18px] accent-[#2107aa]" checked={alsoBlock} onChange={(e) => setAlsoBlock(e.target.checked)} />{t.alsoBlock}</label>
              )}
              {state !== 'idle' && state !== 'busy' && <p className="text-xs text-red-600 mt-2">{state}</p>}
            </>
          )}
          <div className={`grid gap-2 mt-5 ${state === 'done' ? '' : 'min-[420px]:grid-cols-2'}`}>
            <button type="button" className="min-h-[46px] px-3 text-sm font-semibold rounded-xl border border-[#e1e3ec] bg-white text-[#101828] hover:bg-gray-50" onClick={close}>{state === 'done' ? t.close : t.cancel}</button>
            {state !== 'done' && (
              <button type="button" disabled={state === 'busy' || (reason === 'other' && !details.trim())} className="min-h-[46px] px-3 text-sm font-bold rounded-xl bg-red-600 text-white disabled:opacity-50" onClick={submit}>{t.send}</button>
            )}
          </div>
        </SafetyModal>
      )}
    </>
  );
}
export function BlockButton({ lang, userId, onBlocked, className, name, icon }: { lang?: string | null; userId: string; onBlocked?: () => void; className?: string; name?: string; icon?: ReactNode }) {
  const t = safetyText(lang);
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  return (
    <>
      <button type="button" className={className ?? 'text-xs text-[#6b7382] hover:text-red-600 px-2 py-1 rounded-lg'} onClick={() => { setErr(null); setOpen(true); }}>{icon}{t.block}</button>
      {open && (
        <SafetyModal label={t.block} icon={<Ban className="w-5 h-5" />} onClose={() => setOpen(false)}>
          <h2 className="font-bold text-lg">{name ? fill(t.blockTitle, name) : t.block}</h2>
          <p className="text-sm text-[#4a5565] mt-1.5 leading-relaxed">{t.confirmBlock}</p>
          {err && <p className="mt-3 text-sm text-red-600 flex items-center gap-1.5" role="alert"><AlertTriangle className="w-4 h-4 shrink-0" />{err}</p>}
          <div className="grid min-[420px]:grid-cols-2 gap-2 mt-5">
            <button type="button" autoFocus className="min-h-[46px] px-3 text-sm font-semibold rounded-xl border border-[#e1e3ec] bg-white text-[#101828] hover:bg-gray-50" onClick={() => setOpen(false)}>{t.cancel}</button>
            <button type="button" disabled={busy} className="min-h-[46px] px-3 text-sm font-bold rounded-xl bg-red-600 text-white disabled:opacity-50" onClick={async () => {
              setBusy(true); setErr(null);
              try {
                await api(`/messaging/blocks/${userId}`, { method: 'POST' });
                setOpen(false);
                onBlocked?.();
              } catch {
                setErr(t.blockFailed);
              } finally { setBusy(false); }
            }}>{t.block}</button>
          </div>
        </SafetyModal>
      )}
    </>
  );
}
/** Shown when the API answers MESSAGING_NOT_ALLOWED (13-17: friends only; under-13: off). */
export function FriendGateNotice({ lang, peerId, under13 }: { lang?: string | null; peerId: string; under13?: boolean }) {
  const t = safetyText(lang);
  const [sent, setSent] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  if (under13) return <p className="text-xs text-[#6b7382]">{t.messagingOff}</p>;
  return (
    <div className="text-xs text-[#0f1729] space-y-2">
      <p>{t.friendsOnly}</p>
      <button type="button" disabled={sent} className="px-3 py-1.5 rounded-lg bg-g-blue-600 text-white disabled:opacity-60" onClick={async () => {
        try { await api('/friends/requests', { method: 'POST', body: JSON.stringify({ userId: peerId }) }); setSent(true); }
        catch (e) { setErr(e instanceof Error ? e.message : 'error'); }
      }}>{sent ? t.requested : t.addFriend}</button>
      {err && <p className="text-red-600">{err}</p>}
    </div>
  );
}
