import { useEffect, useRef, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import '../landing-premium.css';
import { Seo } from '../components/Seo';
import { LandingLangSwitch, type LpLang } from '../components/LandingLangSwitch';
import { LANDING_BOOKS, LANDING_COPY } from '../lib/landingCopy';
import { libraryUrl, loginUrl, registerUrl } from '../lib/links';
import { useWebLocale } from '../lib/webLocaleContext';
import lookup from '../data/lookup-capture.json';
import { plusCta } from '../lib/plusCta';

/** Landing premium rev 4 (team/uiux/landing-premium). No stats, learner counts or reader rankings are rendered (no marketing API call). */
// PLUS-OFFER §4: the 50% import bullet (plusOpt) shows only once importDiscountPct = 50 is live in production.
// Until Plus checkout exists (PLUS-OFFER §5), prices show but the CTA is 'Start free' + Marketing's pre-launch note.
const CHECKOUT_LIVE = import.meta.env.VITE_PLUS_CHECKOUT_LIVE === 'true';
const IMPORT_DISCOUNT_LIVE = import.meta.env.VITE_PLUS_IMPORT_DISCOUNT_LIVE === 'true';
// Lookup popover renders only from a real captured API response (src/data/lookup-capture.json). Never typed by hand.
type Captured = { lemma?: string; translation?: string; contextualMeaning?: string | null; partOfSpeech?: string | null };
const LK = lookup as unknown as { captured: boolean; response: Captured | null };
const CAPTURED: Captured | null = LK.captured ? LK.response : null;

const BASE = import.meta.env.BASE_URL;
const ico = { check: <path d="M3.5 8.5 6.5 11.5 12.5 4.5" />, plus: <path d="M8 2v12M2 8h12" /> };
const Svg = ({ k, s = 16 }: { k: keyof typeof ico; s?: number }) => (
  <svg width={s} height={s} viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">{ico[k]}</svg>
);
const D_ICO = ['M2 4h12M2 8h8M2 12h10', 'M4 2h8v12l-4-3-4 3z', 'M4 2h5l3 3v9H4z', 'M3 8.5 6.5 12 13 4', 'M3 13V8M8 13V3M13 13V6'];
const LN: Record<string, string> = { en: 'English', tr: 'Türkçe' };
const FAN = [[-24, -250, 30], [-14, -160, 12], [-5, -70, 0], [5, 20, 0], [14, 110, 12], [24, 200, 30]];

function Popover({ d }: { d: Captured }) {
  return (
    <div className="pop" id="pop1">
      <div className="hd">Dictionary<span>✕</span></div>
      <div className="bd">
        <div className="word"><b>{lookup.word}</b><span className="tag">word</span></div>
        {d.lemma && <div className="lemma">{d.lemma}{d.partOfSpeech ? ` · ${d.partOfSpeech}` : ''}</div>}
        {d.contextualMeaning && <div className="box m"><small>Natural meaning</small>{d.contextualMeaning}</div>}
        {d.translation && <div className="box t"><small>Translation</small>{d.translation}</div>}
      </div>
    </div>
  );
}

export default function LandingPage() {
  const { copyLocale, setLocale } = useWebLocale();
  const [params, setParams] = useSearchParams();
  const L = (['uz', 'ru', 'en'].includes(copyLocale) ? copyLocale : 'uz') as LpLang;
  const C = LANDING_COPY[L];
  const [menuOpen, setMenuOpen] = useState(false);
  const [tile, setTile] = useState(1);
  const [wide, setWide] = useState(() => typeof window !== 'undefined' && window.innerWidth >= 1024);
  const root = useRef<HTMLDivElement>(null);

  const ui = L;
  const startHref = registerUrl({ plan: 'free', from: 'landing', ui });
  const loginHref = loginUrl({ ui });
  const libHref = libraryUrl({ ui });

  const onLang = (c: LpLang) => {
    setLocale(c);
    const p = new URLSearchParams(params);
    p.set('lang', c);
    setParams(p, { replace: true });
  };

  useEffect(() => {
    const r = () => setWide(window.innerWidth >= 1024);
    window.addEventListener('resize', r);
    return () => window.removeEventListener('resize', r);
  }, []);

  useEffect(() => {
    const el = root.current;
    if (!el || params.has('static') || !matchMedia('(prefers-reduced-motion: no-preference)').matches) return;
    el.classList.add('anim');
    const io = new IntersectionObserver((es) => es.forEach((e) => { if (e.isIntersecting) { e.target.classList.add('in'); io.unobserve(e.target); } }), { rootMargin: '0px 0px -10% 0px' });
    el.querySelectorAll('.rv').forEach((e) => io.observe(e));
    return () => io.disconnect();
  }, [params]);

  const pc = plusCta(C, CHECKOUT_LIVE, ui);
  const plusB = IMPORT_DISCOUNT_LIVE ? [C.plusB[0], C.plusOpt, ...C.plusB.slice(1)] : [...C.plusB];
  const navIds = ['#how', '#features', '#plus', '#faq'];

  return (
    <div className="lp" data-theme="light" ref={root} lang={L}>
      <Seo title="GOTCHA" description={C.sub} />
      <header className="nav"><div className="wrap">
        <a className="logo" href={`/?lang=${L}`} aria-label="Gotcha"><span className="mark">G</span><span className="wm">GOTCHA</span></a>
        <ul id="nav">{C.nav.map((n, i) => <li key={n}><a href={navIds[i]}>{n}</a></li>)}</ul>
        <div className="right">
          <LandingLangSwitch value={L} onChange={onLang} />
          <a className="login" href={loginHref}>{C.login}</a>
          <a className="btn btn-white" href={startHref} id="navcta">{C.cta}</a>
          <button className="burger" type="button" aria-label="Menu" aria-expanded={menuOpen} aria-controls="mnav" onClick={() => setMenuOpen((v) => !v)}>
            <svg width="22" height="22" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true"><path d="M3 7h16M3 15h16" /></svg>
          </button>
        </div>
      </div>
        {menuOpen && (
          <nav id="mnav" className="mnav"><div className="wrap">
            {C.nav.map((n, i) => <a key={n} href={navIds[i]} onClick={() => setMenuOpen(false)}>{n}</a>)}
            <a href={loginHref}>{C.login}</a>
          </div></nav>
        )}
      </header>

      <main>
        <section className="hero" style={{ padding: 0 }}><div className="wrap"><div className="grid">
          <div className="hero-copy">
            <h1>{C.h1}</h1>
            <p className="sub">{C.sub}</p>
            <div className="ctas">
              <a className="btn btn-white" href={startHref} data-cta="hero">{C.cta}</a>
              <a className="btn btn-ghost" href="#how"><span>{C.cta2}</span><svg width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true"><path d="M8 3v10M3 8l5 5 5-5" /></svg></a>
            </div>
          </div>
          {/* Render mirrors apps/web-learner ReaderPage.tsx. Text: Crime and Punishment (tr. Constance Garnett, public domain), live catalog id b8b9b407. */}
          <div className="hero-visual" aria-hidden="true">
            <div className="reader">
              <div className="bar"><svg width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2"><path d="M10 3 5 8l5 5" /></svg><b>Crime and Punishment</b><span className="prog"><i /></span></div>
              <div className="page">
                <div className="ch">Part I</div>
                <h3>Chapter I</h3>
                <p className="body">On an exceptionally hot evening early in July a young man came out of the <span className="w-learning">garret</span> in which he <span className="w-unknown">lodged</span> in S. Place and walked slowly, as though in <span className="w-sel">hesitation</span>, towards K. bridge. He had successfully avoided meeting his landlady on the staircase. His garret was under the roof of a high, five-storied house and was more like a cupboard than a room.</p>
              </div>
            </div>
            {CAPTURED && <Popover d={CAPTURED} />}
          </div>
        </div></div></section>

        <section className="demo" id="features"><div className="wrap"><div className="grid">
          <div className="sec-head rv"><h2>{C.featT}</h2></div>
          <ol className="demo-list rv" id="demo" style={CAPTURED ? undefined : { gridColumn: '1/-1' }}>
            {[2, 3, 1, 4, 5].map((i, j) => (
              <li key={i} className={j === 0 ? 'on' : undefined}>
                <span className="ic"><svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" aria-hidden="true"><path d={D_ICO[j]} /></svg></span>
                <h3>{C.feat_titles[i]}</h3><p>{C.feat_lines[i]}</p>
              </li>
            ))}
          </ol>
        </div></div></section>

        <section id="how"><div className="wrap"><div className="grid">
          <div className="sec-head rv"><span className="eyebrow">Gotcha</span><h2>{C.how}</h2></div>
          <div className="steps" id="steps">
            {C.steps_titles.map((t, i) => <div className="step rv" key={t}><div className="n">0{i + 1}</div><h3>{t}</h3><p>{C.steps_lines[i]}</p></div>)}
          </div>
        </div></div></section>

        <section id="library" style={{ paddingTop: 0 }}><div className="wrap"><div className="grid">
          <div className="sec-head rv"><h2>{C.libT}</h2><p className="lead">{C.libL}</p></div>
          <div className="covers rv" id="covers">
            {LANDING_BOOKS.map((b) => (
              <a className="cover" href={libHref} key={b.id}>
                <img src={`${BASE}landing/covers/${b.id}.jpg`} alt={b.title} loading="lazy" width={800} height={1200} />
                <b>{b.title}</b><span>{b.author}</span><span>{LN[b.language] ?? b.language}</span>
              </a>
            ))}
          </div>
          <div className="lib-foot rv"><strong style={{ color: 'var(--l-ink)' }}>{C.lt}</strong><p>{C.lb}</p></div>
        </div></div></section>

        <section className="plus" id="plus"><div className="wrap"><div className="grid">
          <div className="plus-card rv">
            <div className="plus-l"><span className="eyebrow">Plus</span><h2 style={{ marginTop: 12 }}>{C.plusT}</h2><p className="lead">{C.plusLead}</p>
              <ul id="plusB">{plusB.map((b) => <li key={b}><Svg k="check" s={18} /><span>{b}</span></li>)}</ul></div>
            <div className="plus-r">
              <div className="opt" id="tiles" role="radiogroup">
                {C.plusPrice.map((p, i) => {
                  const m = p.match(/^(.+?), (.+?)(?: \((.+)\))?$/)!;
                  return (
                    <div key={p} className={`tile ${i === tile ? 'sel' : ''}`} role="radio" aria-checked={i === tile} tabIndex={0}
                      onClick={() => setTile(i)} onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); setTile(i); } }}>
                      <span className="radio" /><span><span className="dur">{m[1]}</span>{m[3] && <span className="save">{m[3]}</span>}</span><span className="price">{m[2]}</span>
                    </div>
                  );
                })}
              </div>
              <a className="btn btn-brand" href={pc.href} data-cta="plus" data-plus-live={String(pc.live)}>{pc.label}</a><p className="note">{pc.note}</p>
            </div>
          </div>
        </div></div></section>

        <section id="faq"><div className="wrap"><div className="grid">
          <div className="faq-head rv"><h2>{C.faqT}</h2></div>
          <div className="faq-list rv" id="faqL">
            {C.faq_questions.map((q, i) => <details key={q} open={i === 0}><summary>{q}<Svg k="plus" s={20} /></summary><p>{C.faq_answers[i]}</p></details>)}
          </div>
        </div></div></section>

        <section className="final"><div className="wrap"><div className="final-card">
          <div className="final-copy">
            <h2>{C.fh}</h2>
            <p className="fn">{C.fn}</p>
            <a className="btn btn-white btn-lg" href={startHref}><span>{C.cta_final}</span><svg width="18" height="18" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true"><path d="M3 8h10M9 4l4 4-4 4" /></svg></a>
          </div>
          <div className="final-vis" aria-hidden="true" id="fan">
            {LANDING_BOOKS.map((b, i) => (
              <div key={b.id} className="fan" style={{ transform: `translateX(${FAN[i][1] * (wide ? 0.6 : 0.44) - (wide ? 150 : 62)}px) translateY(${FAN[i][2]}px) rotate(${FAN[i][0]}deg)`, zIndex: i < 3 ? i : 6 - i }}>
                <img src={`${BASE}landing/covers/${b.id}.jpg`} alt="" loading="lazy" />
              </div>
            ))}
          </div>
        </div></div></section>
      </main>

      <footer><div className="wrap"><div className="grid"><div>
        <div className="row"><a className="logo" href={`/?lang=${L}`}><span className="mark">G</span><span className="wm">GOTCHA</span></a>
          <span id="contact" style={{ marginLeft: 'auto' }}>{C.contactLine.replace('support@gotchaa.uz', '')}<a className="mail" href="mailto:support@gotchaa.uz">support@gotchaa.uz</a></span></div>
        <div className="row fine"><span>© 2026 Gotcha · {C.entity}</span><a href={`/privacy?lang=${L}`}>{C.legal[0]}</a><a href={`/terms?lang=${L}`}>{C.legal[1]}</a></div>
      </div></div></div></footer>
    </div>
  );
}
