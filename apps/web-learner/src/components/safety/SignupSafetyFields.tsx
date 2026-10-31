import { MARKETING_URL } from '../../lib/links';
import { CONSENT_LINK_PATHS } from '../../lib/legalLinks';
import { AGE_COPY, birthYearOptions, consentParts, toConsentLocale } from './signupConsent';

/** S3 consent tick-box (unticked by default) + W-12 optional birth year. */
export function SignupSafetyFields(props: {
  locale: string;
  accepted: boolean;
  onAccepted: (v: boolean) => void;
  birthYear: number | null;
  onBirthYear: (v: number | null) => void;
}) {
  const l = toConsentLocale(props.locale);
  const age = AGE_COPY[l];
  const hrefs = {
    terms: `${MARKETING_URL}${CONSENT_LINK_PATHS.terms}`,
    privacy: `${MARKETING_URL}${CONSENT_LINK_PATHS.privacy}`,
    oferta: `${MARKETING_URL}${CONSENT_LINK_PATHS.oferta}`,
  };
  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-col gap-2">
        <label htmlFor="signup-birth-year" className="text-xs font-semibold text-[#4a5565]">
          {age.label}
        </label>
        <select
          id="signup-birth-year"
          value={props.birthYear ?? ''}
          onChange={(e) => props.onBirthYear(e.target.value ? Number(e.target.value) : null)}
          className="h-11 rounded-[14px] border border-[#e5e7eb] bg-[#f9fafb] px-3 text-sm text-[#101828]"
        >
          <option value="">{age.preferNot}</option>
          {birthYearOptions().map((y) => (
            <option key={y} value={y}>
              {y}
            </option>
          ))}
        </select>
      </div>
      <label className="flex items-start gap-2.5 text-[12px] leading-[18px] text-[#4a5565]">
        <input
          type="checkbox"
          checked={props.accepted}
          onChange={(e) => props.onAccepted(e.target.checked)}
          className="mt-0.5 size-4 shrink-0 accent-[#7f22fe]"
          data-testid="signup-consent"
        />
        <span>
          {consentParts(l).map((p, i) =>
            p.link ? (
              <a
                key={i}
                href={hrefs[p.link]}
                target="_blank"
                rel="noopener noreferrer"
                className="font-semibold underline underline-offset-[3px]"
              >
                {p.text}
              </a>
            ) : (
              <span key={i}>{p.text}</span>
            ),
          )}
        </span>
      </label>
    </div>
  );
}
