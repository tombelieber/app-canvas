import { open, writeFile } from "node:fs/promises";
import { constants } from "node:fs";
import { resolve } from "node:path";
import { captureScript, createAgentProject, ingestSnapshot, importStatus, linkStates, listProjects, recoverProject, backupProject } from "./agent.mjs";
import { validateImportOptions } from "./options.mjs";
import { limits } from "./schema.mjs";

async function readJson(path, max = limits.state * 2) {
  const handle = await open(resolve(path), constants.O_RDONLY | constants.O_NOFOLLOW);
  try { const stat = await handle.stat(); if (!stat.isFile() || stat.size > max) throw Error("Input file exceeds transport budget"); return JSON.parse(await handle.readFile("utf8")); } finally { await handle.close(); }
}
export async function runAgentCommand(positionals, values) {
  const [command, target] = positionals;
  if (values.complete || values.check || values.verify || values["ui-complete"]) throw Error("URL imports have observed coverage; source completion gates do not apply");
  validateImportOptions(command === "import" ? "agent-import" : command, values);
  if (command === "projects") {
    if (positionals.length !== 1) throw Error("Use app-canvas projects");
    return listProjects();
  }
  if (command === "capture-script") {
    if (positionals.length !== 1 || !values.out) throw Error("Use capture-script --out <new-reader.js> [--redacted --allow-text <labels.json>]");
    const allowText = values["allow-text"] ? await readJson(values["allow-text"], 1024 * 1024) : [];
    await writeFile(resolve(values.out), captureScript({ redacted: !!values.redacted, allowText }) + "\n", { flag: "wx", mode: 0o600 });
    return { script: resolve(values.out), redacted: !!values.redacted };
  }
  if (positionals.length !== 2) throw Error("This command requires one URL or project directory");
  if (command === "recover") return recoverProject(target, { directory: values.out, allowEphemeral: !!values["allow-ephemeral"] });
  if (command === "backup") return backupProject(target, { directory: values.out, allowEphemeral: !!values["allow-ephemeral"] });
  if (command === "import") {
    return createAgentProject({ url: target, directory: values.out, allowEphemeral: !!values["allow-ephemeral"] });
  }
  if (command === "capture") {
    if (!values.input) throw Error("capture requires --input <private-snapshot.json>");
    return ingestSnapshot({ directory: target, snapshot: await readJson(values.input), label: values.label, action: values.action });
  }
  if (command === "status") return importStatus(target);
  if (command === "link") {
    if (!values.from || !values.to || !values.label) throw Error("link requires --from <state-id> --to <state-id> --label <label>");
    return linkStates({ directory: target, from: values.from, to: values.to, label: values.label });
  }
  throw Error("Unknown agent import command");
}
