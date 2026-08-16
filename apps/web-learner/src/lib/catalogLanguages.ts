import { useEffect, useState } from 'react';
import { api } from './api';
import { setEnabledChatLangs } from './chatLang';
import { LANGUAGE_META, LIVE_LANGUAGES, type AppLanguage, type CatalogLanguage } from './types';

export function fallbackCatalogLanguages(): CatalogLanguage[] {
  return LIVE_LANGUAGES.map((code) => ({
    code,
    name: LANGUAGE_META[code].label,
    nativeName: LANGUAGE_META[code].nativeName,
    flagEmoji: LANGUAGE_META[code].flag,
    isEnabled: true,
  }));
}

export function useCatalogLanguages() {
  const [langs, setLangs] = useState<CatalogLanguage[]>(fallbackCatalogLanguages);

  useEffect(() => {
    api<CatalogLanguage[]>('/content/languages')
      .then((rows) => {
        if (rows?.length) {
          const enabled = rows.filter((l) => l.isEnabled !== false);
          setLangs(enabled);
          setEnabledChatLangs(enabled.map((l) => l.code));
        }
      })
      .catch(console.error);
  }, []);

  const codes = langs.map((l) => l.code as AppLanguage);
  return { langs, codes };
}
