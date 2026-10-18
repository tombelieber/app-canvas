export function redactText(value) {
  return String(value).replace(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi, "[email]")
    .replace(/\b(?:sk-|gh[pousr]_|github_pat_)[A-Za-z0-9_-]{16,}/g, "[credential]")
    .replace(/\bBearer\s+[A-Za-z0-9._-]{16,}/gi, "[credential]")
    .replace(/(^|\s)@[A-Za-z0-9_.-]{2,}/g, "$1[account]");
}
export function sourceUrl(value) {
  const url = new URL(value);
  if (!["https:", "http:"].includes(url.protocol) || url.username || url.password) throw Error("Capture requires an HTTP(S) URL without credentials");
  url.search = ""; url.hash = "";
  url.pathname = url.pathname.replace(/\b(?:[a-f0-9]{20,}|[a-f0-9]{8}-[a-f0-9-]{27,})\b/gi, "_id");
  return url.href;
}
export function privateSurface(url) { return /\/(?:auth|login|sign[-_]?in|sign[-_]?up|register|oauth|api[-_]?keys?|access[-_]?tokens?|credentials|password|secrets?)(?:\/|$|[?#])/i.test(new URL(url).pathname); }
