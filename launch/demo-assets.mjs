/** Actual example locales are distinct from the eleven viewer/marketing locales. */
export const demoAssets = Object.freeze({
  en: Object.freeze({ locale: "en", directory: "en" }),
  "zh-TW": Object.freeze({ locale: "zh-TW", directory: "zh-TW" }),
});

const shots = Object.freeze({
  overview: Object.freeze({ filename: "overview.jpg", width: 1440, height: 1000 }),
  reference: Object.freeze({ filename: "reference-desktop.png", width: 1440, height: 1000 }),
  referencePhone: Object.freeze({ filename: "reference-phone.png", width: 390, height: 844 }),
  flow: Object.freeze({ filename: "flow.jpg", width: 1440, height: 1000 }),
  playback: Object.freeze({ filename: "playback.jpg", width: 1440, height: 1000 }),
});

const demoLinks = Object.freeze({
  en: ["en", "Demo in English"],
  "zh-TW": ["zh-TW", "示範語言：繁體中文"],
  "zh-CN": ["zh-TW", "演示语言：繁体中文"],
  ja: ["en", "デモは英語です"],
  es: ["en", "Demo en inglés"],
  fr: ["en", "Démo en anglais"],
  de: ["en", "Demo auf Englisch"],
  pt: ["en", "Demonstração em inglês"],
  it: ["en", "Demo in inglese"],
  ko: ["en", "데모 언어: 영어"],
  nl: ["en", "Demo in het Engels"],
});

export function demoLocaleForLocale(locale) {
  if (!Object.hasOwn(demoLinks, locale)) throw new Error(`Unknown marketing locale: ${locale}`);
  return demoLinks[locale][0];
}

export function demoLanguageBadge(locale) {
  demoLocaleForLocale(locale);
  return demoLinks[locale][1];
}

/** No screenshot fallback: translated copy must not relabel another locale's pixels. */
export function demoAssetForLocale(locale, kind) {
  demoLocaleForLocale(locale);
  if (!Object.hasOwn(shots, kind)) throw new Error(`Unknown demo screenshot: ${kind}`);
  if (!Object.hasOwn(demoAssets, locale)) return null;
  const shot = shots[kind];
  return {
    ...shot,
    locale,
    source: `docs/screenshots/${locale}/${shot.filename}`,
    asset: `screenshots/${locale}/${shot.filename}`,
  };
}

export function demoAssetCopies() {
  return Object.keys(demoAssets).flatMap(locale => Object.keys(shots).map(kind => demoAssetForLocale(locale, kind)));
}
