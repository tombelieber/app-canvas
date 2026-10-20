import { startCaptureSession } from "./session.mjs";
import { startImportCanvas } from "./server.mjs";
import { validateImportOptions } from "./options.mjs";
export async function runImportCommand(positionals, values) {
  if (values.complete || values.check || values.verify) throw Error("URL imports have observed coverage; source --complete/--check/--verify do not apply");
  validateImportOptions(positionals[0], values);
  if (positionals.length !== 2) throw Error("Use app-canvas import <URL> --out <new-directory> or app-canvas open <directory>");
  if (values.port !== undefined && (!/^\d+$/.test(values.port) || Number(values.port) > 65535)) throw Error("Invalid port");
  let session, app;
  try {
    if (positionals[0] === "import") {
      if (!values.out) throw Error("import requires --out <new-private-directory>");
      session = await startCaptureSession({ url: positionals[1], directory: values.out, headless: !!values.headless, record: !values["no-record"], profile: values.profile });
    }
    app = await startImportCanvas({ directory: positionals[0] === "open" ? positionals[1] : values.out, session, port: values.port === undefined ? 6106 : Number(values.port) });
    console.log(`App Canvas import: ${app.address}`);
    if (session) { console.log("Use the capture browser to explore. Sign in normally if needed, then Capture State in App Canvas (Alt+Shift+C in the source page). Imported edits stay local."); session.ready.catch(() => {}); }
    let stopping = false;
    const stop = async () => { if (stopping) return; stopping = true; await app.close(); process.exit(0); };
    process.once("SIGINT", stop); process.once("SIGTERM", stop);
    return app;
  } catch (error) { await app?.close(); if (!app) await session?.close(); throw error; }
}
