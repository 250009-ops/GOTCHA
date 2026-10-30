import { useId } from 'react';
import type { UiLanguage } from '@gotcha/shared';

/** Inline SVG flags — emoji fall back to "GB"/"RU" text on Windows. */
export function UiLanguageFlag({
  lang,
  className = '',
}: {
  lang: UiLanguage;
  className?: string;
}) {
  const clipId = useId().replace(/:/g, '');
  const base = `inline-block shrink-0 overflow-hidden rounded-[3px] shadow-[0_0_0_1px_rgba(0,0,0,0.08)] ${className}`;

  if (lang === 'en') {
    return (
      <svg className={base} width={20} height={14} viewBox="0 0 60 42" aria-hidden>
        <clipPath id={clipId}>
          <rect width={60} height={42} rx={3} />
        </clipPath>
        <g clipPath={`url(#${clipId})`}>
          <rect width={60} height={42} fill="#012169" />
          <path d="M0 0l60 42M60 0L0 42" stroke="#fff" strokeWidth={7} />
          <path d="M0 0l60 42M60 0L0 42" stroke="#C8102E" strokeWidth={4} />
          <path d="M30 0v42M0 21h60" stroke="#fff" strokeWidth={11} />
          <path d="M30 0v42M0 21h60" stroke="#C8102E" strokeWidth={6.5} />
        </g>
      </svg>
    );
  }

  if (lang === 'ru') {
    return (
      <svg className={base} width={20} height={14} viewBox="0 0 60 42" aria-hidden>
        <rect width={60} height={42} rx={3} fill="#fff" />
        <rect y={14} width={60} height={14} fill="#0039A6" />
        <rect y={28} width={60} height={14} fill="#D52B1E" />
      </svg>
    );
  }

  return (
    <svg className={base} width={20} height={14} viewBox="0 0 60 42" aria-hidden>
      <rect width={60} height={42} rx={3} fill="#1EB53A" />
      <rect y={14} width={60} height={14} fill="#fff" />
      <rect width={60} height={14} rx={3} fill="#0099B5" />
      <rect y={13} width={60} height={2} fill="#CE1126" />
      <rect y={27} width={60} height={2} fill="#CE1126" />
      <circle cx={11} cy={21} r={5.5} fill="#fff" />
      <circle cx={12.5} cy={21} r={4.2} fill="#0099B5" />
      <circle cx={14.5} cy={21} r={1.1} fill="#fff" />
    </svg>
  );
}
