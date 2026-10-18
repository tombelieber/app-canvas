import React, { createContext, useContext, useEffect, useMemo, useState } from "react";
import { languages, languageNames } from "../lib/locales.mjs";
import { initialLocale, localeKey, translator } from "./i18n-core.mjs";
import en from "./locales/en.json";
import tw from "./locales/zh-TW.json";
import cn from "./locales/zh-CN.json";
import ja from "./locales/ja.json";
import es from "./locales/es.json";
import fr from "./locales/fr.json";
import de from "./locales/de.json";
import pt from "./locales/pt.json";
import it from "./locales/it.json";
import ko from "./locales/ko.json";
import nl from "./locales/nl.json";
import aliases from "./locales/legacy.json";
const messages = { en, "zh-TW": tw, "zh-CN": cn, ja, es, fr, de, pt, it, ko, nl };
const I18n = createContext({ locale: "en", t: translator(messages, "en", aliases), setLocale() {} });
export function I18nProvider({ children }) {
  const [locale, setLocale] = useState(() => { try { return initialLocale(localStorage, location.search); } catch { return "en"; } });
  useEffect(() => { document.documentElement.lang = locale; try { localStorage.setItem(localeKey, locale); } catch {} }, [locale]);
  const value = useMemo(() => ({ locale, t: translator(messages, locale, aliases), setLocale: next => { if (languages.includes(next)) { setLocale(next); const url = new URL(location.href); if (url.searchParams.has("lang")) { url.searchParams.set("lang", next); history.replaceState(null, "", url); } } } }), [locale]);
  return <I18n.Provider value={value}>{children}</I18n.Provider>;
}
export const useI18n = () => useContext(I18n);
export function LanguagePicker() {
  const { locale, t, setLocale } = useI18n();
  return <select className="language-picker" aria-label={t("Language")} value={locale} onChange={e => setLocale(e.target.value)}>{languages.map(code => <option key={code} value={code}>{languageNames[code]}</option>)}</select>;
}
