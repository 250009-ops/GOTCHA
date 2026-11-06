import { Link, useLocation } from 'react-router-dom';
import { Zap } from 'lucide-react';
import { plusDaysLeft, usePlusOffer } from '../lib/plusOffer';
import { Tooltip, TooltipContent, TooltipTrigger } from './ui/tooltip';
import { cn } from './ui/utils';

/** Sidebar Plus entry (uz / ru / en). */
export const PLUS_CARD_COPY = {
  uz: { title: 'Gotcha Plus', sub: 'Soʻz izohlari va Mashq uchun kunlik limit yoʻq', cta: 'Plusʼni olish', active: (d: number) => `Plus faol · ${d} kun qoldi`, extend: 'Uzaytirish' },
  ru: { title: 'Gotcha Plus', sub: 'Без дневного лимита на пояснения слов и Практику', cta: 'Подключить Plus', active: (d: number) => `Plus активен · осталось ${d} дн.`, extend: 'Продлить' },
  en: { title: 'Gotcha Plus', sub: 'No daily limit on word lookups and Practice', cta: 'Get Plus', active: (d: number) => `Plus active · ${d} days left`, extend: 'Extend' },
};

/**
 * The sidebar card is a real link to /app/plus (not a static banner). Free users see the offer;
 * Plus users see days left and "Extend". Hidden when Plus is not sold (offer.enabled false).
 */
export function SidebarPlusCard({ collapsed, locale }: { collapsed: boolean; locale: string }) {
  const offer = usePlusOffer();
  const { pathname } = useLocation();
  const c = PLUS_CARD_COPY[locale === 'ru' || locale === 'en' ? locale : 'uz'];
  if (offer && !offer.enabled) return null;
  const active = !!offer?.active;
  const days = plusDaysLeft(offer?.expiresAt);
  const current = pathname.replace(/\/$/, '').endsWith('/app/plus');
  const label = active ? c.active(days) : c.title;

  if (collapsed) {
    return (
      <Tooltip>
        <TooltipTrigger asChild>
          <Link
            to="/app/plus"
            aria-label={label}
            aria-current={current ? 'page' : undefined}
            className="w-full flex items-center justify-center py-2.5 rounded-[14px] bg-g-blue-700 border border-white/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/70"
          >
            <Zap className="w-4 h-4 text-amber-300" />
          </Link>
        </TooltipTrigger>
        <TooltipContent side="right" sideOffset={8} className="bg-gray-900 text-white border-white/10 text-xs">
          {label}
        </TooltipContent>
      </Tooltip>
    );
  }

  return (
    <Link
      to="/app/plus"
      aria-current={current ? 'page' : undefined}
      className={cn(
        'block w-full p-3.5 rounded-2xl bg-g-blue-700 border border-white/[0.14] text-white hover:bg-g-blue-800 transition-colors',
        'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/70',
      )}
    >
      <span className="flex items-center gap-2">
        <Zap className="w-4 h-4 text-amber-300" />
        <b className="text-[13.5px]">{c.title}</b>
      </span>
      <span className="block mt-1.5 text-[11.5px] leading-snug text-[#dcd8ff]">{active ? c.active(days) : c.sub}</span>
      <span className="mt-2.5 h-9 rounded-[10px] bg-white text-[#14112B] flex items-center justify-center text-[13px] font-bold">
        {active ? c.extend : c.cta}
      </span>
    </Link>
  );
}
