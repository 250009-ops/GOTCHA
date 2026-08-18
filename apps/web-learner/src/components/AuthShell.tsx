import { useEffect, useState, type ReactNode } from 'react';

const API_BASE = (import.meta.env.VITE_API_URL ?? 'http://localhost:3000/api/v1').replace(/\/$/, '');

export const AUTH_FEATURES = [
  {
    title: 'Read real content',
    desc: 'Books, articles, and news in the languages you want to learn',
  },
  {
    title: 'Build vocabulary',
    desc: 'AI-powered word lookup with spaced repetition',
  },
  {
    title: 'Track your progress',
    desc: 'CEFR level tracking, streaks, and reading stats',
  },
  {
    title: 'Learn in context',
    desc: 'Words stick when you learn them from real sentences',
  },
] as const;

type AuthMarketing = {
  learnerCount: number;
  languageNames: string[];
  readerInitials: string[];
};

function formatLanguageList(names: string[]): string | null {
  const unique = names.map((n) => n.trim()).filter(Boolean);
  if (unique.length === 0) return null;
  if (unique.length === 1) return unique[0];
  if (unique.length === 2) return `${unique[0]} & ${unique[1]}`;
  return `${unique.slice(0, -1).join(', ')} & ${unique[unique.length - 1]}`;
}

function useAuthMarketing(): AuthMarketing {
  const [data, setData] = useState<AuthMarketing>({
    learnerCount: 0,
    languageNames: [],
    readerInitials: [],
  });

  useEffect(() => {
    let cancelled = false;
    fetch(`${API_BASE}/marketing/landing`)
      .then((res) => {
        if (!res.ok) throw new Error(`landing ${res.status}`);
        return res.json() as Promise<{
          stats?: { learnerCount?: number };
          languages?: Array<{ name?: string }>;
          topReaders?: Array<{ initials?: string }>;
        }>;
      })
      .then((payload) => {
        if (cancelled) return;
        const initials = (payload.topReaders ?? [])
          .map((r) => r.initials?.trim())
          .filter((v): v is string => Boolean(v))
          .slice(0, 4);
        setData({
          learnerCount: Number(payload.stats?.learnerCount) || 0,
          languageNames: (payload.languages ?? []).map((l) => l.name ?? '').filter(Boolean),
          readerInitials: initials,
        });
      })
      .catch(() => {
        /* Keep the panel honest: never fall back to Figma sample counts or names. */
      });
    return () => {
      cancelled = true;
    };
  }, []);

  return data;
}

export function AuthBrandMark({ light }: { light?: boolean }) {
  return (
    <div className="flex items-center gap-3">
      <div
        className="flex items-center justify-center bg-[#2107aa] rounded-[12px]"
        style={{ width: 40, height: 40 }}
      >
        <span
          className="text-white text-2xl leading-none"
          style={{ fontFamily: 'Bagel Fat One, cursive' }}
        >
          G
        </span>
      </div>
      <span
        className={`text-[20px] leading-7 tracking-[-0.5px] ${light ? 'text-white' : 'text-[#101828]'}`}
        style={{ fontFamily: 'Bagel Fat One, cursive' }}
      >
        GOTCHA
      </span>
    </div>
  );
}

function MarketingPanel() {
  const { learnerCount, languageNames, readerInitials } = useAuthMarketing();
  const languageLine = formatLanguageList(languageNames);

  return (
    <div className="hidden lg:flex flex-col w-[480px] shrink-0 relative overflow-hidden gap-6 px-10 pt-10 pb-8 bg-gradient-to-r from-[#7008e7] via-[#372aac] via-[55%] to-[#4d179a]">
      <div
        aria-hidden
        className="pointer-events-none absolute -left-[120px] -top-[120px] size-[320px] rounded-full bg-white/[0.05] blur-[40px]"
      />
      <div
        aria-hidden
        className="pointer-events-none absolute left-[260px] top-[420px] size-[260px] rounded-full bg-white/[0.05] blur-[40px]"
      />

      <div className="relative z-10">
        <AuthBrandMark light />
      </div>

      <div className="relative z-10 flex-1 flex flex-col gap-6">
        <div className="flex flex-col gap-3">
          <h1 className="text-[36px] leading-[44px] font-extrabold text-white">
            Read your way
            <br />
            <span className="font-bold">to fluency.</span>
          </h1>
          <p className="text-[16px] leading-6 text-[#ddd6ff]">
            The reading-first language app that makes every page a lesson.
          </p>
        </div>

        <div className="flex flex-col gap-3">
          {AUTH_FEATURES.map((f) => (
            <div
              key={f.title}
              className="flex items-center gap-3 rounded-[16px] border border-white/10 bg-white/[0.07] p-3.5"
            >
              <span className="block shrink-0 size-2.5 rounded-full bg-[#ff8904]" />
              <div className="flex-1 min-w-0">
                <div className="text-white font-bold text-sm leading-5">{f.title}</div>
                <div className="text-[#c4b4ff] text-[13px] leading-[18px]">
                  {f.title === 'Read real content' && languageLine
                    ? `Books, articles, news in ${languageLine}`
                    : f.desc}
                </div>
              </div>
            </div>
          ))}
        </div>

        <div className="flex-1" />

        {learnerCount > 0 && (
          <div className="flex flex-col gap-3">
            <div className="flex items-center justify-between whitespace-nowrap gap-3">
              <p className="text-white text-[13px] font-semibold">
                {learnerCount.toLocaleString('en-US')} learners
              </p>
              <p className="text-[#c4b4ff] text-xs">already reading on GOTCHA</p>
            </div>
            {readerInitials.length > 0 && (
              <div className="flex items-center">
                {readerInitials.map((initials, idx) => (
                  <div
                    key={`${initials}-${idx}`}
                    className={`flex items-center justify-center size-8 rounded-2xl border-2 border-white bg-gradient-to-r from-[#a684ff] to-[#4f39f6] text-white text-[10px] font-extrabold ${
                      idx > 0 ? '-ml-2' : ''
                    }`}
                  >
                    {initials}
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

/** Split marketing + form shell used by login, register, and verify-email. */
export function AuthShell({ children }: { children: ReactNode }) {
  return (
    <div className="min-h-screen flex flex-col lg:flex-row bg-[#f9fafb] overflow-x-hidden">
      <MarketingPanel />

      <div className="lg:hidden flex flex-col gap-3 px-5 sm:px-6 pt-6 pb-5 bg-gradient-to-r from-[#7008e7] via-[#372aac] via-[55%] to-[#4d179a]">
        <AuthBrandMark light />
        <p className="text-[#ddd6ff] text-sm leading-5">Read your way to fluency.</p>
      </div>

      <div className="relative z-10 flex-1 flex flex-col items-center justify-center p-4 sm:p-6 min-w-0 bg-[#f9fafb]">
        {children}
      </div>
    </div>
  );
}
