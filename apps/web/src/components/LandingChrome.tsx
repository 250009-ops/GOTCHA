import { useEffect, useRef, useState, type ReactNode } from 'react';
import { useSearchParams } from 'react-router-dom';
import '../landing-premium.css';
import { GotchaLogo } from './GotchaLogo';
import { LandingLangSwitch, LP_LANGS, type LpLang } from './LandingLangSwitch';
import { LANDING_COPY, SHOW_PLUS_ON_LANDING } from '../lib/landingCopy';
import { loginUrl, registerUrl } from '../lib/links';
import { useWebLocale } from '../lib/webLocaleContext';
import { buildId, queryWithLocale } from '../lib/queryLocale';
import { LEGAL_TITLES } from '../lib/legalPm';

/**
 * r3 (Kai): the landing header (nav, language switch, Log in, burger) and footer, shared by the landing,
 * /privacy, /terms, /oferta and the 404 page. Off the landing, nav anchors point at /?lang=<L>#… so ?lang is kept.
 */
// Footer build stamp: preview only, never in a production build (UI/UX 14:32).
const PREVIEW_STAMP = import.meta.env.VITE_PREVIEW_STAMP === 'true'; // QA/preview builds only; build:publish rejects VITE_PREVIEW_STAMP (PAY2-14)
const BUILD_COMMIT = import.meta.env.VITE_BUILD_COMMIT || '';
const BUILD_ID = buildId(BUILD_COMMIT, import.meta.env.VITE_BUILD_DATE || ''); // S4: footer build id (sha · date)
// UX review #4: localised burger labels (BURGER.md).
const BM: Record<LpLang, { lang: string; close: string; menu: string }> = {
  en: { lang: 'Language', close: 'Close menu', menu: 'Menu' },
  uz: { lang: 'Til', close: 'Menyuni yopish', menu: 'Menyu' },
  ru: { lang: 'Язык', close: 'Закрыть меню', menu: 'Меню' },
};
const NAV_IDS = ['#how', '#features', '#plus', '#faq'];

export function useLpLang(): LpLang {
  const { copyLocale } = useWebLocale();
  return (['uz', 'ru', 'en'].includes(copyLocale) ? copyLocale : 'uz') as LpLang;
}

/** Nav items [label, href]; Plus hidden when SHOW_PLUS_ON_LANDING is false. */
export function landingNav(L: LpLang, onLanding: boolean): (readonly [string, string])[] {
  return LANDING_COPY[L].nav
    .map((n, i) => [n, NAV_IDS[i]] as const)
    .filter(([, id]) => SHOW_PLUS_ON_LANDING || id !== '#plus')
    .map(([n, id]) => [n, onLanding ? id : `/?lang=${L}${id}`] as const);
}

export function LandingHeader({ onLanding = false }: { onLanding?: boolean }) {
  const { setLocale } = useWebLocale();
  const [params, setParams] = useSearchParams();
  const L = useLpLang();
  const C = LANDING_COPY[L];
  const T = BM[L];
  const nav = landingNav(L, onLanding);
  const [menuOpen, setMenuOpen] = useState(false);
  const hdr = useRef<HTMLElement>(null);
  const burgerBtn = useRef<HTMLButtonElement>(null);
  const panel = useRef<HTMLDivElement>(null);
  const startHref = registerUrl({ plan: 'free', from: onLanding ? 'landing' : 'site', ui: L });
  const loginHref = loginUrl({ ui: L });

  const onLang = (c: LpLang) => {
    setLocale(c);
    setParams(queryWithLocale(params, c), { replace: true });
  };

  // Burger: scroll lock, inert page, focus first link, Esc, focus trap, close on >=1024 (BURGER.md).
  // WLF-31: only the header bar's own items go inert (".bar"), never the burger panel (#bm) and its Log in.
  useEffect(() => {
    if (!menuOpen) return;
    const page = hdr.current!.closest('.lp') ?? document.body;
    const bar = hdr.current!.querySelector('.bar')!;
    const inertEls = [
      ...page.querySelectorAll(':scope > main, :scope > footer'),
      ...bar.querySelectorAll(':scope > .logo, :scope > ul, .right > .ls, .right > .login, .right > #navcta'),
    ] as HTMLElement[];
    inertEls.forEach((e) => e.setAttribute('inert', ''));
    document.documentElement.style.overflow = 'hidden';
    panel.current?.querySelector<HTMLElement>('.links a')?.focus();
    const focusables = () => [burgerBtn.current!, ...panel.current!.querySelectorAll<HTMLElement>('a[href], button')];
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') { e.preventDefault(); setMenuOpen(false); burgerBtn.current?.focus(); return; }
      if (e.key !== 'Tab') return;
      const f = focusables(); const i = f.indexOf(document.activeElement as HTMLElement);
      e.preventDefault();
      f[(i + (e.shiftKey ? -1 : 1) + f.length) % f.length].focus();
    };
    const onResize = () => { if (window.innerWidth >= 1024) setMenuOpen(false); };
    document.addEventListener('keydown', onKey);
    window.addEventListener('resize', onResize);
    return () => {
      inertEls.forEach((e) => e.removeAttribute('inert'));
      document.documentElement.style.overflow = '';
      document.removeEventListener('keydown', onKey);
      window.removeEventListener('resize', onResize);
    };
  }, [menuOpen]);

  return (
    <header ref={hdr} className={menuOpen ? 'nav menu-open' : 'nav'}><div className="wrap bar">
      <a className="logo" href={`/?lang=${L}`} aria-label="Gotcha"><GotchaLogo size={32} tone="light" elevated={false} className="brand-lockup" /></a>
      <ul id="nav">{nav.map(([n, id]) => <li key={n}><a href={id}>{n}</a></li>)}</ul>
      <div className="right">
        <LandingLangSwitch value={L} onChange={onLang} />
        <a className="login" href={loginHref} data-login="header">{C.login}</a>
        <a className="btn btn-white" href={startHref} id="navcta">{C.cta}</a>
        <button ref={burgerBtn} className="burger" type="button" aria-label={menuOpen ? T.close : T.menu} aria-expanded={menuOpen} aria-controls="bm" onClick={() => setMenuOpen((v) => !v)}>
          <svg width="22" height="22" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true"><path d={menuOpen ? 'M5 5l12 12M17 5 5 17' : 'M3 7h16M3 15h16'} /></svg>
        </button>
      </div>
    </div>
      {menuOpen && (
        <div className="bm" id="bm" ref={panel} role="dialog" aria-modal="true" aria-label={T.menu}>
          <nav><ul className="links">
            {nav.map(([n, id]) => (
              <li key={n}><a href={id} onClick={() => setMenuOpen(false)}>{n}<svg width="18" height="18" fill="none" stroke="rgba(255,255,255,.6)" strokeWidth="2" aria-hidden="true"><path d="m7 4 5 5-5 5" /></svg></a></li>
            ))}
          </ul></nav>
          <h3 id="bm-lh">{T.lang}</h3>
          <div className="seg" role="group" aria-labelledby="bm-lh">
            {LP_LANGS.map((l) => (
              <a key={l.code} href={`?lang=${l.code}`} lang={l.code} hrefLang={l.code} aria-label={l.name} title={l.name}
                aria-current={l.code === L ? 'true' : undefined}
                onClick={(e) => { e.preventDefault(); setMenuOpen(false); onLang(l.code); }}>
                <span className="flag" aria-hidden="true"><img src={l.flag} alt="" width={20} height={14} style={l.pos ? { objectPosition: l.pos } : undefined} /></span>{l.short}
              </a>
            ))}
          </div>
          <div className="foot">
            <a className="btn btn-white" href={startHref} data-cta="burger">{C.cta}</a>
            <a className="login" href={loginHref} data-login="burger">{C.login}</a>
          </div>
        </div>
      )}
    </header>
  );
}

export function LandingFooter() {
  const L = useLpLang();
  const C = LANDING_COPY[L];
  return (
    <footer><div className="wrap"><div className="grid"><div>
      <div className="row"><a className="logo" href={`/?lang=${L}`} aria-label="Gotcha"><GotchaLogo size={28} tone="ink" elevated={false} className="brand-lockup" /></a>
        <span id="contact" style={{ marginLeft: 'auto' }}>{C.contactLine.replace('support@gotchaa.uz', '')}<a className="mail" href="mailto:support@gotchaa.uz">support@gotchaa.uz</a></span></div>
      <div className="row fine"><span>© 2026 Gotcha · {C.entity}</span><a href={`/privacy?lang=${L}`}>{C.legal[0]}</a><a href={`/terms?lang=${L}`}>{C.legal[1]}</a><a href={`/oferta?lang=${L}`} data-footer="oferta">{LEGAL_TITLES.oferta[L]}</a></div>
      {BUILD_ID && <div className="build-id" data-build-id={BUILD_ID}>build {BUILD_ID}</div>}
      {PREVIEW_STAMP && BUILD_COMMIT && typeof window !== 'undefined' && !/(^|\.)gotchaa\.uz$/.test(window.location.hostname) && (
        <div className="build-stamp" data-build-commit={BUILD_COMMIT}>preview build {BUILD_COMMIT}</div>
      )}
    </div></div></div></footer>
  );
}

/** Page shell in the landing design (light only): header, page body, footer. */
export function LandingShell({ children }: { children: ReactNode }) {
  const L = useLpLang();
  return (
    <div className="lp lp-page" data-theme="light" lang={L}>
      <LandingHeader />
      {children}
      <LandingFooter />
    </div>
  );
}
