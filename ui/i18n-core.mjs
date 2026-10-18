import { languages } from "../lib/locales.mjs";
export const localeKey = "app-canvas:locale";
export function initialLocale(storage, search = "") {
  const requested = new URLSearchParams(search).get("lang");
  if (languages.includes(requested)) return requested;
  try { const saved = storage?.getItem(localeKey); if (languages.includes(saved)) return saved; } catch {}
  return "en";
}
export function translator(messages, locale, aliases = {}) {
  return (key, ...values) => {
    const canonical = aliases[key] || key;
    const text = messages[locale]?.[canonical] ?? messages.en[canonical] ?? key;
    return text.replace(/\{(\d+)\}/g, (match, i) => values[i] === undefined ? match : String(values[i]));
  };
}
export function validateMessages(messages) {
  const expected = Object.keys(messages.en).sort();
  const slots = text => (text.match(/\{\d+\}/g) || []).sort().join();
  for (const locale of languages) {
    const copy = messages[locale];
    if (!copy || JSON.stringify(Object.keys(copy).sort()) !== JSON.stringify(expected)) throw new Error(`${locale}: translation keys differ`);
    for (const key of expected) if (typeof copy[key] !== "string" || !copy[key].trim() || slots(key) !== slots(copy[key])) throw new Error(`${locale}: invalid translation for ${key}`);
  }
  return true;
}
