import { mkdir, readFile, copyFile, writeFile, cp } from "node:fs/promises";
import { join } from "node:path";

// The already public, frozen frontend has a synthetic in-memory API. This
// adapter relocates only its assets; it never exports the private source repo.
export async function exportStoolSense({ publicDir, outDir, catalog }) {
  const frame = join(outDir, "frame");
  await mkdir(frame);
  let code = await readFile(join(publicDir, "frame.js"), "utf8");
  const images = /(?:src|href)="\/api\/images\/\$\{[^}]+\}"/g;
  if ((code.match(images) || []).length !== 2 || !code.includes('"/sample.png"') || !code.includes('href="/diet-template.csv"'))
    throw Error("Frozen frontend changed; review its static asset mapping before publication");
  code = code.replace(images, (attribute) => `${attribute.startsWith("src") ? "src" : "href"}="./sample.png"`)
    .replaceAll('"/sample.png"', '"./sample.png"')
    .replaceAll('href="/diet-template.csv"', 'href="./diet-template.csv"');
  await writeFile(join(frame, "frame.js"), code);
  const policy = `<meta name="referrer" content="no-referrer"><meta http-equiv="Content-Security-Policy" content="default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data: blob:; media-src 'self' blob:; connect-src 'self'; object-src 'none'; base-uri 'none'; form-action 'none'">`;
  const html = (await readFile(join(publicDir, "index.html"), "utf8"))
    .replace('<meta charset="utf-8">', `<meta charset="utf-8">${policy}`)
    .replace('href="/style.css"', 'href="./style.css"')
    .replace('src="/assets/frame.js"', 'src="./frame.js"');
  await writeFile(join(frame, "index.html"), html);
  for (const name of ["style.css", "sample.png", "diet-template.csv", "invalid-meals.csv"])
    await copyFile(join(publicDir, name), join(frame, name));
  await cp(join(publicDir, "../notices"), join(frame, "notices"), { recursive: true });
  return Object.fromEntries(catalog.map((s) => [s.id, `./frame/index.html?id=${encodeURIComponent(s.id)}`]));
}
