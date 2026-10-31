import { useEffect, useRef, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import '../landing-premium.css';
import { Seo } from '../components/Seo';
import { LandingFooter, LandingHeader } from '../components/LandingChrome';
import { type LpLang } from '../components/LandingLangSwitch';
import { LANDING_BOOKS, LANDING_COPY, SHOW_PLUS_ON_LANDING, bookFor } from '../lib/landingCopy';
import { libraryUrl, registerUrl } from '../lib/links';
import { useWebLocale } from '../lib/webLocaleContext';
import lookup from '../data/lookup-capture.json';
import { plusCta } from '../lib/plusCta';

/** Landing premium rev 4 (team/uiux/landing-premium). No stats, learner counts or reader rankings are rendered (no marketing API call). */
// PLUS-OFFER §4: the 50% import bullet (plusOpt) shows only once importDiscountPct = 50 is live in production.
// Until Plus checkout exists (PLUS-OFFER §5), prices show but the CTA is 'Start free' + Marketing's pre-launch note.
const CHECKOUT_LIVE = import.meta.env.VITE_PLUS_CHECKOUT_LIVE === 'true';
const IMPORT_DISCOUNT_LIVE = import.meta.env.VITE_PLUS_IMPORT_DISCOUNT_LIVE === 'true';
// LANDING-COPY-v2: the quiz bullet (plusB[1]) ships only once the separate quiz cap (Free 10 / Plus 200) exists in code.
const QUIZ_CAP_LIVE = import.meta.env.VITE_PLUS_QUIZ_CAP_LIVE === 'true';
// Lookup popover renders only from a real captured API response (src/data/lookup-capture.json). Never typed by hand.
type Captured = { lemma?: string; translation?: string; contextualMeaning?: string | null; partOfSpeech?: string | null };
const LK = lookup as unknown as { captured: boolean; word: string; sentence: string; byLang: Record<string, Captured | string | null> };
/** Real captured lookup for this page language (an alias string points at another language's capture), or null. */
function capturedFor(lang: string): Captured | null {
  if (!LK.captured) return null;
  let v = LK.byLang[lang] ?? null;
  if (typeof v === 'string') v = LK.byLang[v] ?? null;
  return typeof v === 'object' ? v : null;
}

const BASE = import.meta.env.BASE_URL;
const coverSrc = (id: string) => ({
  src: `${BASE}landing/covers/${id}.jpg`,
  srcSet: `${BASE}landing/covers/${id}-240.webp 240w, ${BASE}landing/covers/${id}-480.webp 480w`,
});
const ico = { check: <path d="M3.5 8.5 6.5 11.5 12.5 4.5" />, plus: <path d="M8 2v12M2 8h12" /> };
const Svg = ({ k, s = 16 }: { k: keyof typeof ico; s?: number }) => (
  <svg width={s} height={s} viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">{ico[k]}</svg>
);
const D_ICO = ['M2 4h12M2 8h8M2 12h10', 'M4 2h8v12l-4-3-4 3z', 'M4 2h5l3 3v9H4z', 'M3 8.5 6.5 12 13 4', 'M3 13V8M8 13V3M13 13V6'];
const LN: Record<LpLang, Record<string, string>> = { en: { en: 'English', tr: 'Turkish' }, uz: { en: 'Ingliz tili', tr: 'Turk tili' }, ru: { en: 'Английский', tr: 'Турецкий' } };
const FAN = [[-24, -250, 30], [-14, -160, 12], [-5, -70, 0], [5, 20, 0], [14, 110, 12], [24, 200, 30]];

// QA LP1-03: localised popover labels (UI chrome, not lookup output).
const POP: Record<LpLang, { hd: string; word: string; meaning: string; tr: string; close: string }> = {
  en: { hd: 'Dictionary', word: 'word', meaning: 'Natural meaning', tr: 'Translation', close: 'Close' },
  uz: { hd: 'Lugʻat', word: 'soʻz', meaning: 'Kontekstdagi maʼno', tr: 'Tarjima', close: 'Yopish' },
  ru: { hd: 'Словарь', word: 'слово', meaning: 'Значение в контексте', tr: 'Перевод', close: 'Закрыть' },
};

function Popover({ d, lang }: { d: Captured; lang: LpLang }) {
  const P = POP[lang];
  return (
    <div className="pop" id="pop1" lang={lang}>
      <div className="hd">{P.hd}<span role="img" aria-label={P.close}><svg width="14" height="14" viewBox="0 0 22 22" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" aria-hidden="true"><path d="M5 5l12 12M17 5 5 17" /></svg></span></div>
      <div className="bd">
        <div className="word"><b>{lookup.word}</b><span className="tag">{P.word}</span></div>
        {d.contextualMeaning && <div className="box m"><small>{P.meaning}</small>{d.contextualMeaning}</div>}
        {d.translation && <div className="box t"><small>{P.tr}</small>{d.translation}</div>}
      </div>
    </div>
  );
}

export default function LandingPage() {
  const { copyLocale, setLocale } = useWebLocale();
  const [params, setParams] = useSearchParams();
  const L = (['uz', 'ru', 'en'].includes(copyLocale) ? copyLocale : 'uz') as LpLang;
  const C = LANDING_COPY[L];
  const [tile, setTile] = useState(1);
  const [wide, setWide] = useState(() => typeof window !== 'undefined' && window.innerWidth >= 1024);
  const root = useRef<HTMLDivElement>(null);

  const ui = L;
  const startHref = registerUrl({ plan: 'free', from: 'landing', ui });
  const libHref = libraryUrl({ ui });



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

  const CAPTURED = capturedFor(L);
  const pc = plusCta(C, CHECKOUT_LIVE, ui);
  const plusB = [C.plusB[0], ...(QUIZ_CAP_LIVE ? [C.plusB[1]] : []), ...(IMPORT_DISCOUNT_LIVE ? [C.plusOpt] : []), C.plusB[2]].filter(Boolean);
  // SHOW_PLUS_ON_LANDING (landingCopy.ts, default true): false hides the Plus card, its nav item (LandingChrome) and FAQ Q5.
  const faqN = SHOW_PLUS_ON_LANDING ? C.faq_questions.length : C.faq_questions.length - 1;

  return (
    <div className="lp" data-theme="light" ref={root} lang={L}>
      <Seo title={`GOTCHA — ${C.h1}`} description={C.sub} lang={L} />
      <LandingHeader onLanding />

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
          {/* Render mirrors apps/web-learner ReaderPage.tsx. Text: Crime and Punishment (tr. Constance Garnett, public domain), live catalog id b8b9b407; sentence and lookup from QA's real capture (src/data/README.md). */}
          <div className="hero-visual" aria-hidden="true">
            <div className="reader">
              <div className="bar"><svg width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2"><path d="M10 3 5 8l5 5" /></svg><b>Crime and Punishment</b><span className="prog"><i /></span></div>
              <div className="page">
                <h3>Chapter IV</h3>
                <p className="body">He stood still in <span className="w-sel">hesitation</span> at the door, asking himself the strange question: ‘Must he tell her who killed Lizaveta?’</p>
              </div>
            </div>
            {CAPTURED && <Popover d={CAPTURED} lang={L} />}
          </div>
        </div></div></section>

        <section className="demo" id="features"><div className="wrap"><div className="grid">
          <div className="sec-head rv"><h2>{C.featT}</h2></div>
          <ol className="demo-list rv" id="demo" style={{ gridColumn: '1/-1' }}>
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
            {LANDING_BOOKS.map((b0) => { const b = bookFor(b0, L); return (
              <a className="cover" href={libHref} key={b.id}>
                <img {...coverSrc(b.id)} sizes="(min-width: 1024px) 180px, 45vw" alt={b.title} loading="lazy" width={800} height={1200} />
                <b>{b.title}</b><span>{b.author}</span><span>{LN[L][b.language] ?? b.language}</span>
              </a>
            ); })}
          </div>
          <div className="lib-foot rv"><strong style={{ color: 'var(--l-ink)' }}>{C.lt}</strong><p>{C.lb}</p></div>
        </div></div></section>

        {SHOW_PLUS_ON_LANDING && <section className="plus" id="plus"><div className="wrap"><div className="grid">
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
        </div></div></section>}

        <section id="faq"><div className="wrap"><div className="grid">
          <div className="faq-head rv"><h2>{C.faqT}</h2></div>
          <div className="faq-list rv" id="faqL">
            {C.faq_questions.slice(0, faqN).map((q, i) => <details key={q} open={i === 0}><summary>{q}<Svg k="plus" s={20} /></summary><p>{C.faq_answers[i]}</p></details>)}
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
                <img {...coverSrc(b.id)} sizes="(min-width: 1024px) 170px, 124px" alt="" loading="lazy" width={800} height={1200} />
              </div>
            ))}
          </div>
        </div></div></section>
      </main>

      <LandingFooter />
    </div>
  );
}
