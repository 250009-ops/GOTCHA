import { useEffect, useRef, useState } from 'react';
import uzFlag from '../assets/flags/uz.svg';
import gbFlag from '../assets/flags/gb.svg';
import ruFlag from '../assets/flags/ru.svg';

export type LpLang = 'uz' | 'en' | 'ru';
/** Rev 4 (FLAGS.md): order UZ / ENG / RU; full name in aria-label/title; flags are decorative. */
export const LP_LANGS: { code: LpLang; name: string; short: string; flag: string; pos?: string }[] = [
  { code: 'uz', name: 'Oʻzbekcha', short: 'UZ', flag: uzFlag, pos: 'left' },
  { code: 'en', name: 'English', short: 'ENG', flag: gbFlag },
  { code: 'ru', name: 'Русский', short: 'RU', flag: ruFlag },
];

function Flag({ src, pos }: { src: string; pos?: string }) {
  return (
    <span className="flag" aria-hidden="true">
      <img src={src} alt="" width={20} height={14} style={pos ? { objectPosition: pos } : undefined} />
    </span>
  );
}

const Check = () => (
  <svg width="18" height="18" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M3.5 8.5 6.5 11.5 12.5 4.5" /></svg>
);

export function LandingLangSwitch({ value, onChange }: { value: LpLang; onChange: (c: LpLang) => void }) {
  const [open, setOpen] = useState(false);
  const [act, setAct] = useState(0);
  const wrap = useRef<HTMLDivElement>(null);
  const btn = useRef<HTMLButtonElement>(null);
  const menu = useRef<HTMLUListElement>(null);
  const cur = LP_LANGS.find((l) => l.code === value) ?? LP_LANGS[0];
  const curIdx = LP_LANGS.indexOf(cur);

  const doOpen = (i = curIdx) => { setAct(i); setOpen(true); };
  const doClose = (focus = true) => { setOpen(false); if (focus) btn.current?.focus(); };
  const pick = (i: number) => { doClose(); const c = LP_LANGS[i].code; if (c !== value) onChange(c); };

  useEffect(() => { if (open) menu.current?.focus(); }, [open]);
  useEffect(() => {
    if (!open) return;
    const onDoc = (e: MouseEvent) => { if (!wrap.current?.contains(e.target as Node)) setOpen(false); };
    document.addEventListener('mousedown', onDoc);
    return () => document.removeEventListener('mousedown', onDoc);
  }, [open]);

  const n = LP_LANGS.length;
  return (
    <div className="ls" ref={wrap}>
      <button ref={btn} className="ls-btn" type="button" aria-haspopup="listbox" aria-expanded={open} aria-controls="lsMenu"
        aria-label={`Language: ${cur.name}`} title={cur.name}
        onClick={() => (open ? doClose() : doOpen())}
        onKeyDown={(e) => { if (['ArrowDown', 'ArrowUp', 'Enter', ' '].includes(e.key)) { e.preventDefault(); doOpen(e.key === 'ArrowUp' ? n - 1 : curIdx); } }}>
        <span id="lsCur"><Flag src={cur.flag} pos={cur.pos} /><span className="code">{cur.short}</span></span>
        <svg className="chev" width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true"><path d="m4 6 4 4 4-4" /></svg>
      </button>
      <ul ref={menu} className="ls-menu" id="lsMenu" role="listbox" tabIndex={-1} aria-label="Language" hidden={!open}
        aria-activedescendant={open ? `ls-${LP_LANGS[act].code}` : undefined}
        onKeyDown={(e) => {
          const k = e.key;
          if (k === 'ArrowDown') { e.preventDefault(); setAct((act + 1) % n); }
          else if (k === 'ArrowUp') { e.preventDefault(); setAct((act + n - 1) % n); }
          else if (k === 'Home') { e.preventDefault(); setAct(0); }
          else if (k === 'End') { e.preventDefault(); setAct(n - 1); }
          else if (k === 'Enter' || k === ' ') { e.preventDefault(); pick(act); }
          else if (k === 'Escape') { e.preventDefault(); doClose(); }
          else if (k === 'Tab') doClose(false);
        }}>
        {LP_LANGS.map((l, i) => (
          <li key={l.code} id={`ls-${l.code}`} role="option" lang={l.code} aria-label={l.name} title={l.name}
            aria-selected={l.code === value} className={open && i === act ? 'act' : undefined}
            onClick={() => pick(i)} onMouseMove={() => setAct(i)}>
            <Flag src={l.flag} pos={l.pos} /><span className="code">{l.short}</span><span className="ck">{l.code === value ? <Check /> : null}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}
