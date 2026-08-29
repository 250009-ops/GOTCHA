import { LANGUAGE_META, type UiLanguage } from '@gotcha/shared';
import { useLearnerLocale } from '../lib/learnerLocaleContext';
import { cn } from './ui/utils';

interface LanguagePickerProps {
  className?: string;
  compact?: boolean;
}

export function LanguagePicker({ className, compact = false }: LanguagePickerProps) {
  const { locale, copy, setLocale, localeOptions } = useLearnerLocale();

  return (
    <label className={cn('inline-flex items-center gap-1.5', className)}>
      <span className="sr-only">{copy.shell.language}</span>
      <select
        value={locale}
        onChange={(e) => setLocale(e.target.value as UiLanguage)}
        aria-label={copy.shell.language}
        className={cn(
          'min-w-0 truncate rounded-lg border border-gray-200 bg-white font-semibold text-[#4a5565] outline-none focus:border-[#7f22fe] focus:ring-2 focus:ring-[#7f22fe]/15 touch-manipulation',
          compact ? 'h-8 max-w-[7.75rem] px-1.5 text-[11px] sm:max-w-[8.5rem] sm:px-2' : 'h-9 max-w-[9.5rem] px-2.5 text-xs',
        )}
      >
        {localeOptions.map((opt) => (
          <option key={opt.code} value={opt.code}>
            {LANGUAGE_META[opt.code].flag} {opt.nativeName}
          </option>
        ))}
      </select>
    </label>
  );
}
