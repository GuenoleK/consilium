import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { createTranslator, detectLocale, isLocale, type LanguagePreference, type Locale, type Translate } from "./translate";

const STORAGE_KEY = "consilium-language";

interface I18nContextValue {
  locale: Locale;
  /** What the user chose; "auto" follows the browser languages. */
  preference: LanguagePreference;
  setPreference: (preference: LanguagePreference) => void;
  t: Translate;
}

const I18nContext = createContext<I18nContextValue | undefined>(undefined);

const readPreference = (): LanguagePreference => {
  try {
    const stored = window.localStorage.getItem(STORAGE_KEY);
    return stored && isLocale(stored) ? stored : "auto";
  } catch {
    return "auto";
  }
};

const persistPreference = (preference: LanguagePreference) => {
  try {
    if (preference === "auto") window.localStorage.removeItem(STORAGE_KEY);
    else window.localStorage.setItem(STORAGE_KEY, preference);
  } catch { /* The choice still applies for this session when storage is disabled. */ }
};

export function I18nProvider({ children }: { children: ReactNode }) {
  const [browserLocale, setBrowserLocale] = useState(() => detectLocale());
  const [preference, setPreferenceState] = useState(readPreference);
  const locale = preference === "auto" ? browserLocale : preference;
  const setPreference = useCallback((next: LanguagePreference) => {
    setPreferenceState(next);
    persistPreference(next);
  }, []);
  const value = useMemo<I18nContextValue>(
    () => ({ locale, preference, setPreference, t: createTranslator(locale) }),
    [locale, preference, setPreference],
  );

  useEffect(() => {
    const update = () => setBrowserLocale(detectLocale());
    window.addEventListener("languagechange", update);
    return () => window.removeEventListener("languagechange", update);
  }, []);

  useEffect(() => {
    document.documentElement.lang = value.locale;
    document.title = value.t("app.title");
  }, [value]);

  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>;
}

export function useTranslation() {
  const context = useContext(I18nContext);
  if (!context) throw new Error("useTranslation must be used inside <I18nProvider>.");
  return context;
}
