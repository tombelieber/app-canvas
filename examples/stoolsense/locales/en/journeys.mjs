import baseline from "./journeys.json" with { type: "json" };

const click = (selector, text) => ({ type: "click", selector, ...(text ? { text } : {}) });
const expect = (selector, text) => ({ type: "expect", selector, ...(text ? { text } : {}) });
const fill = (selector, value) => ({ type: "fill", selector, value });
const select = (selector, value) => ({ type: "select", selector, value });
const check = (selector, value = true) => ({ type: "check", selector, value });
const file = (selector, asset = "./sample.png", name = "synthetic-preview.png", mime = "image/png") => ({ type: "file", selector, asset, name, mime, replaces: selector === "#diet-file" ? "#map-form" : "#save-form" });
const step = (screen, title, ...actions) => ({ screen, title, actions });
const flow = (id, title, entry, ...steps) => ({ id, title, kind: "flow", entry, steps });
const csv = () => file("#diet-file", "./diet-template.csv", "synthetic-meals.csv", "text/csv");
const fault = (path, method, error, status = 503) => ({ type: "fault", path, method, error, status, count: 1 });
const summary = text => click("summary", text);

// Literal UI expectations keep a newly added catalog case red until its actual
// view and entry condition have been reviewed. No fallback "body exists" check.
const checks = {
  "capture-home": [expect("#manual"), expect("#pending .empty")],
  "history-home": [expect("#history-list [data-event]")],
  "insights-home": [expect("#insights .readings"), expect("#filter")],
  "import-home": [expect("#meal-list [data-meal]"), expect("#diet-file")],
  "data-home": [expect("#profile-form"), expect("#json-export")],
  "capture-manual": [expect("#save-form"), expect("#capture-title", "Manual entry")],
  "capture-photo": [expect(".capture-preview img"), expect("#retake"), expect("#save-form")],
  "capture-observations": [expect("details[open] [name=notes]"), expect("[name=notes]", undefined)],
  "capture-care": [expect("details[open] [name=care_bleeding]"), expect("[data-care-preview]")],
  "capture-time": [expect("details[open] [name=occurred_at]")],
  "capture-pending": [expect("[data-resume]"), expect("#manual")],
  "capture-saving": [expect(".save-capture[disabled]"), expect("#sync-state")],
  "capture-offline": [expect("#message", "offline"), expect("#sync-state", "Local copy retained"), expect("#save-form")],
  "capture-preview-error": [expect("#preview-error:not([hidden])", "original file is retained")],
  "history-empty": [expect("#history-list .empty", "No records for this period")],
  "history-pagination": [expect("#next:not([disabled])"), expect("#history-list [data-event='event-49']")],
  "result-manual": [expect(".lead", "Manual entry saved"), expect("#doctor-summary")],
  "result-photo": [expect(".lead", "The original photo has been saved. No analysis result is available"), expect("#reanalyze")],
  "result-partial": [expect(".lead", "original photo has not finished syncing")],
  "result-running": [expect(".lead", "AI analysis is in progress")],
  "result-failed": [expect(".lead", "Analysis is incomplete"), expect("#reanalyze")],
  "result-unknown": [expect(".lead", "remain Unknown")],
  "result-appearance": [expect(".lead", "Available appearance suggestions")],
  "result-photo-open": [expect("details.photo[open] img"), expect("details.photo a[download]")],
  "result-edit": [expect("details[open] #edit-event"), expect("#edit-event [name=profile_id]")],
  "result-versions": [expect("#view details[open]", "User corrections: 1;"), expect("#view details[open]", "analysis versions: 2.")],
  "result-delete": [expect("dialog[open] [data-confirm]"), expect("[data-confirm-text]", "Delete")],
  "visit-summary": [expect("h1", "StoolSense Consultation Record Summary"), expect("table")],
  "care-insufficient": [expect(".care-guidance", "Not enough information")],
  "care-record": [expect(".care-guidance", "Keep a record")],
  "care-contact": [expect(".care-guidance", "Contact a doctor")],
  "care-urgent": [expect(".care-guidance", "promptly")],
  "care-emergency": [expect(".care-guidance", "Get help now")],
  "care-other": [expect(".care-guidance", "adult")],
  "insights-empty": [expect("#insights .empty"), expect("#insights", "Not enough")],
  "insights-candidate": [expect(".pattern details[open] [data-event]"), expect(".pattern", "4/5")],
  "insights-confounded": [expect(".pattern", "cannot be distinguished")],
  "insights-intervals": [expect("#insights details[open]", "Event intervals")],
  "import-empty": [expect("#meal-list .empty", "No dietary records")],
  "import-mapping": [expect("#map-form"), expect("#map-form [name=time]")],
  "import-xlsx": [select("#sheet", "1"), { type: "expect", selector: "#sheet", value: "1" }, expect("#map-form")],
  "import-ready": [expect("#commit-import:not([disabled])"), expect("#import-preview", "2 rows ready to import")],
  "import-duplicate": [expect("#commit-import[disabled]"), expect("#import-preview", "2 duplicate rows")],
  "import-invalid": [expect("#commit-import[disabled]"), expect("#import-preview .error")],
  "import-committed": [expect("#message.notice", "Imported 2 rows"), expect("#meal-list .row:nth-child(4)")],
  "meal-delete": [expect("dialog[open] [data-confirm]"), expect("[data-confirm-text]", "food")],
  "data-originals": [expect("[data-original]"), expect("#zip-export:not([disabled])")],
  "data-no-originals": [expect("#zip-export[disabled]"), expect("#originals", "No original photos have finished syncing")],
  "data-delete": [expect("[data-delete-event]"), expect("#delete-selected")],
  "data-confirm-delete": [expect("dialog[open] [data-confirm]"), expect("[data-confirm-text]", "selected entries: 1?")],
  "data-profile-created": [expect("#profile", "New Profile (fictional)"), expect("#message.notice", "New profile created")],
  "data-export-complete": [expect("#message.notice", "Export complete. Original records are retained")],
  "component-symptoms": [expect("[name=pain][value='3']"), expect("[name=straining][value='3']"), check("[name=pain][value='2']"), { type: "expect", selector: "[name=pain][value='2']", checked: true }],
  "component-observations": [select("[name=bristol]", "7"), { type: "expect", selector: "[name=bristol]", value: "7" }, expect("[name=notes]")],
  "component-appearance": [expect("#view", "Simulated eligible data"), expect("#view", "Bristol 7")],
  "auth-checking": [expect("#locked:not([hidden]) #lock-message", "Verifying")],
  "auth-expired": [expect("#locked:not([hidden]) #lock-message", "sign in")],
  "auth-denied": [expect("#locked:not([hidden]) #lock-message", "sign in")],
};

export function createJourneys(catalog) {
  const journeys = baseline.map(j => ({ ...structuredClone(j), kind: "flow" }));
  // Each destination must have an explicit DOM assertion.
  journeys[1].steps[0].actions.push(expect("#save-form"));
  journeys[2].steps[0].actions[0].replaces = "#save-form";
  journeys.push(
    flow("main-navigation", "Five main pages → Back to records", "capture-home",
      ...["history", "insights", "import", "data"].flatMap(page => [step(`${page}-home`, `Open ${page} Home`, click(`[data-tab=${page}]`), expect(page === "data" ? "#profile-form" : page === "history" ? "#history-list" : page === "insights" ? "#insights .readings" : "#meal-list")), step("capture-home", "Back to record", click("[data-tab=capture]"), expect("#manual"))])),
    flow("photo-draft", "Choose photo → Add details → Sync later → Continue saving", "capture-home",
      step("capture-photo", "Choose photo", file("#file"), expect("#retake")),
      step("capture-observations", "Enter appearance and notes", summary("Appearance, other"), select("[name=bristol]", "4"), fill("[name=notes]", "Fictional journey note"), expect("details[open] [name=notes]")),
      step("capture-time", "Check event time", summary("Time and profile"), expect("details[open] [name=occurred_at]")),
      step("capture-pending", "Keep draft and sync later", click("#leave-draft"), expect("[data-resume]")),
      step("capture-photo", "Continue the same draft", click("[data-resume]"), expect("#retake")),
      step("result-photo", "Save original photo only", check("[name=analyze]", false), click(".save-capture"), expect(".lead", "The original photo has been saved. No analysis result is available"))),
    flow("photo-replace", "Photo preview unavailable → Replace photo → Save", "capture-preview-error",
      step("capture-photo", "Replace with a previewable fictional image", file("#retake"), expect(".capture-preview img")),
      step("result-photo", "Original photo saved successfully", check("[name=analyze]", false), click(".save-capture"), expect("#doctor-summary"))),
    flow("result-edit", "View original photo → Correct → Version history", "result-photo",
      step("result-photo-open", "Expand original photo", summary("View original photo"), expect("details.photo[open] img")),
      step("result-edit", "Open correction form", summary("Edit symptoms"), expect("#edit-event [name=occurred_at]")),
      step("result-versions", "Save corrections and view record", check("#edit-event [name=pain][value='2']"), click("#edit-event button.primary"), expect("#message.notice", "Correction saved"), summary("Analysis and correction history"), expect("#view details[open]", "User corrections: 1;"))),
    flow("event-delete", "Delete record → Cancel → Confirm deletion", "result-manual",
      step("result-delete", "Show confirmation first", click("#delete-event"), expect("dialog[open] [data-confirm]")),
      step("result-manual", "Cancel and retain record", click("[data-cancel]"), expect("#delete-event")),
      step("history-home", "Confirm deletion and return to history", click("#delete-event"), click("[data-confirm]"), expect("#history-list [data-event]"))),
    flow("history-paging", "Next history page → Previous page → Open record", "history-pagination",
      step("history-pagination", "Next page retains older events", click("#next"), expect("[data-event='event-52']")),
      step("history-home", "Return to first page", click("#previous"), expect("[data-event='event-0']")),
      step("result-photo", "Open photo record", click("[data-event='event-0']"), expect("#doctor-summary"))),
    flow("history-empty", "No records yet → Add manual entry", "history-empty", step("capture-home", "Start recording", click("[data-tab=capture]"), expect("#manual")), step("capture-manual", "Open manual entry", click("#manual"), expect("#save-form"))),
    flow("import-csv", "CSV → Columns → Preview → Save → Import again", "import-home",
      step("import-mapping", "Choose fictional CSV", csv(), expect("#map-form")),
      step("import-ready", "Confirm columns and preview", click("#map-form button"), expect("#commit-import:not([disabled])")),
      step("import-committed", "Save food records", click("#commit-import"), expect("#message.notice", "Imported 1 row")),
      step("import-duplicate", "Import the same source again; prevent duplicates", csv(), expect("#map-form"), click("#map-form button"), expect("#import-preview", "1 duplicate row"), expect("#commit-import[disabled]"))),
    flow("import-correction", "CSV date error → Correct source → Save", "import-home",
      step("import-invalid", "Cannot submit an unconfirmed date", file("#diet-file", "./invalid-meals.csv", "synthetic-invalid.csv", "text/csv"), expect("#map-form"), click("#map-form button"), expect("#commit-import[disabled]"), expect("#import-preview .error")),
      step("import-ready", "Switch to a source with valid dates", csv(), expect("#map-form"), click("#map-form button"), expect("#commit-import:not([disabled])")),
      step("import-committed", "Save corrected data", click("#commit-import"), expect("#message.notice", "Imported 1 row"))),
    flow("import-xlsx", "Excel → Choose worksheet → Preview → Save", "import-xlsx",
      step("import-mapping", "Select the second worksheet", select("#sheet", "1"), expect("#map-form")),
      step("import-ready", "Preview worksheet content", click("#map-form button"), expect("#import-preview", "Chicken rice (fictional)")),
      step("import-committed", "Save Excel diet entries", click("#commit-import"), expect("#message.notice", "Imported 1 row"))),
    flow("meal-delete", "Delete food record → Cancel → Confirm", "import-home",
      step("meal-delete", "Show deletion confirmation", click("[data-meal='meal-1']"), expect("dialog[open] [data-confirm]")),
      step("import-home", "Cancel and retain the original record", click("[data-cancel]"), expect("[data-meal='meal-1']")),
      step("import-home", "Remove the specified records after confirmation", click("[data-meal='meal-1']"), click("[data-confirm]"), expect("[data-meal='meal-2']"), { type: "expect", selector: "#meal-list", text: "Chicken and rice" })),
    flow("profile-create", "Add Profile → Switch record subject", "data-home",
      step("data-profile-created", "Add fictional Profile", fill("#profile-form input", "Journey Profile (fictional)"), click("#profile-form button"), expect("#message.notice", "New profile created")),
      step("data-home", "Switch to family profile", select("#profile", "demo-family"), expect("#profile-form"), { type: "expect", selector: "#profile", value: "demo-family" })),
    flow("profile-conflict", "Duplicate Profile name → Rename succeeds", "data-home",
      step("error-conflict", "Duplicate name rejected", fill("#profile-form input", "Me"), click("#profile-form button"), expect("#message.error", "already exists")),
      step("data-profile-created", "Rename, then create", fill("#profile-form input", "New name (fictional)"), click("#profile-form button"), expect("#message.notice", "New profile created"))),
    flow("original-export", "Select original photos → Full ZIP export", "data-home",
      step("data-originals", "List original photos available to export", click("#choose-originals"), expect("[data-original]")),
      step("data-export-complete", "ZIP containing selected original photos", check("[data-original]"), click("#zip-export"), expect("#message.notice", "Export complete. Original records are retained"))),
    flow("data-delete", "Select deletion scope → Cancel → Confirm deletion", "data-home",
      step("data-delete", "Select one fictional record", click("#choose-delete"), expect("[data-delete-event]"), check("[data-delete-event]")),
      step("data-confirm-delete", "Show deletion scope", click("#delete-selected"), expect("[data-confirm-text]", "selected entries: 1?")),
      step("data-delete", "Cancel deletion", click("[data-cancel]"), expect("#delete-selected")),
      step("data-home", "Confirm deletion of specified records", click("#delete-selected"), click("[data-confirm]"), expect("#message.notice", "Entries deleted: 1."), expect("#profile-form"))),
    flow("insights-evidence", "Candidate pattern → Supporting records → Return to history", "insights-candidate",
      step("result-photo", "Open supporting event", click(".pattern [data-event]"), expect("#doctor-summary")),
      step("history-home", "Return to history", click("#back"), expect("#history-list [data-event]"))),
    flow("analysis-existing", "Failed analysis record → Analyze again → Keep previous versions", "result-failed",
      step("result-unknown", "Retry synthetic analysis", click("#reanalyze"), expect(".lead", "remain Unknown")),
      step("result-versions", "Verify both versions are retained", summary("Analysis and correction history"), expect("#view details[open]", "analysis versions: 2."))),
  );
  // Real controls exercise rejection/retry through the same disposable API.
  for (const code of ["invalid_care_answers", "service_unavailable"]) {
    const s = catalog.find(s=>s.error === code);
    journeys.push(flow(`save-error-${code}`, `${s.title} → Keep draft → Retry`, "capture-manual",
      step(s.id, "One synthetic API rejection", fault("/api/records", "POST", code), click(".save-capture"), expect("#message.error", s.title), expect("#save-form")),
      step("result-manual", "Submit the same draft again", click(".save-capture"), expect("#doctor-summary"), expect(".lead", "Manual entry saved"))));
  }
  for (const code of ["invalid_image", "storage_capacity", "too_large", "integrity_failed", "upload_incomplete"]) {
    const s = catalog.find(s=>s.error === code), endpoint = ["integrity_failed", "upload_incomplete"].includes(code) ? "/api/images/:id/complete" : "/api/images";
    journeys.push(flow(`upload-error-${code}`, `${s.title} → Original photo retained → Retry`, "capture-photo",
      step(s.id, "Original photo upload rejected; retain local draft", check("[name=analyze]", false), fault(endpoint, "POST", code), click(".save-capture"), expect("#message.error", s.title), expect("#save-form")),
      step("result-photo", "Retry the same original photo", click(".save-capture"), expect(".lead", "The original photo has been saved. No analysis result is available"))));
  }
  journeys.push(flow("event-deleted", "Event deleted → Show rejection and local copy", "capture-manual", step("error-event_deleted", "Deleted events are not automatically recreated", fault("/api/records", "POST", "event_deleted", 410), click(".save-capture"), expect("#message.error", "will not be recreated"), expect("#sync-state", "Local copy retained"))));
  for (const code of ["analysis_limit_or_running", "analysis_unavailable", "provider_unavailable"]) {
    const s = catalog.find(s=>s.error === code);
    journeys.push(flow(`analysis-error-${code}`, `${s.title} → Record retained → Retry`, "result-photo",
      step(s.id, "Analysis rejection does not delete the record", fault("/api/records/:id/analyze", "POST", code), click("#reanalyze"), expect("#message.error", s.title), expect("#doctor-summary")),
      step("result-unknown", "Synthetic analysis recovery", click("#reanalyze"), expect(".lead", "remain Unknown"))));
  }
  journeys.push(flow("revision-conflict", "Correction conflict → Reopen record → Save correction", "result-edit",
    step("error-revision_conflict", "Reject outdated version", fault("/api/records/:id", "PATCH", "revision_conflict", 409), click("#edit-event button.primary"), expect("#message.error", "changed in another view")),
    step("result-edit", "Reopen the latest version before editing", click("#refresh"), expect("#doctor-summary"), summary("Edit symptoms"), check("#edit-event [name=pain][value='2']"), click("#edit-event button.primary"), expect("#message.notice", "Correction saved"))));

  const careBase = { scope: "adult", bleeding: "none", severePain: "0", dehydration: "0", warningSigns: "0", diarrheaDays: "0", looseStools24h: "0", changeDays: "0", higherRisk: "0", weightLoss: "0" };
  for (const [kind, answers, observations, expected] of [
    ["insufficient", {}, {}, "Not enough information"],
    ["record", careBase, { color: "brown", diarrhea: "0", blood: "0" }, "Keep a record and watch for changes"],
    ["contact", { ...careBase, bleeding: "small" }, { color: "brown", diarrhea: "0", blood: "1" }, "Contact a doctor for follow-up"],
    ["urgent", { ...careBase, diarrheaDays: "3" }, { color: "brown", diarrhea: "1", blood: "0" }, "Seek medical advice promptly"],
    ["emergency", { ...careBase, bleeding: "heavy" }, { color: "brown", diarrhea: "0", blood: "1" }, "Get help now"],
    ["other", { scope: "other" }, {}, "Not enough information"],
  ]) {
    const answerActions = Object.entries(answers).map(([key,value]) => ["diarrheaDays", "looseStools24h", "changeDays"].includes(key) ? fill(`[name=care_${key}]`, value) : select(`[name=care_${key}]`, value));
    journeys.push(flow(`care-${kind}`, `Add care guidance details → ${catalog.find(s=>s.id===`care-${kind}`).title}`, "capture-manual",
      step("capture-care", "Enter fictional answers and view live guidance", summary("Appearance, other"), summary("Care guidance"), ...Object.entries(observations).map(([key,value])=>select(`[name=${key}]`,value)), ...answerActions, expect("[data-care-preview]", expected)),
      step(`care-${kind}`, "The result card retains the same guidance after saving", click(".save-capture"), expect(".care-guidance", expected), expect("#doctor-summary"))));
  }
  for (const code of ["ambiguous_date", "invalid_import_rows"]) {
    const preview = code === "ambiguous_date";
    journeys.push(flow(`import-error-${code}`, `${catalog.find(s=>s.error===code).title} → Retry import`, "import-mapping",
      step(`error-${code}`, "Show rejection without losing field entries", ...(!preview ? [click("#map-form button"), expect("#commit-import:not([disabled])")] : []), fault(preview ? "/api/import/preview" : "/api/import/commit", "POST", code, 422), click(preview ? "#map-form button" : "#commit-import"), expect("#message.error", catalog.find(s=>s.error===code).title)),
      step("import-committed", "Correct the source condition and retry", ...(preview ? [click("#map-form button"), expect("#commit-import:not([disabled])")] : []), click("#commit-import"), expect("#message.notice", "Imported 2 rows"))));
  }
  journeys.push(
    flow("export-range", "Export range too large → Narrow dates → Choose original photos", "data-home",
      step("error-narrow_export_range", "Prompt to shorten the export range", fault("/api/export", "GET", "narrow_export_range", 413), click("#choose-originals"), expect("#message.error", "Shorten the export date range")),
      step("data-originals", "Use a smaller date range", fill("#from", "2026-10-16"), fill("#to", "2026-10-16"), click("#choose-originals"), expect("#zip-export"))),
    flow("meal-range", "Food date range error → Reload", "capture-home",
      step("error-narrow_date_range", "Synthetic read rejection", fault("/api/meals", "GET", "narrow_date_range", 413), click("[data-tab=import]"), expect("#message.error", "shorten the date range")),
      step("import-home", "Reload diet records", click("[data-tab=import]"), expect("#meal-list [data-meal]"))),
    flow("session-expired", "Session expires while saving → Sign-in entry point", "capture-manual",
      step("auth-expired", "Lock private views when the identity expires", fault("/api/records", "POST", "sign_in_required", 401), click(".save-capture"), expect("#locked:not([hidden]) #signin"), expect("#locked #lock-message", "sign in"))),
    flow("export-documents", "JSON → Readable summary → Doctor visit summary", "data-home",
      step("data-home", "Download JSON and keep the data page open", click("#json-export"), expect("#profile-form")),
      step("data-home", "Download readable summary", click("#html-export"), expect("#profile-form")),
      step("result-photo", "Open event and download consultation summary", click("[data-tab=history]"), expect("[data-event='event-0']"), click("[data-event='event-0']"), expect("#doctor-summary"), click("#doctor-summary"), expect("#doctor-summary"))),
  );

  for (const s of catalog) {
    const actions = s.error ? [expect("#message.error", s.title)] : checks[s.id];
    if (!actions) throw Error(`Add a reviewed playable case for ${s.id}`);
    journeys.push({ id: `case-${s.id}`, title: s.title, kind: "case", entry: s.id, condition: s.condition || "Start from this registered fictional scenario", steps: [step(s.id, `View:${s.title}`, ...actions)] });
  }
  return journeys;
}
