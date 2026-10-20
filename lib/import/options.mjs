// Reject ignored flags, especially a redaction flag applied after raw capture.
const flags = {
  "agent-import": ["out", "agent", "allow-ephemeral"],
  import: ["out", "port", "headless", "no-record", "profile", "allow-ephemeral"],
  open: ["port"],
  projects: [],
  recover: ["out", "allow-ephemeral"],
  backup: ["out", "allow-ephemeral"],
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
