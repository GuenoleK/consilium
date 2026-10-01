import { en, type Translations } from "./locales/en";
import { fr } from "./locales/fr";

export const locales = { en, fr } satisfies Record<string, Translations>;
export type Locale = keyof typeof locales;
export const DEFAULT_LOCALE: Locale = "en";
/** Each language is named in itself, so it stays recognisable whatever the current UI language. */
export const localeNames: Record<Locale, string> = { en: "English", fr: "Français" };
export type LanguagePreference = Locale | "auto";

// A leaf is a string; a node holding an `other` entry is a plural resolved from `params.count`.
type KeyPaths<Node, Prefix extends string = ""> = {
  [Key in keyof Node & string]: Node[Key] extends string ? `${Prefix}${Key}`
    : Node[Key] extends { other: string } ? `${Prefix}${Key}`
    : KeyPaths<Node[Key], `${Prefix}${Key}.`>;
}[keyof Node & string];

export type TranslationKey = KeyPaths<Translations>;
export type TranslationParams = Record<string, string | number>;
export type Translate = (key: TranslationKey, params?: TranslationParams) => string;

export const isLocale = (value: string): value is Locale => Object.hasOwn(locales, value);

/** First supported language of the browser preference list, English when none matches. */
export function detectLocale(languages: readonly string[] = navigator.languages?.length ? navigator.languages : [navigator.language]): Locale {
  for (const language of languages) {
    const base = language.toLowerCase().split("-")[0];
    if (isLocale(base)) return base;
  }
  return DEFAULT_LOCALE;
}

const resolve = (messages: Translations, key: string) =>
  key.split(".").reduce<unknown>((node, part) => typeof node === "object" && node !== null ? (node as Record<string, unknown>)[part] : undefined, messages);

export function createTranslator(locale: Locale): Translate {
  const pluralRules = new Intl.PluralRules(locale);
  return (key, params) => {
    let message = resolve(locales[locale], key) ?? resolve(en, key);
    if (typeof message === "object" && message !== null) {
      const forms = message as Record<string, string>;
      message = forms[pluralRules.select(Number(params?.count))] ?? forms.other;
    }
    if (typeof message !== "string") return key;
    if (!params) return message;
    return message.replace(/\{(\w+)\}/g, (placeholder, name: string) => name in params ? String(params[name]) : placeholder);
  };
}
