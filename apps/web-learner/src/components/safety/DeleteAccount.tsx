import { useState } from 'react';
import { Trash2 } from 'lucide-react';
import { api } from '../../lib/api';

/** Privacy §11: Settings → Delete account, confirmed with the password (DELETE /users/me).
 * WLF-08: the Settings card stays white in both themes (W-10), so the input text, placeholder and Cancel use fixed
 * dark-on-white colours instead of inheriting the dark theme's light text colour. */
const T = {
  en: { title: 'Delete account', hint: 'Permanently deletes your account, progress, words and imports. Messages you sent to other users are not deleted: they stay in their conversations, shown as from “Deleted user”, and your name, email and photo are removed. Safety reports, with any message attached to them, are kept for safety and deleted about 1 year after the report is closed. Payment records are kept as the law requires. Unused Plus days are lost. This can’t be undone.', wrongPw: 'Wrong password. Try again.', open: 'Delete account', pw: 'Enter your password to confirm', confirm: 'Delete my account', cancel: 'Cancel' },
  ru: { title: 'Удалить аккаунт', hint: 'Аккаунт, прогресс, слова и импорты будут удалены навсегда. Сообщения, которые вы отправили другим пользователям, не удаляются: они остаются в их переписке от имени «Удалённый пользователь», а ваши имя, email и фото удаляются. Жалобы вместе с приложенными к ним сообщениями хранятся в целях безопасности и удаляются примерно через 1 год после закрытия жалобы. Платёжные записи хранятся, как того требует закон. Неиспользованные дни Plus сгорают. Отменить это нельзя.', wrongPw: 'Неверный пароль. Попробуйте ещё раз.', open: 'Удалить аккаунт', pw: 'Введите пароль для подтверждения', confirm: 'Удалить мой аккаунт', cancel: 'Отмена' },
  uz: { title: 'Hisobni oʻchirish', hint: 'Hisobingiz, natijalaringiz, soʻzlaringiz va importlaringiz butunlay oʻchiriladi. Boshqa foydalanuvchilarga yuborgan xabarlaringiz oʻchirilmaydi: ular suhbatlarda «Oʻchirilgan foydalanuvchi» nomidan qoladi, ismingiz, emailingiz va rasmingiz esa oʻchiriladi. Shikoyatlar ularga ilova qilingan xabarlar bilan birga xavfsizlik uchun saqlanadi va shikoyat yopilganidan taxminan 1 yil keyin oʻchiriladi. Toʻlov yozuvlari qonun talabiga koʻra saqlanadi. Foydalanilmagan Plus kunlari yoʻqoladi. Buni ortga qaytarib boʻlmaydi.', wrongPw: 'Parol notoʻgʻri. Qayta urinib koʻring.', open: 'Hisobni oʻchirish', pw: 'Tasdiqlash uchun parolingizni kiriting', confirm: 'Hisobimni oʻchirish', cancel: 'Bekor qilish' },
};
export const deleteAccountText = (lang?: string | null) => T[lang === 'ru' || lang === 'uz' ? lang : 'en'];

export function DeleteAccount({ lang, onDeleted }: { lang?: string | null; onDeleted: () => void }) {
  const t = deleteAccountText(lang);
  const [open, setOpen] = useState(false);
  const [pw, setPw] = useState('');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const cut = t.hint.search(/[.!?]\s/);
  const hintHead = cut >= 0 ? t.hint.slice(0, cut + 1) : t.hint;
  const hintRest = cut >= 0 ? t.hint.slice(cut + 2) : '';
  return (
    <div id="delete-account" className="px-4 sm:px-5 py-4 space-y-3">
      {/* The full legal text stays one tap away: first sentence visible, the rest folds out. */}
      <details className="group text-[12.5px] text-[#6b7382] leading-relaxed">
        <summary className="cursor-pointer list-none [&::-webkit-details-marker]:hidden">
          <span className="text-sm font-semibold text-[#101828] block mb-0.5">{t.title}</span>
          <span>{hintHead}</span>
          <span aria-hidden className="ml-1 inline-block text-[#2107aa] font-bold transition-transform group-open:rotate-180">⌄</span>
        </summary>
        {hintRest && <p className="mt-1">{hintRest}</p>}
      </details>
      {!open ? (
        <button type="button" className="min-h-10 px-4 rounded-[11px] border border-red-200 bg-white text-red-600 text-sm font-semibold hover:bg-red-50 inline-flex items-center gap-2" onClick={() => setOpen(true)}><Trash2 className="w-4 h-4" />{t.open}</button>
      ) : (
        <form className="flex flex-col sm:flex-row gap-2" onSubmit={async (e) => {
          e.preventDefault();
          setBusy(true); setErr(null);
          try {
            await api('/users/me', { method: 'DELETE', body: JSON.stringify({ currentPassword: pw }) });
            onDeleted();
          } catch (e2) {
            // WL4-06: wrong password is shown in the active UI language, never raw server English.
            const st = (e2 as { status?: number }).status;
            setErr(st === 401 || st === 403 ? t.wrongPw : e2 instanceof Error ? e2.message : t.wrongPw);
          } finally { setBusy(false); }
        }}>
          <input type="password" autoComplete="current-password" required aria-label={t.pw} placeholder={t.pw} value={pw} onChange={(e) => setPw(e.target.value)}
            className="h-10 px-3 bg-[#f9fafb] border border-[#e5e7eb] rounded-[11px] text-sm text-[#101828] placeholder:text-[#6b7080] caret-[#101828] flex-1 min-w-0" />
          <button type="submit" disabled={busy || !pw} className="h-10 px-4 rounded-[11px] bg-red-600 text-white text-sm font-semibold disabled:opacity-50">{t.confirm}</button>
          <button type="button" className="h-10 px-4 rounded-[11px] border border-[#d1d5dc] bg-white text-[#364153] text-sm font-medium hover:bg-[#f9fafb]" onClick={() => { setOpen(false); setPw(''); setErr(null); }}>{t.cancel}</button>
        </form>
      )}
      {err && <p className="text-xs text-red-600">{err}</p>}
    </div>
  );
}
