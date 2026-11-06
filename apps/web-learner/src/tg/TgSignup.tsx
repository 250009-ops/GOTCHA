import { useEffect, useRef, useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { Check, Eye, EyeOff, Loader2, Lock, Phone, UserRound } from 'lucide-react';
import { toast } from 'sonner';
import { api } from '../lib/api';
import { useAuth, type SessionResponse } from '../lib/auth';
import { useLearnerLocale } from '../lib/learnerLocaleContext';
import { useCatalogLanguages } from '../lib/catalogLanguages';
import { LanguageSearchInput } from '../components/LanguageSearchInput';
import { SignupSafetyFields } from '../components/safety/SignupSafetyFields';
import { CONSENT_VERSION } from '../components/safety/signupConsent';
import { CodeInput } from '../components/auth/TelegramAuth';
import { type AppLanguage } from '../lib/types';
import { getWebApp, haptic, markTelegramMode, setupWebApp, tgInitData, waitForWebApp } from '../lib/telegram';
import { tgCopyFor } from './tgCopy';

const inputCls =
  'w-full h-12 pl-11 pr-3.5 bg-white border border-[#dfe2ec] rounded-xl text-[15px] text-[#101828] placeholder:text-[#9aa0ae] focus-visible:outline-none focus-visible:border-[#2107AA] focus-visible:ring-4 focus-visible:ring-[#2107AA]/10';

export function TgStepper({ step, labels }: { step: 1 | 2; labels: [string, string] }) {
  return (
    <div className="flex items-center gap-2.5">
      <span className={`size-6 rounded-full grid place-items-center text-xs font-bold ${step === 2 ? 'bg-emerald-500 text-white' : 'bg-g-blue-700 text-white'}`}>
        {step === 2 ? <Check className="w-3.5 h-3.5" strokeWidth={3} /> : 1}
      </span>
      <span className={`text-[13px] font-semibold ${step === 1 ? 'text-[#101828]' : 'text-[#6b7080]'}`}>{labels[0]}</span>
      <span className={`flex-1 h-px ${step === 2 ? 'bg-emerald-300' : 'bg-[#e2e4ec]'}`} />
      <span className={`size-6 rounded-full grid place-items-center text-xs font-bold ${step === 2 ? 'bg-g-blue-700 text-white' : 'bg-[#eceef4] text-[#6b7080]'}`}>2</span>
      <span className={`text-[13px] font-semibold ${step === 2 ? 'text-[#101828]' : 'text-[#6b7080]'}`}>{labels[1]}</span>
    </div>
  );
}

/** `/tg/signup` — screens 02–03: name + Telegram phone + password, then languages and consents. */
export default function TgSignup() {
  const navigate = useNavigate();
  const location = useLocation();
  const seeded = (location.state as { fullName?: string; phone?: string | null } | null) ?? {};
  const { adoptSession, updateProfile } = useAuth();
  const { locale } = useLearnerLocale();
  const t = tgCopyFor(locale);
  const { langs } = useCatalogLanguages();

  const [step, setStep] = useState<1 | 2>(1);
  const [fullName, setFullName] = useState(seeded.fullName ?? '');
  const [phone, setPhone] = useState<string | null>(seeded.phone ?? null);
  const [waitingPhone, setWaitingPhone] = useState(false);
  const [password, setPassword] = useState('');
  const [showPw, setShowPw] = useState(false);
  const [nativeLanguage, setNativeLanguage] = useState<AppLanguage | null>(
    locale === 'uz' || locale === 'ru' || locale === 'en' ? (locale as AppLanguage) : null,
  );
  const [targetLanguages, setTargetLanguages] = useState<AppLanguage[]>([]);
  const [acceptTerms, setAcceptTerms] = useState(false);
  const [acceptAi, setAcceptAi] = useState(false);
  const [birthYear, setBirthYear] = useState<number | null>(null);
  const [busy, setBusy] = useState(false);
  const poll = useRef<number | null>(null);
  // Verification code the bot sends once the phone is shared (required by /auth/telegram/register).
  const [code, setCode] = useState('');
  const [codeError, setCodeError] = useState<string | null>(null);
  const [cooldown, setCooldown] = useState(0);
  const codeRequested = useRef(false);

  useEffect(() => {
    // Reload on this screen: make sure the SDK is ready and the name is prefilled.
    void waitForWebApp().then((w) => {
      if (!w?.initData) return;
      markTelegramMode();
      setupWebApp(w);
      if (!fullName) {
        const u = w.initDataUnsafe?.user;
        setFullName([u?.first_name, u?.last_name].filter(Boolean).join(' '));
      }
      if (!phone) void checkContact();
    });
    return () => {
      if (poll.current) window.clearInterval(poll.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (cooldown <= 0) return;
    const id = window.setTimeout(() => setCooldown((c) => c - 1), 1000);
    return () => window.clearTimeout(id);
  }, [cooldown]);

  const requestCode = async () => {
    const initData = tgInitData();
    if (!initData) return;
    setCodeError(null);
    try {
      const r = await api<{ sent: boolean; resendIn?: number }>('/auth/telegram/signup-code', {
        method: 'POST',
        body: JSON.stringify({ initData }),
      });
      setCooldown(r.resendIn ?? 60);
    } catch (err) {
      const e2 = err as Error & { status?: number; code?: string };
      if (e2.status === 429) setCooldown(60);
      else if (e2.status === 409) {
        toast.error(t.phoneTaken);
        navigate('/tg/login', { replace: true });
      } else toast.error(e2.message || t.sessionError);
    }
  };

  // As soon as the phone is known, ask the bot to send the code (once; "resend" handles the rest).
  useEffect(() => {
    if (phone && !codeRequested.current) {
      codeRequested.current = true;
      void requestCode();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phone]);

  useEffect(() => {
    if (nativeLanguage) setTargetLanguages((prev) => prev.filter((l) => l !== nativeLanguage));
  }, [nativeLanguage]);

  async function checkContact(): Promise<boolean> {
    const initData = tgInitData();
    if (!initData) return false;
    try {
      const r = await api<{ phone: string | null; verified: boolean }>(`/auth/telegram/contact?initData=${encodeURIComponent(initData)}`);
      if (r.verified && r.phone) {
        setPhone(r.phone);
        return true;
      }
    } catch {
      /* keep waiting */
    }
    return false;
  }

  const sharePhone = () => {
    const w = getWebApp();
    if (!w?.requestContact) {
      toast.error(t.updateTelegram);
      return;
    }
    setWaitingPhone(true);
    w.requestContact((shared) => {
      if (!shared) {
        setWaitingPhone(false);
        return;
      }
      // The phone is trusted only once the bot has received the contact (server-side check), so poll for it.
      const started = Date.now();
      if (poll.current) window.clearInterval(poll.current);
      poll.current = window.setInterval(async () => {
        const ok = await checkContact();
        if (ok || Date.now() - started > 60_000) {
          if (poll.current) window.clearInterval(poll.current);
          poll.current = null;
          setWaitingPhone(false);
          if (ok) haptic('success');
          else toast.error(t.phoneTimeout);
        }
      }, 1500);
    });
  };

  const goStep2 = (e: React.FormEvent) => {
    e.preventDefault();
    if (!phone) {
      toast.error(t.phoneNeeded);
      return;
    }
    if (code.length !== 6) {
      setCodeError(t.codeNeeded);
      return;
    }
    if (!fullName.trim() || password.length < 8) return;
    setStep(2);
    window.scrollTo({ top: 0 });
  };

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!nativeLanguage || targetLanguages.length === 0 || !acceptTerms || !acceptAi) return;
    setBusy(true);
    try {
      const res = await api<SessionResponse>('/auth/telegram/register', {
        method: 'POST',
        body: JSON.stringify({
          initData: tgInitData(),
          fullName: fullName.trim(),
          password,
          code,
          nativeLanguage,
          targetLanguages,
          acceptTerms,
          acceptAi,
          acceptAiConsent: acceptAi,
          consentVersion: CONSENT_VERSION,
          ...(birthYear != null ? { birthYear } : {}),
        }),
      });
      await adoptSession(res);
      try {
        await updateProfile({ uiLanguage: locale });
      } catch {
        /* non-blocking */
      }
      haptic('success');
      navigate('/app', { replace: true });
    } catch (err) {
      const e2 = err as Error & { status?: number };
      haptic('error');
      const errCode = (err as { code?: string }).code;
      if (errCode === 'telegram_code_invalid' || errCode === 'telegram_code_expired') {
        setCode('');
        setCodeError(errCode === 'telegram_code_expired' ? t.codeExpired : t.codeWrong);
        setStep(1);
        return;
      }
      if (e2.status === 409) {
        toast.error(t.phoneTaken);
        navigate('/tg/login', { replace: true });
        return;
      }
      toast.error(e2.message || t.sessionError);
    } finally {
      setBusy(false);
    }
  };

  const pwOk = password.length >= 8;
  const step1Ready = !!phone && code.length === 6 && !!fullName.trim() && pwOk;

  return (
    <div className="min-h-[100dvh] bg-[#f6f7fb] font-sans text-[#101828]">
      <div className="mx-auto max-w-[480px] px-[18px] pt-5 pb-8">
        <TgStepper step={step} labels={[t.step1, t.step2]} />

        {step === 1 ? (
          <form onSubmit={goStep2} className="mt-5 flex flex-col gap-[18px]">
            <div>
              <h1 className="text-[25px] leading-tight font-extrabold tracking-tight">{t.createTitle}</h1>
              <p className="mt-1.5 text-sm leading-relaxed text-[#6b7080]">{t.createSub}</p>
            </div>

            <div className="flex flex-col gap-1.5">
              <label htmlFor="tg-name" className="text-[13.5px] font-semibold text-[#4a5565]">{t.fullName}</label>
              <div className="relative">
                <UserRound className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 w-[18px] h-[18px] text-[#8a8fa0]" />
                <input id="tg-name" autoComplete="name" value={fullName} onChange={(e) => setFullName(e.target.value)} className={inputCls} />
              </div>
            </div>

            <div className="flex flex-col gap-1.5">
              <span className="text-[13.5px] font-semibold text-[#4a5565]">{t.phone}</span>
              {phone ? (
                <>
                  <div className="flex items-center gap-3 h-12 px-3.5 rounded-xl border border-[#b7e4cf] bg-[#f0fbf6]">
                    <Phone className="w-[18px] h-[18px] text-[#047857]" />
                    <span className="flex-1 text-[15px] font-semibold tabular-nums">{phone}</span>
                    <span className="flex items-center gap-1 text-xs font-bold text-[#047857]"><Check className="w-[15px] h-[15px]" strokeWidth={2.6} />{t.fromTelegram}</span>
                  </div>
                  <span className="text-xs text-[#6b7080]">{t.phoneNote}</span>
                  <div className="mt-2 flex flex-col gap-2">
                    <span className="text-[13.5px] font-semibold text-[#4a5565]">{t.codeLabel}</span>
                    <CodeInput value={code} onChange={(v) => { setCode(v); setCodeError(null); }} label={t.digit} invalid={!!codeError} />
                    {codeError ? (
                      <span role="alert" className="text-xs font-medium text-[#dc2626]">{codeError}</span>
                    ) : (
                      <span className="text-xs text-[#6b7080]">{t.codeSent}</span>
                    )}
                    <button
                      type="button"
                      disabled={cooldown > 0}
                      onClick={() => void requestCode()}
                      className="self-start min-h-9 text-[13px] font-semibold text-g-blue-700 disabled:text-[#9aa0ae]"
                    >
                      {cooldown > 0 ? t.codeResendIn(`${Math.floor(cooldown / 60)}:${String(cooldown % 60).padStart(2, '0')}`) : t.codeResend}
                    </button>
                  </div>
                </>
              ) : (
                <button
                  type="button"
                  onClick={sharePhone}
                  disabled={waitingPhone}
                  className="h-12 rounded-xl border border-[#cfe3f4] bg-[#f2f8fd] text-[#1d5f96] font-bold text-[15px] inline-flex items-center justify-center gap-2 disabled:opacity-70"
                >
                  {waitingPhone ? <Loader2 className="w-4 h-4 animate-spin" /> : <Phone className="w-[18px] h-[18px]" />}
                  {waitingPhone ? t.waitingPhone : t.sharePhone}
                </button>
              )}
            </div>

            <div className="flex flex-col gap-1.5">
              <label htmlFor="tg-password" className="text-[13.5px] font-semibold text-[#4a5565]">{t.password}</label>
              <div className="relative">
                <Lock className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 w-[18px] h-[18px] text-[#8a8fa0]" />
                <input
                  id="tg-password"
                  type={showPw ? 'text' : 'password'}
                  autoComplete="new-password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className={`${inputCls} !pr-12`}
                />
                <button type="button" onClick={() => setShowPw((s) => !s)} aria-label={showPw ? t.hidePw : t.showPw} className="absolute right-1 top-1/2 -translate-y-1/2 size-11 grid place-items-center text-[#8a8fa0]">
                  {showPw ? <EyeOff className="w-[18px] h-[18px]" /> : <Eye className="w-[18px] h-[18px]" />}
                </button>
              </div>
              <span className={`flex items-center gap-1.5 text-xs font-semibold ${pwOk ? 'text-[#047857]' : 'text-[#8a8fa0]'}`}>
                <Check className="w-3.5 h-3.5" strokeWidth={pwOk ? 2.6 : 2} />
                {t.pwRule}
              </span>
            </div>

            <button type="submit" disabled={!step1Ready} className="mt-2 h-[50px] rounded-xl bg-g-blue-700 hover:bg-g-blue-800 text-white font-bold text-[15.5px] disabled:opacity-50">
              {t.continue}
            </button>
            <p className="text-center text-sm">
              <span className="text-[#6b7080]">{t.haveAccount}</span>{' '}
              <Link to="/tg/login" className="font-bold text-g-blue-700">{t.signIn}</Link>
            </p>
          </form>
        ) : (
          <form onSubmit={submit} className="mt-5 flex flex-col gap-4">
            <div>
              <h1 className="text-[25px] leading-tight font-extrabold tracking-tight">{t.langTitle}</h1>
              <p className="mt-1.5 text-sm text-[#6b7080]">{t.langSub}</p>
            </div>
            <div className="flex flex-col gap-1.5">
              <label id="tg-native-label" className="text-[13.5px] font-semibold text-[#4a5565]">{t.nativeLang}</label>
              <LanguageSearchInput
                labelledBy="tg-native-label"
                options={langs}
                value={nativeLanguage ? [nativeLanguage] : []}
                onChange={(codes) => setNativeLanguage((codes[0] as AppLanguage) ?? null)}
                multiple={false}
                placeholder=""
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <label id="tg-target-label" className="text-[13.5px] font-semibold text-[#4a5565]">{t.targetLangs}</label>
              <LanguageSearchInput
                labelledBy="tg-target-label"
                options={langs}
                value={targetLanguages}
                onChange={(codes) => setTargetLanguages(codes as AppLanguage[])}
                exclude={nativeLanguage ? [nativeLanguage] : []}
                placeholder=""
              />
            </div>
            <SignupSafetyFields
              locale={locale}
              accepted={acceptTerms}
              onAccepted={setAcceptTerms}
              aiAccepted={acceptAi}
              onAiAccepted={setAcceptAi}
              birthYear={birthYear}
              onBirthYear={setBirthYear}
            />
            <div className="flex gap-3 pt-1">
              <button type="button" onClick={() => setStep(1)} className="h-[50px] px-5 rounded-xl border border-[#e1e3ec] bg-white font-bold text-sm">{t.back}</button>
              <button
                type="submit"
                disabled={busy || !nativeLanguage || targetLanguages.length === 0 || !acceptTerms || !acceptAi}
                className="flex-1 h-[50px] rounded-xl bg-g-blue-700 hover:bg-g-blue-800 text-white font-bold text-[15.5px] disabled:opacity-50 inline-flex items-center justify-center gap-2"
              >
                {busy && <Loader2 className="w-4 h-4 animate-spin" />}
                {busy ? t.creating : t.create}
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}
