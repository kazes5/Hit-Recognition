import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { dictionaries, translate, type Lang, type MessageKey } from './dictionaries';
import { formatNode, type NodeParams } from './formatNode';

export const LANG_STORAGE_KEY = 'hitster.lang';
export const DEFAULT_LANG: Lang = 'en';

export function directionOf(lang: Lang): 'rtl' | 'ltr' {
  return lang === 'he' ? 'rtl' : 'ltr';
}

export function loadLang(): Lang {
  try {
    const v = localStorage.getItem(LANG_STORAGE_KEY);
    return v === 'he' || v === 'en' ? v : DEFAULT_LANG;
  } catch {
    return DEFAULT_LANG;
  }
}

/** Sets `<html lang dir>` for the given language. */
export function applyDocumentLang(lang: Lang, doc: Document = document): void {
  doc.documentElement.lang = lang;
  doc.documentElement.dir = directionOf(lang);
}

export type TFunction = (key: MessageKey, params?: Record<string, string | number>) => string;
/** Like `t`, but string params (names) are wrapped in `<bdi>` and "+1"/"−1" in `dir="ltr"`. */
export type TNodeFunction = (key: MessageKey, params?: NodeParams) => ReactNode;

interface I18nValue {
  lang: Lang;
  dir: 'rtl' | 'ltr';
  setLang: (lang: Lang) => void;
  t: TFunction;
  tNode: TNodeFunction;
}

const I18nContext = createContext<I18nValue | null>(null);

export function I18nProvider({ children, initialLang }: { children: ReactNode; initialLang?: Lang }) {
  const [lang, setLangState] = useState<Lang>(() => initialLang ?? loadLang());

  useEffect(() => {
    applyDocumentLang(lang);
  }, [lang]);

  const setLang = useCallback((next: Lang) => {
    setLangState(next);
    applyDocumentLang(next);
    try {
      localStorage.setItem(LANG_STORAGE_KEY, next);
    } catch {
      /* ignore */
    }
  }, []);

  const value = useMemo<I18nValue>(
    () => ({
      lang,
      dir: directionOf(lang),
      setLang,
      t: (key, params) => translate(lang, key, params),
      tNode: (key, params) => formatNode(dictionaries[lang][key], params),
    }),
    [lang, setLang],
  );

  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>;
}

export function useI18n(): I18nValue {
  const ctx = useContext(I18nContext);
  if (!ctx) throw new Error('useI18n must be used inside <I18nProvider>');
  return ctx;
}
