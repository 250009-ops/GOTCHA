import type { UiLanguage } from '@gotcha/shared';
import { useLearnerLocale } from '../lib/learnerLocaleContext';
import { UiLanguageDropdown } from './UiLanguageDropdown';

interface LanguagePickerProps {
  className?: string;
  compact?: boolean;
  variant?: 'default' | 'light';
}

export function LanguagePicker({ className, compact = false, variant = 'default' }: LanguagePickerProps) {
  const { locale, copy, setLocale } = useLearnerLocale();

  return (
    <UiLanguageDropdown
      value={locale}
      onChange={(code) => setLocale(code as UiLanguage)}
      ariaLabel={copy.shell.language}
      className={className}
      variant={variant}
      compact={compact}
    />
  );
}
