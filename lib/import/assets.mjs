import { createHash } from "node:crypto";
import { limits } from "./schema.mjs";
export function inspectAsset(body) {
  if (!Buffer.isBuffer(body) || !body.length || body.length > limits.asset) throw Error("Asset exceeds supported size");
  const head = body.subarray(0, 16), ascii = head.toString("latin1");
  let mime;
  if (head.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]))) mime = "image/png";
  else if (head[0] === 255 && head[1] === 216 && head[2] === 255) mime = "image/jpeg";
  else if (/^GIF8[79]a/.test(ascii)) mime = "image/gif";
  else if (ascii.startsWith("RIFF") && ascii.slice(8, 12) === "WEBP") mime = "image/webp";
  else if (ascii.startsWith("wOF2")) mime = "font/woff2";
  else if (ascii.startsWith("wOFF")) mime = "font/woff";
  else if (ascii.startsWith("OTTO")) mime = "font/otf";
  else if (head.subarray(0, 4).equals(Buffer.from([0, 1, 0, 0]))) mime = "font/ttf";
  else throw Error("Unsupported asset bytes; use PNG, JPEG, GIF, WebP or a font");
  return { id: createHash("sha256").update(body).digest("hex"), mime, body };
}
