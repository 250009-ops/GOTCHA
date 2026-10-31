import { useState } from 'react';
import { api } from '../../lib/api';

type L = 'uz' | 'ru' | 'en';
const T: Record<L, Record<string, string>> = {
  en: {
    report: 'Report', block: 'Block', reportTitle: 'Report this', reason: 'Reason', details: 'Details (optional)',
    send: 'Send report', cancel: 'Cancel', sent: 'Thanks — our team will review it.', alsoBlock: 'Also block this learner',
    spam: 'Spam', harassment: 'Harassment or bullying', inappropriate: 'Inappropriate content', underage: 'Under-age user', other: 'Other',
    friendsOnly: 'You can message this learner once you are friends.', addFriend: 'Send friend request', requested: 'Friend request sent',
    messagingOff: 'Messaging is not available for this account.', blocked: 'Blocked', confirmBlock: 'Block this learner? They will not be able to message you.',
  },
  ru: {
    report: 'Пожаловаться', block: 'Заблокировать', reportTitle: 'Жалоба', reason: 'Причина', details: 'Подробности (необязательно)',
    send: 'Отправить', cancel: 'Отмена', sent: 'Спасибо — команда проверит жалобу.', alsoBlock: 'Также заблокировать',
    spam: 'Спам', harassment: 'Оскорбления или травля', inappropriate: 'Неприемлемый контент', underage: 'Пользователь младше допустимого возраста', other: 'Другое',
    friendsOnly: 'Писать этому пользователю можно, когда вы станете друзьями.', addFriend: 'Добавить в друзья', requested: 'Заявка отправлена',
    messagingOff: 'Сообщения недоступны для этого аккаунта.', blocked: 'Заблокирован', confirmBlock: 'Заблокировать? Он не сможет вам писать.',
  },
  uz: {
    report: 'Shikoyat', block: 'Bloklash', reportTitle: 'Shikoyat qilish', reason: 'Sabab', details: 'Batafsil (ixtiyoriy)',
    send: 'Yuborish', cancel: 'Bekor qilish', sent: 'Rahmat — jamoamiz ko‘rib chiqadi.', alsoBlock: 'Shuningdek bloklash',
    spam: 'Spam', harassment: 'Haqorat yoki tazyiq', inappropriate: 'Nomaqbul kontent', underage: 'Yoshi yetmagan foydalanuvchi', other: 'Boshqa',
    friendsOnly: 'Do‘st bo‘lganingizdan keyin xabar yoza olasiz.', addFriend: 'Do‘stlikka so‘rov yuborish', requested: 'So‘rov yuborildi',
    messagingOff: 'Bu hisob uchun xabarlar mavjud emas.', blocked: 'Bloklandi', confirmBlock: 'Bloklaysizmi? U sizga yoza olmaydi.',
  },
};
const REASONS = ['spam', 'harassment', 'inappropriate', 'underage', 'other'] as const;
export const safetyText = (lang?: string | null) => T[(lang === 'ru' || lang === 'uz' ? lang : 'en') as L];

/** Report dialog for a user (messaging) or a book/import (reader). */
export function ReportButton(props: {
  lang?: string | null;
  target: { kind: 'user'; userId: string; conversationId?: string } | { kind: 'content'; contentId: string };
  className?: string;
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
  return (
    <>
      <button type="button" className={props.className ?? 'text-xs text-[#6b7382] hover:text-red-600 px-2 py-1 rounded-lg'} onClick={() => { setOpen(true); setState('idle'); }}>
        {t.report}
      </button>
      {open && (
        <div className="fixed inset-0 z-50 bg-black/40 grid place-items-center p-4" role="dialog" aria-modal="true" aria-label={t.reportTitle}>
          <div className="bg-white rounded-2xl w-full max-w-sm p-5 space-y-3">
            <h2 className="font-bold text-base">{t.reportTitle}</h2>
            {state === 'done' ? (
              <p className="text-sm">{t.sent}</p>
            ) : (
              <>
                <label className="block text-sm">{t.reason}
                  <select className="mt-1 w-full border rounded-lg p-2" value={reason} onChange={(e) => setReason(e.target.value as typeof reason)}>
                    {REASONS.map((r) => <option key={r} value={r}>{t[r]}</option>)}
                  </select>
                </label>
                <label className="block text-sm">{t.details}
                  <textarea className="mt-1 w-full border rounded-lg p-2" maxLength={1000} rows={3} value={details} onChange={(e) => setDetails(e.target.value)} />
                </label>
                {props.target.kind === 'user' && (
                  <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={alsoBlock} onChange={(e) => setAlsoBlock(e.target.checked)} />{t.alsoBlock}</label>
                )}
                {state !== 'idle' && state !== 'busy' && <p className="text-xs text-red-600">{state}</p>}
              </>
            )}
            <div className="flex justify-end gap-2">
              <button type="button" className="px-3 py-2 text-sm rounded-lg" onClick={() => setOpen(false)}>{t.cancel}</button>
              {state !== 'done' && (
                <button type="button" disabled={state === 'busy' || (reason === 'other' && !details.trim())} className="px-3 py-2 text-sm rounded-lg bg-red-600 text-white disabled:opacity-50" onClick={submit}>{t.send}</button>
              )}
            </div>
          </div>
        </div>
      )}
    </>
  );
}

export function BlockButton({ lang, userId, onBlocked }: { lang?: string | null; userId: string; onBlocked?: () => void }) {
  const t = safetyText(lang);
  return (
    <button type="button" className="text-xs text-[#6b7382] hover:text-red-600 px-2 py-1 rounded-lg" onClick={async () => {
      if (!window.confirm(t.confirmBlock)) return;
      await api(`/messaging/blocks/${userId}`, { method: 'POST' }).catch(() => undefined);
      onBlocked?.();
    }}>{t.block}</button>
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
