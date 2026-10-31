import { useEffect, useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { Brand } from './Brand';
import { SHOW_PRICING } from '../lib/featureFlags';
import { loginUrl, registerUrl } from '../lib/links';

const NAV_LINKS = [
  { to: '/#catalog', label: 'Catalog' },
  ...(SHOW_PRICING ? [{ to: '/#pricing', label: 'Pricing' }] : []),
  { to: '/#features', label: 'Features' },
  { to: '/#how', label: 'How It Works' },
];

function NavLinks({
  className,
  onNavigate,
}: {
  className?: string;
  onNavigate?: () => void;
}) {
  return (
    <>
      {NAV_LINKS.map((link) => (
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
      className={`sticky top-0 z-50 h-[72px] w-full border-b transition-[background,box-shadow,backdrop-filter] duration-300 ${
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

        <div className="flex items-center gap-4">
          <a
            className="hidden font-['Geist',sans-serif] text-sm font-semibold text-[#101828] transition-colors hover:text-[#2107aa] lg:inline"
            href={loginUrl()}
          >
            Sign in
          </a>
          <a
            className="hidden h-11 items-center justify-center rounded-lg bg-[#2107aa] px-6 font-['Manrope',sans-serif] text-[15px] font-semibold text-[var(--g-on-cta)] transition-transform hover:-translate-y-px md:inline-flex"
            href={registerUrl({ plan: 'free' })}
          >
            Get started
          </a>
          <button
            type="button"
            className="flex h-10 w-10 cursor-pointer flex-col items-center justify-center gap-[5px] rounded-xl border border-[#e2e8f0] bg-white p-2.5 lg:hidden"
            aria-label={open ? 'Close menu' : 'Open menu'}
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
              href={loginUrl()}
              onClick={() => setOpen(false)}
            >
              Sign in
            </a>
            <a
              className="flex h-11 items-center justify-center rounded-lg bg-[#2107aa] text-sm font-semibold text-[var(--g-on-cta)]"
              href={registerUrl({ plan: 'free' })}
              onClick={() => setOpen(false)}
            >
              Get started
            </a>
          </div>
        </div>
      )}
    </nav>
  );
}

export function SiteFooter() {
  return (
    <footer className="w-full border-t border-[#e2e8f0] bg-white">
      <div className="mx-auto flex max-w-[1440px] flex-col gap-16 px-5 pb-10 pt-20 md:px-10 lg:px-20">
        <div className="flex flex-col justify-between gap-10 lg:flex-row lg:items-start">
          <div className="flex max-w-[320px] flex-col gap-4">
            <Brand size="sm" />
            <p className="font-['Geist',sans-serif] text-[13px] leading-[1.5] text-[#4a5565]">
              Reading-first language learning for English, Russian, and Uzbek.
            </p>
          </div>

          <div className="flex flex-wrap gap-10 lg:gap-16">
            <div className="flex w-[160px] flex-col gap-4">
              <h4 className="font-['Manrope',sans-serif] text-[13px] font-bold uppercase text-[#101828]">
                Product
              </h4>
              <div className="flex flex-col gap-3 font-['Geist',sans-serif] text-[13px] text-[#4a5565]">
                <Link to="/#catalog" className="transition-colors hover:text-[#101828]">
                  Catalog
                </Link>
                {SHOW_PRICING && (
                  <Link to="/#pricing" className="transition-colors hover:text-[#101828]">
                    Pricing
                  </Link>
                )}
                <Link to="/#how" className="transition-colors hover:text-[#101828]">
                  How It Works
                </Link>
                <Link to="/roadmap" className="transition-colors hover:text-[#101828]">
                  Roadmap
                </Link>
              </div>
            </div>
            <div className="flex w-[160px] flex-col gap-4">
              <h4 className="font-['Manrope',sans-serif] text-[13px] font-bold uppercase text-[#101828]">
                Legal
              </h4>
              <div className="flex flex-col gap-3 font-['Geist',sans-serif] text-[13px] text-[#4a5565]">
                <Link to="/privacy" className="transition-colors hover:text-[#101828]">
                  Privacy Policy
                </Link>
                <Link to="/terms" className="transition-colors hover:text-[#101828]">
                  Terms of Service
                </Link>
              </div>
            </div>
          </div>
        </div>

        <div className="flex flex-col justify-between gap-3 border-t border-[#e2e8f0] pt-6 font-['Geist',sans-serif] text-xs text-[#99a1af] lg:flex-row lg:items-center">
          <p>© 2026 GOTCHA. All rights reserved.</p>
          <p>
            Powered by <span className="font-['Manrope',sans-serif] font-bold text-[#4a5565]">Atmos</span> · UZS
          </p>
        </div>
      </div>
    </footer>
  );
}
