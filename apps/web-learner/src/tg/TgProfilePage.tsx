import { Link, useNavigate } from 'react-router-dom';
import { BarChart3, ChevronRight, CreditCard, MessageSquare, Zap } from 'lucide-react';
import { paySom } from '@gotcha/shared';
import { useAuth } from '../lib/auth';
import { useLearnerLocale } from '../lib/learnerLocaleContext';
import { usePaymentsEnabled } from '../lib/limits';
import { plusDaysLeft, usePlusOffer } from '../lib/plusOffer';
import { LANGUAGE_META } from '../lib/types';
import { haptic } from '../lib/telegram';
import { tgCopyFor } from './tgCopy';

const row = 'flex items-center gap-3 min-h-[50px] px-3.5 text-[14.5px] text-[#101828] border-b border-[#f2f3f7] last:border-b-0';
const card = 'bg-white border border-[#e9ebf3] rounded-2xl overflow-hidden';

function Chevron() {
  return <ChevronRight className="w-[17px] h-[17px] text-[#9aa0ae] shrink-0" />;
}

/** `/app/profile` in the Telegram Mini App — screen 15. */
export default function TgProfilePage() {
  const navigate = useNavigate();
  const { user, preferences, stats, updatePreferences, logout } = useAuth();
  const { locale } = useLearnerLocale();
  const t = tgCopyFor(locale);
  const payments = usePaymentsEnabled();
  const offer = usePlusOffer(payments);

  const name = user?.displayName?.trim() || '';
  const initials = name.split(/\s+/).map((w) => w[0]).filter(Boolean).slice(0, 2).join('').toUpperCase() || 'G';
  const targets = (user?.targetLanguages ?? []).map((l) => LANGUAGE_META[l.targetLanguage as keyof typeof LANGUAGE_META]?.nativeName ?? l.targetLanguage);
  const nativeName = LANGUAGE_META[user?.nativeLanguage as keyof typeof LANGUAGE_META]?.nativeName ?? user?.nativeLanguage ?? '';
  const p30 = offer?.plans.find((p) => p.days === 30);
  const daysLeft = plusDaysLeft(offer?.expiresAt);
  const plusActive = !!offer?.active;
  const notificationsOn = preferences?.notificationsEnabled !== false;
  const contact = [user?.phone, user?.hasEmail ? user?.email : t.noEmail].filter(Boolean).join(' · ');

  const toggleNotifications = () => {
    haptic('select');
    void updatePreferences({ notificationsEnabled: !notificationsOn });
  };

  const signOut = () => {
    logout();
    navigate('/tg/login', { replace: true });
  };

  return (
    <div className="mx-auto max-w-[560px] px-4 pt-2 flex flex-col gap-2.5">
      <div className="flex items-center gap-3 py-1">
        <span className="size-[52px] rounded-full bg-g-blue-700 text-white grid place-items-center font-bold text-lg">{initials}</span>
        <div className="min-w-0">
          <div className="text-lg font-extrabold truncate">{name}</div>
          <div className="text-[13px] text-[#6b7080] truncate">
            {plusActive ? t.plusPlan : t.freePlan}
            {targets.length ? ` · ${targets.join(', ')}` : ''}
          </div>
        </div>
      </div>

      {payments && offer?.enabled && (
        <Link to="/app/plus" className="flex items-center gap-3 rounded-2xl bg-[#14112B] px-3.5 py-3 text-white">
          <span className="size-[38px] rounded-[11px] bg-g-blue-700 grid place-items-center shrink-0">
            <Zap className="w-[19px] h-[19px] text-[#ffe066]" />
          </span>
          <span className="flex-1 min-w-0 leading-tight">
            <b className="block text-[14.5px]">{t.plusCard}</b>
            <span className="text-[12.5px] text-[#c9c5ee]">
              {plusActive ? t.plusActive(daysLeft) : p30 ? t.plusPrice(paySom(p30.priceUzs, locale)) : ''}
            </span>
          </span>
          <span className="h-[34px] px-3 rounded-[10px] bg-white text-[#14112B] inline-flex items-center text-[13px] font-bold">
            {plusActive ? t.extend : t.plan}
          </span>
        </Link>
      )}

      <div className={card}>
        <Link to="/app/settings#account" className={row}>
          <span className="flex-1 min-w-0 leading-tight">
            {t.account}
            <span className="block text-xs text-[#6b7080] truncate">{contact}</span>
          </span>
          <Chevron />
        </Link>
      </div>

      <div className={card}>
        <Link to="/app/stats" className={row}>
          <BarChart3 className="w-[19px] h-[19px] text-[#4a5565]" />
          <span className="flex-1">{t.stats}</span>
          <Chevron />
        </Link>
        <Link to="/app/messages" className={row}>
          <MessageSquare className="w-[19px] h-[19px] text-[#4a5565]" />
          <span className="flex-1">{t.messages}</span>
          <Chevron />
        </Link>
        {payments && (
          <Link to="/app/payments" className={row}>
            <CreditCard className="w-[19px] h-[19px] text-[#4a5565]" />
            <span className="flex-1">{t.payments}</span>
            <Chevron />
          </Link>
        )}
      </div>

      <div className={card}>
        <Link to="/app/settings" className={row}>
          <span className="flex-1 min-w-0 leading-tight">
            {t.langsGoal}
            <span className="block text-xs text-[#6b7080] truncate">{t.langsGoalSub(nativeName, stats?.dailyGoalMinutes ?? preferences?.dailyGoalMinutes ?? 15)}</span>
          </span>
          <Chevron />
        </Link>
        <div className={row}>
          <span className="flex-1 min-w-0 leading-tight">
            {t.notifications}
            <span className="block text-xs text-[#6b7080]">{t.notificationsSub}</span>
          </span>
          <button
            type="button"
            role="switch"
            aria-checked={notificationsOn}
            aria-label={t.notifications}
            onClick={toggleNotifications}
            className={`w-12 h-7 rounded-full p-[3px] flex transition-colors ${notificationsOn ? 'bg-g-blue-700 justify-end' : 'bg-[#d5d8e2] justify-start'}`}
          >
            <span className="size-[22px] rounded-full bg-white shadow" />
          </button>
        </div>
        <div className={row}>
          <span className="flex-1">{t.theme}</span>
          <span className="text-[13.5px] text-[#6b7080]">{t.themeSub}</span>
        </div>
      </div>

      <div className={card}>
        <a href="mailto:support@gotchaa.uz" className={row}>
          <span className="flex-1">{t.help}</span>
          <span className="text-[13px] text-[#6b7080]">support@gotchaa.uz</span>
        </a>
        <button type="button" onClick={signOut} className={`${row} w-full text-left font-semibold !text-[#dc2626]`}>
          {t.logout}
        </button>
      </div>
    </div>
  );
}
