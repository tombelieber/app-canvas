// Explicit adapter capability. Never infer native captures from Web app DOM.
export const NATIVE_ATLAS_BYTES = 32 * 1024 * 1024;
export function validateNativeOverview(value, catalog, origin) {
  if (value === undefined) return undefined;
  const fail = () => { throw Error("Invalid native overview atlas"); };
  if (!value || typeof value.url !== "string") fail();
  let url;
  try { url = new URL(value.url, origin); } catch { fail(); }
  if (url.origin !== origin || url.username || url.password || url.hash) fail();
  const digest = text => typeof text === "string" && /^[a-f0-9]{64}$/.test(text);
  const integer = n => Number.isInteger(n) && n > 0;
  if (!digest(value.sha256) || !integer(value.width) || !integer(value.height) ||
      value.width > 4096 || value.height > 4096 || value.width * value.height * 4 > NATIVE_ATLAS_BYTES ||
      !Array.isArray(value.cases) || !value.cases.length || value.cases.length > catalog.length) fail();
  const ids = new Set(catalog.map(c => c.id)), seen = new Set();
  const cases = value.cases.map(c => {
    if (!c || !ids.has(c.id) || seen.has(c.id) || !digest(c.sourceSha256) ||
        !Number.isInteger(c.x) || c.x < 0 || !Number.isInteger(c.y) || c.y < 0 ||
        !integer(c.width) || !integer(c.height) || c.x + c.width > value.width || c.y + c.height > value.height) fail();
    seen.add(c.id);
    return { id: c.id, x: c.x, y: c.y, width: c.width, height: c.height, sourceSha256: c.sourceSha256 };
  });
  return { url: url.href, sha256: value.sha256, width: value.width, height: value.height, cases };
}
