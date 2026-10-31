import { useEffect, useMemo, useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { Brand } from './Brand';
import { UiLanguageDropdown } from './UiLanguageDropdown';
import { loginUrl, registerUrl } from '../lib/links';
import { useMarketingCopy, useWebLocale } from '../lib/webLocaleContext';
import { isWebLocale, marketingLocaleFor, type WebLocale } from '../lib/webLocale';
import { LEGAL_TITLES } from '../lib/legalPm.titles';

function LanguagePicker({ className }: { className?: string }) {
  const { copyLocale, setLocale } = useWebLocale();
  const copy = useMarketingCopy();

  return (
    <UiLanguageDropdown
      value={copyLocale as 'en' | 'ru' | 'uz'}
      onChange={(code) => {
        if (isWebLocale(code)) setLocale(code as WebLocale);
      }}
      ariaLabel={copy.nav.language}
      className={className}
    />
  );
}

function NavLinks({
  className,
  onNavigate,
}: {
  className?: string;
  onNavigate?: () => void;
}) {
  const copy = useMarketingCopy();
  const navLinks = useMemo(
    () => [
      { to: '/#catalog', label: copy.nav.catalog },
      { to: '/#features', label: copy.nav.features },
      { to: '/#how', label: copy.nav.how },
    ],
    [copy],
  );

  return (
    <>
      {navLinks.map((link) => (
        <Link
          key={link.to}
          to={link.to}
          onClick={onNavigate}
          className={className ?? 'text-sm font-medium text-[#4a5565] transition-colors hover:text-[#101828]'}
        >
          {link.label}
        </Link>
      ))}
    </>
  );
}

export function SiteNav() {
  const { copyLocale } = useWebLocale();
  const copy = useMarketingCopy();
  const [open, setOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);
  const { pathname, hash } = useLocation();

  useEffect(() => {
    setOpen(false);
  }, [pathname, hash]);

  useEffect(() => {
    document.body.style.overflow = open ? 'hidden' : '';
    return () => {
      document.body.style.overflow = '';
    };
  }, [open]);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 48);
    onScroll();
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  return (
    <nav
      className={`sticky top-0 z-50 h-[72px] w-full overflow-visible border-b transition-[background,box-shadow,backdrop-filter] duration-300 ${
        scrolled
          ? 'border-[#e2e8f0] bg-white/[0.95] shadow-[0_8px_24px_rgba(16,24,40,0.08)] backdrop-blur-[12px]'
          : 'border-[#e2e8f0] bg-white'
      }`}
    >
      <div className="mx-auto flex h-full max-w-[1440px] items-center justify-between gap-4 px-5 md:px-10 lg:px-20">
        <Brand />

        <div className="hidden items-center gap-8 lg:flex">
          <NavLinks />
        </div>

        <div className="flex items-center gap-3 sm:gap-4">
          <LanguagePicker className="inline-flex shrink-0" />
          <a
            className="hidden font-['Manrope',sans-serif] text-sm font-semibold text-[#101828] transition-colors hover:text-[#2107aa] lg:inline"
            href={loginUrl({ ui: copyLocale })}
          >
            {copy.nav.signIn}
          </a>
          <a
            className="hidden h-11 items-center justify-center rounded-lg bg-[#2107aa] px-6 font-['Manrope',sans-serif] text-[15px] font-semibold text-[var(--g-on-cta)] transition-transform hover:-translate-y-px md:inline-flex"
            href={registerUrl({ plan: 'free', ui: copyLocale })}
          >
            {copy.nav.getStarted}
          </a>
          <button
            type="button"
            className="flex h-10 w-10 cursor-pointer flex-col items-center justify-center gap-[5px] rounded-xl border border-[#e2e8f0] bg-white p-2.5 lg:hidden"
            aria-label={open ? copy.nav.closeMenu : copy.nav.openMenu}
            aria-expanded={open}
            onClick={() => setOpen((v) => !v)}
          >
            <span
              className={`block h-0.5 w-[18px] rounded-[1px] bg-[#101828] transition-transform duration-200 ${
                open ? 'translate-y-[7px] rotate-45' : ''
              }`}
            />
            <span
              className={`block h-0.5 w-[18px] rounded-[1px] bg-[#101828] transition-opacity duration-200 ${
                open ? 'opacity-0' : ''
              }`}
            />
            <span
              className={`block h-0.5 w-[18px] rounded-[1px] bg-[#101828] transition-transform duration-200 ${
                open ? '-translate-y-[7px] -rotate-45' : ''
              }`}
            />
          </button>
        </div>
      </div>

      {open && (
        <div className="flex flex-col gap-5 border-b border-[#e2e8f0] bg-white px-5 py-6 shadow-[0_12px_24px_rgba(15,23,42,0.08)] lg:hidden">
          <div className="flex flex-col gap-1">
            <NavLinks
              onNavigate={() => setOpen(false)}
              className="block px-1 py-3 text-base font-semibold text-[#101828]"
            />
          </div>
          <div className="flex flex-col gap-2.5">
            <a
              className="flex h-11 items-center justify-center rounded-lg border border-[#e2e8f0] text-sm font-medium text-[#4a5565]"
              href={loginUrl({ ui: copyLocale })}
              onClick={() => setOpen(false)}
            >
              {copy.nav.signIn}
            </a>
            <a
              className="flex h-11 items-center justify-center rounded-lg bg-[#2107aa] text-sm font-semibold text-[var(--g-on-cta)]"
              href={registerUrl({ plan: 'free', ui: copyLocale })}
              onClick={() => setOpen(false)}
            >
              {copy.nav.getStarted}
            </a>
          </div>
        </div>
      )}
    </nav>
  );
}

const ENTITY = { uz: 'Erkin Tizim jamoasi', ru: 'команда Erkin Tizim', en: 'the Erkin Tizim team' } as const;

export function SiteFooter() {
  const copy = useMarketingCopy();
  const { copyLocale } = useWebLocale();
  const footerLocale = marketingLocaleFor(copyLocale);

  return (
    <footer className="w-full border-t border-[#e2e8f0] bg-white">
      <div className="mx-auto flex max-w-[1440px] flex-col gap-16 px-5 pb-10 pt-20 md:px-10 lg:px-20">
        <div className="flex flex-col justify-between gap-10 lg:flex-row lg:items-start">
          <div className="flex max-w-[320px] flex-col gap-4">
            <Brand size="sm" />
            <p className="font-['Manrope',sans-serif] text-[13px] leading-[1.5] text-[#4a5565]">{copy.footer.tagline}</p>
          </div>

          <div className="flex flex-wrap gap-10 lg:gap-16">
            <div className="flex w-[160px] flex-col gap-4">
              <h4 className="font-['Manrope',sans-serif] text-[13px] font-bold uppercase text-[#101828]">
                {copy.footer.product}
              </h4>
              <div className="flex flex-col gap-3 font-['Manrope',sans-serif] text-[13px] text-[#4a5565]">
                <Link to="/#catalog" className="transition-colors hover:text-[#101828]">
                  {copy.nav.catalog}
                </Link>
                <Link to="/#how" className="transition-colors hover:text-[#101828]">
                  {copy.nav.how}
                </Link>
              </div>
            </div>
            <div className="flex w-[160px] flex-col gap-4">
              <h4 className="font-['Manrope',sans-serif] text-[13px] font-bold uppercase text-[#101828]">
                {copy.footer.legal}
              </h4>
              <div className="flex flex-col gap-3 font-['Manrope',sans-serif] text-[13px] text-[#4a5565]">
                <Link to="/privacy" className="transition-colors hover:text-[#101828]">
                  {copy.footer.privacy}
                </Link>
                <Link to="/terms" className="transition-colors hover:text-[#101828]">
                  {copy.footer.terms}
                </Link>
                <Link to="/oferta" className="transition-colors hover:text-[#101828]">
                  {LEGAL_TITLES.oferta[footerLocale]}
                </Link>
              </div>
            </div>
          </div>
        </div>

        <div className="flex flex-col justify-between gap-3 border-t border-[#e2e8f0] pt-6 font-['Manrope',sans-serif] text-xs text-[#99a1af] lg:flex-row lg:items-center">
          <p>{copy.footer.rights} · {ENTITY[copyLocale as 'uz' | 'ru' | 'en'] ?? ENTITY.en}</p>
          <a href="mailto:support@gotchaa.uz" className="transition-colors hover:text-[#101828]">support@gotchaa.uz</a>
        </div>
      </div>
    </footer>
  );
}
