import { useState } from 'react';
import { api } from '../../lib/api';

/** Privacy §11: Settings → Delete account, confirmed with the password (DELETE /users/me). */
const T = {
  en: { title: 'Delete account', hint: 'Permanently deletes your account, progress, words and imports. Messages you sent stay in other people’s chats as “Deleted user”. This can’t be undone.', open: 'Delete account', pw: 'Enter your password to confirm', confirm: 'Delete my account', cancel: 'Cancel' },
  ru: { title: 'Удалить аккаунт', hint: 'Аккаунт, прогресс, слова и импорты будут удалены навсегда. Отправленные вами сообщения останутся в чатах собеседников от имени «Удалённый пользователь». Отменить это нельзя.', open: 'Удалить аккаунт', pw: 'Введите пароль для подтверждения', confirm: 'Удалить мой аккаунт', cancel: 'Отмена' },
  uz: { title: 'Hisobni oʻchirish', hint: 'Hisobingiz, natijalaringiz, soʻzlaringiz va importlaringiz butunlay oʻchiriladi. Siz yuborgan xabarlar suhbatdoshlaringiz chatida «Oʻchirilgan foydalanuvchi» nomidan qoladi. Buni ortga qaytarib boʻlmaydi.', open: 'Hisobni oʻchirish', pw: 'Tasdiqlash uchun parolingizni kiriting', confirm: 'Hisobimni oʻchirish', cancel: 'Bekor qilish' },
};
export const deleteAccountText = (lang?: string | null) => T[lang === 'ru' || lang === 'uz' ? lang : 'en'];

export function DeleteAccount({ lang, onDeleted }: { lang?: string | null; onDeleted: () => void }) {
  const t = deleteAccountText(lang);
  const [open, setOpen] = useState(false);
  const [pw, setPw] = useState('');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  return (
    <div id="delete-account" className="px-4 sm:px-5 py-4 space-y-3">
      <p className="text-xs text-[#6b7382]">{t.hint}</p>
      {!open ? (
        <button type="button" className="h-9 px-4 rounded-[14px] border border-red-200 text-red-600 text-sm font-medium hover:bg-red-50" onClick={() => setOpen(true)}>{t.open}</button>
      ) : (
        <form className="flex flex-col sm:flex-row gap-2" onSubmit={async (e) => {
          e.preventDefault();
          setBusy(true); setErr(null);
          try {
            await api('/users/me', { method: 'DELETE', body: JSON.stringify({ currentPassword: pw }) });
            onDeleted();
          } catch (e2) { setErr(e2 instanceof Error ? e2.message : 'Error'); } finally { setBusy(false); }
        }}>
          <input type="password" autoComplete="current-password" required aria-label={t.pw} placeholder={t.pw} value={pw} onChange={(e) => setPw(e.target.value)}
            className="h-9 px-3 bg-[#f9fafb] border border-[#e5e7eb] rounded-[14px] text-sm flex-1 min-w-0" />
          <button type="submit" disabled={busy || !pw} className="h-9 px-4 rounded-[14px] bg-red-600 text-white text-sm font-medium disabled:opacity-50">{t.confirm}</button>
          <button type="button" className="h-9 px-3 text-sm" onClick={() => { setOpen(false); setPw(''); setErr(null); }}>{t.cancel}</button>
        </form>
      )}
      {err && <p className="text-xs text-red-600">{err}</p>}
    </div>
  );
}
