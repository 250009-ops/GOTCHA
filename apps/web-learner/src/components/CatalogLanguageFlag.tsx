import { useId } from 'react';
import { cn } from './ui/utils';

function FlagFrame({ children, className }: { children: React.ReactNode; className?: string }) {
  const clipId = useId().replace(/:/g, '');
  return (
    <svg className={cn('inline-block shrink-0 overflow-hidden rounded-[3px] shadow-[0_0_0_1px_rgba(0,0,0,0.08)]', className)} width={20} height={14} viewBox="0 0 60 42" aria-hidden>
      <clipPath id={clipId}>
        <rect width={60} height={42} rx={3} />
      </clipPath>
      <g clipPath={`url(#${clipId})`}>{children}</g>
    </svg>
  );
}

function IsoFallback({ code, className }: { code: string; className?: string }) {
  const label = code.slice(0, 2).toUpperCase();
  return (
    <span
      className={cn(
        'inline-flex h-[14px] min-w-[20px] items-center justify-center rounded-[3px] bg-[#eef2ff] px-0.5 text-[8px] font-bold leading-none text-[#4338ca] shadow-[0_0_0_1px_rgba(0,0,0,0.08)]',
        className,
      )}
      aria-hidden
    >
      {label}
    </span>
  );
}

/** SVG catalog flags — emoji render as "GB"/"DE" text on Windows. */
export function CatalogLanguageFlag({ code, className }: { code: string; className?: string }) {
  const lang = code.trim().toLowerCase();

  if (lang === 'en') {
    return (
      <FlagFrame className={className}>
        <rect width={60} height={42} fill="#012169" />
        <path d="M0 0l60 42M60 0L0 42" stroke="#fff" strokeWidth={7} />
        <path d="M0 0l60 42M60 0L0 42" stroke="#C8102E" strokeWidth={4} />
        <path d="M30 0v42M0 21h60" stroke="#fff" strokeWidth={11} />
        <path d="M30 0v42M0 21h60" stroke="#C8102E" strokeWidth={6.5} />
      </FlagFrame>
    );
  }

  if (lang === 'ru') {
    return (
      <FlagFrame className={className}>
        <rect width={60} height={42} fill="#fff" />
        <rect y={14} width={60} height={14} fill="#0039A6" />
        <rect y={28} width={60} height={14} fill="#D52B1E" />
      </FlagFrame>
    );
  }

  if (lang === 'uz') {
    return (
      <FlagFrame className={className}>
        <rect width={60} height={42} fill="#1EB53A" />
        <rect y={14} width={60} height={14} fill="#fff" />
        <rect width={60} height={14} fill="#0099B5" />
        <rect y={13} width={60} height={2} fill="#CE1126" />
        <rect y={27} width={60} height={2} fill="#CE1126" />
        <circle cx={11} cy={21} r={5.5} fill="#fff" />
        <circle cx={12.5} cy={21} r={4.2} fill="#0099B5" />
        <circle cx={14.5} cy={21} r={1.1} fill="#fff" />
      </FlagFrame>
    );
  }

  if (lang === 'de') {
    return (
      <FlagFrame className={className}>
        <rect width={60} height={14} fill="#000" />
        <rect y={14} width={60} height={14} fill="#DD0000" />
        <rect y={28} width={60} height={14} fill="#FFCE00" />
      </FlagFrame>
    );
  }

  if (lang === 'ko') {
    return (
      <FlagFrame className={className}>
        <rect width={60} height={42} fill="#fff" />
        <circle cx={30} cy={21} r={9} fill="#C60C30" />
        <path d="M30 12a9 9 0 019 9 9 9 0 01-9 9" fill="#003478" />
        <circle cx={30} cy={21} r={3.5} fill="#fff" />
      </FlagFrame>
    );
  }

  if (lang === 'ar') {
    return (
      <FlagFrame className={className}>
        <rect width={60} height={42} fill="#006C35" />
        <path d="M8 21h44" stroke="#fff" strokeWidth={3} />
        <path d="M48 21l-6-4v8z" fill="#fff" />
      </FlagFrame>
    );
  }

  if (lang === 'tr') {
    return (
      <FlagFrame className={className}>
        <rect width={60} height={42} fill="#E30A17" />
        <circle cx={24} cy={21} r={8} fill="#fff" />
        <circle cx={26.5} cy={21} r={6.5} fill="#E30A17" />
        <path d="M34 21a5 5 0 105 0 3.5 3.5 0 00-5 0z" fill="#fff" />
      </FlagFrame>
    );
  }

  if (lang === 'fr') {
    return (
      <FlagFrame className={className}>
        <rect width={20} height={42} fill="#002395" />
        <rect x={20} width={20} height={42} fill="#fff" />
        <rect x={40} width={20} height={42} fill="#ED2939" />
      </FlagFrame>
    );
  }

  if (lang === 'es') {
    return (
      <FlagFrame className={className}>
        <rect width={60} height={10} fill="#AA151B" />
        <rect y={10} width={60} height={22} fill="#F1BF00" />
        <rect y={32} width={60} height={10} fill="#AA151B" />
      </FlagFrame>
    );
  }

  if (lang === 'ja') {
    return (
      <FlagFrame className={className}>
        <rect width={60} height={42} fill="#fff" />
        <circle cx={30} cy={21} r={9} fill="#BC002D" />
      </FlagFrame>
    );
  }

  if (lang === 'pt') {
    return (
      <FlagFrame className={className}>
        <rect width={60} height={42} fill="#006600" />
        <path d="M0 0 L36 21 L0 42 Z" fill="#FF0000" />
        <circle cx={14} cy={21} r={5} fill="#FFDF00" />
      </FlagFrame>
    );
  }

  if (lang === 'zh') {
    return (
      <FlagFrame className={className}>
        <rect width={60} height={42} fill="#DE2910" />
        <polygon points="12,8 14,14 20,14 15,18 17,24 12,20 7,24 9,18 4,14 10,14" fill="#FFDE00" />
      </FlagFrame>
    );
  }

  if (lang === 'it') {
    return (
      <FlagFrame className={className}>
        <rect width={20} height={42} fill="#009246" />
        <rect x={20} width={20} height={42} fill="#fff" />
        <rect x={40} width={20} height={42} fill="#CE2B37" />
      </FlagFrame>
    );
  }

  if (lang === 'pl') {
    return (
      <FlagFrame className={className}>
        <rect width={60} height={21} fill="#fff" />
        <rect y={21} width={60} height={21} fill="#DC143C" />
      </FlagFrame>
    );
  }

  if (lang === 'uk') {
    return (
      <FlagFrame className={className}>
        <rect width={60} height={21} fill="#005BBB" />
        <rect y={21} width={60} height={21} fill="#FFD500" />
      </FlagFrame>
    );
  }

  if (lang === 'hi') {
    return (
      <FlagFrame className={className}>
        <rect width={60} height={14} fill="#FF9933" />
        <rect y={14} width={60} height={14} fill="#fff" />
        <rect y={28} width={60} height={14} fill="#138808" />
        <circle cx={30} cy={21} r={4} stroke="#000080" strokeWidth={1} fill="none" />
      </FlagFrame>
    );
  }

  if (lang === 'nl') {
    return (
      <FlagFrame className={className}>
        <rect width={60} height={14} fill="#AE1C28" />
        <rect y={14} width={60} height={14} fill="#fff" />
        <rect y={28} width={60} height={14} fill="#21468B" />
      </FlagFrame>
    );
  }

  return <IsoFallback code={lang} className={className} />;
}
