// Reject ignored flags, especially a redaction flag applied after raw capture.
const flags = {
  "agent-import": ["out", "agent"],
  import: ["out", "port", "headless", "no-record", "profile"],
  open: ["port"],
  "capture-script": ["out", "redacted", "allow-text"],
  capture: ["input", "label", "action"],
  status: [],
  link: ["from", "to", "label"],
};
export function validateImportOptions(command, values) {
  const allowed = flags[command];
  if (!allowed) throw Error("Unknown import command");
  for (const key of Object.keys(values)) if (!allowed.includes(key)) throw Error(`Unsupported --${key} for ${command}; use capture-script for browser-side redaction`);
}
