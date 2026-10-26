import { mkdir, readFile, copyFile, writeFile, cp } from "node:fs/promises";
import { join } from "node:path";

// The already public, frozen frontend has a synthetic in-memory API. This
// adapter relocates only its assets; it never exports the private source repo.
export function relocateStoolSenseAssets(code, locale = "zh-TW") {
  if (!["en", "zh-TW"].includes(locale)) throw Error("Unsupported StoolSense demo locale");
  const images = /(?:src|href)="\/api\/images\/\$\{[^}]+\}"/g;
  // The reviewed English compiler emits this HTML as a JSON-quoted JS string;
  // the original frozen bundle uses an unescaped template. Their cooked href
  // is identical. Keep both representations explicit rather than relaxing the
  // publication guard to arbitrary absolute paths or quote patterns.
  const quote = locale === "en" ? '\\"' : '"';
  const csv = `href=${quote}/diet-template.csv${quote}`;
  const sample = '"/sample.png"';
  const count = value => code.split(value).length - 1;
  if ((code.match(images) || []).length !== 2 || count(sample) !== 1 || count(csv) !== 1)
    throw Error("Frozen frontend changed; review its static asset mapping before publication");
  const relocated = code.replace(images, attribute => `${attribute.startsWith("src") ? "src" : "href"}="./sample.png"`)
    .replace(sample, '"./sample.png"')
    .replace(csv, `href=${quote}./diet-template.csv${quote}`);
  if (images.test(relocated) || relocated.includes(sample) || relocated.includes(csv)) throw Error("Unrelocated frozen frontend assets");
  return relocated;
}

export async function exportStoolSense({ publicDir, outDir, catalog, locale = "zh-TW" }) {
  if (!["en", "zh-TW"].includes(locale)) throw Error("Unsupported StoolSense demo locale");
  const localized = locale === "en" ? join(publicDir, "en") : publicDir;
  const frame = join(outDir, "frame");
  await mkdir(frame);
  const code = relocateStoolSenseAssets(await readFile(join(localized, "frame.js"), "utf8"), locale);
  await writeFile(join(frame, "frame.js"), code);
  const policy = `<meta name="referrer" content="no-referrer"><meta http-equiv="Content-Security-Policy" content="default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data: blob:; media-src 'self' blob:; connect-src 'self'; object-src 'none'; base-uri 'none'; form-action 'none'">`;
  const html = (await readFile(join(localized, "index.html"), "utf8"))
    .replace('<meta charset="utf-8">', `<meta charset="utf-8">${policy}`)
    .replace('href="/style.css"', 'href="./style.css"')
    .replace('src="/assets/frame.js"', 'src="./frame.js"');
  await writeFile(join(frame, "index.html"), html);
  for (const name of ["style.css", "sample.png", "diet-template.csv", "invalid-meals.csv"])
    await copyFile(join(name.endsWith(".csv") ? localized : publicDir, name), join(frame, name));
  await cp(join(publicDir, "../notices"), join(frame, "notices"), { recursive: true });
  return Object.fromEntries(catalog.map((s) => [s.id, `./frame/index.html?id=${encodeURIComponent(s.id)}`]));
}
