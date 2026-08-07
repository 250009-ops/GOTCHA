import { useEffect, useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { Brand } from './Brand';
import { Icon, landingAssets } from '../assets/landing';
import { loginUrl, registerUrl } from '../lib/links';

function NavLinks({ onNavigate }: { onNavigate?: () => void }) {
  return (
    <>
      <Link
        to="/#features"
        onClick={onNavigate}
        className="text-sm font-medium text-[#6a7282] hover:text-[#101828] transition-colors"
      >
        Features
      </Link>
      <Link
        to="/#how"
        onClick={onNavigate}
        className="text-sm font-medium text-[#6a7282] hover:text-[#101828] transition-colors"
      >
        How it works
      </Link>
      <Link
        to="/#pricing"
        onClick={onNavigate}
        className="text-sm font-medium text-[#6a7282] hover:text-[#101828] transition-colors"
      >
        Pricing
      </Link>
    </>
  );
}

export function SiteNav() {
  const [open, setOpen] = useState(false);
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

  return (
    <nav className="sticky top-0 z-50 w-full h-[72px] bg-white/[0.92] backdrop-blur-[12px] border-b border-[#e5e7eb]">
      <div className="mx-auto max-w-[1440px] h-full px-4 md:px-12 lg:px-[120px] flex items-center justify-between gap-6">
        <Brand />

        {/* Desktop nav links */}
        <div className="hidden md:flex items-center gap-6">
          <NavLinks />
        </div>

        {/* Desktop actions */}
        <div className="hidden md:flex items-center gap-3">
          <a
            className="flex items-center justify-center h-9 px-3.5 border border-[#e5e7eb] rounded-xl text-sm font-medium text-[#4a5565] hover:translate-y-[-1px] transition-transform"
            href={loginUrl()}
          >
            Sign in
          </a>
          <a
            className="flex items-center gap-2 h-9 px-4 bg-[#2107aa] text-white text-sm font-semibold rounded-xl shadow-[0_10px_12px_rgba(33,7,170,0.15)] hover:translate-y-[-1px] transition-transform"
            href={registerUrl({ plan: 'free' })}
          >
            Get for Free
            <Icon src={landingAssets.arrowRight} size={16} />
          </a>
        </div>

        {/* Mobile hamburger button */}
        <button
          type="button"
          className={`md:hidden flex flex-col items-center justify-center gap-[5px] w-10 h-10 p-2.5 border border-[#e5e7eb] rounded-xl bg-white cursor-pointer`}
          aria-label={open ? 'Close menu' : 'Open menu'}
          aria-expanded={open}
          onClick={() => setOpen((v) => !v)}
        >
          <span
            className={`block w-[18px] h-0.5 bg-[#101828] rounded-[1px] transition-transform duration-200 ${
              open ? 'translate-y-[7px] rotate-45' : ''
            }`}
          />
          <span
            className={`block w-[18px] h-0.5 bg-[#101828] rounded-[1px] transition-opacity duration-200 ${
              open ? 'opacity-0' : ''
            }`}
          />
          <span
            className={`block w-[18px] h-0.5 bg-[#101828] rounded-[1px] transition-transform duration-200 ${
              open ? '-translate-y-[7px] -rotate-45' : ''
            }`}
          />
        </button>
      </div>

      {/* Mobile drawer */}
      {open && (
        <div className="md:hidden flex flex-col gap-5 px-4 py-6 bg-white border-b border-[#e5e7eb] shadow-[0_12px_24px_rgba(15,23,42,0.08)]">
          <div className="flex flex-col gap-1">
            <Link
              to="/#features"
              onClick={() => setOpen(false)}
              className="block px-1 py-3 text-base font-semibold text-[#101828]"
            >
              Features
            </Link>
            <Link
              to="/#how"
              onClick={() => setOpen(false)}
              className="block px-1 py-3 text-base font-semibold text-[#101828]"
            >
              How it works
            </Link>
            <Link
              to="/#pricing"
              onClick={() => setOpen(false)}
              className="block px-1 py-3 text-base font-semibold text-[#101828]"
            >
              Pricing
            </Link>
          </div>
          <div className="flex flex-col gap-2.5">
            <a
              className="flex items-center justify-center h-9 border border-[#e5e7eb] rounded-xl text-sm font-medium text-[#4a5565]"
              href={loginUrl()}
              onClick={() => setOpen(false)}
            >
              Sign in
            </a>
            <a
              className="flex items-center justify-center gap-2 h-9 bg-[#2107aa] text-white text-sm font-semibold rounded-xl"
              href={registerUrl({ plan: 'free' })}
              onClick={() => setOpen(false)}
            >
              Get for Free
              <Icon src={landingAssets.arrowRight} size={16} />
            </a>
          </div>
        </div>
      )}
    </nav>
  );
}

export function SiteFooter() {
  return (
    <footer className="w-full bg-[#101828]">
      <div className="mx-auto max-w-[1440px] px-4 md:px-12 lg:px-[120px] py-8 lg:py-12 flex flex-col gap-8">
        {/* Top row */}
        <div className="flex flex-col lg:flex-row justify-between gap-8">
          {/* Brand column */}
          <div className="flex flex-col gap-2.5 lg:max-w-[320px]">
            <Brand light size="sm" />
            <p className="text-[13px] leading-4 text-[#6a7282]">
              Reading-first language learning for English, Russian, and Uzbek.
            </p>
          </div>

          {/* Links columns */}
          <div className="flex gap-8 lg:gap-16">
            <div className="flex flex-col gap-2.5">
              <h4 className="text-xs font-semibold tracking-[0.6px] uppercase text-white">
                Product
              </h4>
              <Link to="/#features" className="text-[13px] leading-4 text-[#6a7282] hover:text-white transition-colors">
                Features
              </Link>
              <Link to="/#pricing" className="text-[13px] leading-4 text-[#6a7282] hover:text-white transition-colors">
                Pricing
              </Link>
              <Link to="/roadmap" className="text-[13px] leading-4 text-[#6a7282] hover:text-white transition-colors">
                Roadmap
              </Link>
            </div>
            <div className="flex flex-col gap-2.5">
              <h4 className="text-xs font-semibold tracking-[0.6px] uppercase text-white">
                Legal
              </h4>
              <Link to="/privacy" className="text-[13px] leading-4 text-[#6a7282] hover:text-white transition-colors">
                Privacy
              </Link>
              <Link to="/terms" className="text-[13px] leading-4 text-[#6a7282] hover:text-white transition-colors">
                Terms
              </Link>
            </div>
          </div>
        </div>

        {/* Divider */}
        <div className="h-px bg-[#1e2939]" />

        {/* Bottom row */}
        <div className="flex flex-col lg:flex-row justify-between gap-2 text-[13px] leading-4 text-[#4a5565]">
          <p>© 2026 Gotcha Language Learning. All rights reserved.</p>
          <p>Built with ❤️ for language learners everywhere.</p>
        </div>
      </div>
    </footer>
  );
}
