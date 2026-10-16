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
  "capture-manual": [expect("#save-form"), expect("#capture-title", "手動補記")],
  "capture-photo": [expect(".capture-preview img"), expect("#retake"), expect("#save-form")],
  "capture-observations": [expect("details[open] [name=notes]"), expect("[name=notes]", undefined)],
  "capture-care": [expect("details[open] [name=care_bleeding]"), expect("[data-care-preview]")],
  "capture-time": [expect("details[open] [name=occurred_at]")],
  "capture-pending": [expect("[data-resume]"), expect("#manual")],
  "capture-saving": [expect(".save-capture[disabled]"), expect("#sync-state")],
  "capture-offline": [expect("#message", "已離線"), expect("#sync-state", "本機副本保留"), expect("#save-form")],
  "capture-preview-error": [expect("#preview-error:not([hidden])", "原檔已保留")],
  "history-empty": [expect("#history-list .empty", "未有紀錄")],
  "history-pagination": [expect("#next:not([disabled])"), expect("#history-list [data-event='event-49']")],
  "result-manual": [expect(".lead", "已保存今次補記"), expect("#doctor-summary")],
  "result-photo": [expect(".lead", "原相已保存。未有分析結果"), expect("#reanalyze")],
  "result-partial": [expect(".lead", "原相未同步完成")],
  "result-running": [expect(".lead", "AI 分析中")],
  "result-failed": [expect(".lead", "分析未完成"), expect("#reanalyze")],
  "result-unknown": [expect(".lead", "保持未知")],
  "result-appearance": [expect(".lead", "可用嘅外觀建議")],
  "result-photo-open": [expect("details.photo[open] img"), expect("details.photo a[download]")],
  "result-edit": [expect("details[open] #edit-event"), expect("#edit-event [name=profile_id]")],
  "result-versions": [expect("#view details[open]", "用戶修正 1 次"), expect("#view details[open]", "分析 2 個版本")],
  "result-delete": [expect("dialog[open] [data-confirm]"), expect("[data-confirm-text]", "刪除")],
  "visit-summary": [expect("h1", "StoolSense 求診紀錄摘要"), expect("table")],
  "care-insufficient": [expect(".care-guidance", "資料未足夠")],
  "care-record": [expect(".care-guidance", "保留紀錄")],
  "care-contact": [expect(".care-guidance", "聯絡醫生")],
  "care-urgent": [expect(".care-guidance", "盡快")],
  "care-emergency": [expect(".care-guidance", "立即求助")],
  "care-other": [expect(".care-guidance", "成人")],
  "insights-empty": [expect("#insights .empty"), expect("#insights", "未有足夠")],
  "insights-candidate": [expect(".pattern details[open] [data-event]"), expect(".pattern", "4/5")],
  "insights-confounded": [expect(".pattern", "無法分辨")],
  "insights-intervals": [expect("#insights details[open]", "事件間隔")],
  "import-empty": [expect("#meal-list .empty", "未有飲食")],
  "import-mapping": [expect("#map-form"), expect("#map-form [name=time]")],
  "import-xlsx": [select("#sheet", "1"), { type: "expect", selector: "#sheet", value: "1" }, expect("#map-form")],
  "import-ready": [expect("#commit-import:not([disabled])"), expect("#import-preview", "2 行可匯入")],
  "import-duplicate": [expect("#commit-import[disabled]"), expect("#import-preview", "2 行重複")],
  "import-invalid": [expect("#commit-import[disabled]"), expect("#import-preview .error")],
  "import-committed": [expect("#message.notice", "已匯入 2 行"), expect("#meal-list .row:nth-child(4)")],
  "meal-delete": [expect("dialog[open] [data-confirm]"), expect("[data-confirm-text]", "飲食")],
  "data-originals": [expect("[data-original]"), expect("#zip-export:not([disabled])")],
  "data-no-originals": [expect("#zip-export[disabled]"), expect("#originals", "冇已完成同步")],
  "data-delete": [expect("[data-delete-event]"), expect("#delete-selected")],
  "data-confirm-delete": [expect("dialog[open] [data-confirm]"), expect("[data-confirm-text]", "所選 1 筆")],
  "data-profile-created": [expect("#profile", "新 Profile（虛構）"), expect("#message.notice", "新 profile 已建立")],
  "data-export-complete": [expect("#message.notice", "匯出完成，原紀錄保留")],
  "component-symptoms": [expect("[name=pain][value='3']"), expect("[name=straining][value='3']"), check("[name=pain][value='2']"), { type: "expect", selector: "[name=pain][value='2']", checked: true }],
  "component-observations": [select("[name=bristol]", "7"), { type: "expect", selector: "[name=bristol]", value: "7" }, expect("[name=notes]")],
  "component-appearance": [expect("#view", "模擬合資格資料"), expect("#view", "Bristol 7")],
  "auth-checking": [expect("#locked:not([hidden]) #lock-message", "正在確認")],
  "auth-expired": [expect("#locked:not([hidden]) #lock-message", "登入")],
  "auth-denied": [expect("#locked:not([hidden]) #lock-message", "登入")],
};

export function createJourneys(catalog) {
  const journeys = baseline.map(j => ({ ...structuredClone(j), kind: "flow" }));
  // Each destination must have an explicit DOM assertion.
  journeys[1].steps[0].actions.push(expect("#save-form"));
  journeys[2].steps[0].actions[0].replaces = "#save-form";
  journeys.push(
    flow("main-navigation", "五個主頁 → 返回記錄", "capture-home",
      ...["history", "insights", "import", "data"].flatMap(page => [step(`${page}-home`, `開啟 ${page} 主頁`, click(`[data-tab=${page}]`), expect(page === "data" ? "#profile-form" : page === "history" ? "#history-list" : page === "insights" ? "#insights .readings" : "#meal-list")), step("capture-home", "返回記錄", click("[data-tab=capture]"), expect("#manual"))])),
    flow("photo-draft", "選相 → 補充 → 稍後同步 → 繼續保存", "capture-home",
      step("capture-photo", "選相", file("#file"), expect("#retake")),
      step("capture-observations", "填寫外觀及備註", summary("外觀、其他"), select("[name=bristol]", "4"), fill("[name=notes]", "虛構流程備註"), expect("details[open] [name=notes]")),
      step("capture-time", "檢查發生時間", summary("時間及歸屬"), expect("details[open] [name=occurred_at]")),
      step("capture-pending", "保留草稿並稍後同步", click("#leave-draft"), expect("[data-resume]")),
      step("capture-photo", "繼續同一份草稿", click("[data-resume]"), expect("#retake")),
      step("result-photo", "只保存原相", check("[name=analyze]", false), click(".save-capture"), expect(".lead", "原相已保存。未有分析結果"))),
    flow("photo-replace", "相片未能預覽 → 換相 → 保存", "capture-preview-error",
      step("capture-photo", "換上可預覽嘅虛構圖", file("#retake"), expect(".capture-preview img")),
      step("result-photo", "原相保存成功", check("[name=analyze]", false), click(".save-capture"), expect("#doctor-summary"))),
    flow("result-edit", "查看原相 → 修正 → 版本紀錄", "result-photo",
      step("result-photo-open", "展開原相", summary("查看原相"), expect("details.photo[open] img")),
      step("result-edit", "打開修正表單", summary("修改感受"), expect("#edit-event [name=occurred_at]")),
      step("result-versions", "保存修正並查閱紀錄", check("#edit-event [name=pain][value='2']"), click("#edit-event button.primary"), expect("#message.notice", "修正已保存"), summary("分析及修正紀錄"), expect("#view details[open]", "用戶修正 1 次"))),
    flow("event-delete", "刪除紀錄 → 取消 → 確認刪除", "result-manual",
      step("result-delete", "先顯示確認", click("#delete-event"), expect("dialog[open] [data-confirm]")),
      step("result-manual", "取消仍保留紀錄", click("[data-cancel]"), expect("#delete-event")),
      step("history-home", "確認刪除並返回歷史", click("#delete-event"), click("[data-confirm]"), expect("#history-list [data-event]"))),
    flow("history-paging", "歷史下一頁 → 上一頁 → 開啟紀錄", "history-pagination",
      step("history-pagination", "下一頁保留較舊事件", click("#next"), expect("[data-event='event-52']")),
      step("history-home", "返回第一頁", click("#previous"), expect("[data-event='event-0']")),
      step("result-photo", "開啟相片紀錄", click("[data-event='event-0']"), expect("#doctor-summary"))),
    flow("history-empty", "未有紀錄 → 新增補記", "history-empty", step("capture-home", "開始記錄", click("[data-tab=capture]"), expect("#manual")), step("capture-manual", "開啟補記", click("#manual"), expect("#save-form"))),
    flow("import-csv", "CSV → 欄位 → 預覽 → 保存 → 重複匯入", "import-home",
      step("import-mapping", "選擇虛構 CSV", csv(), expect("#map-form")),
      step("import-ready", "確認欄位並預覽", click("#map-form button"), expect("#commit-import:not([disabled])")),
      step("import-committed", "保存飲食紀錄", click("#commit-import"), expect("#message.notice", "已匯入 1 行")),
      step("import-duplicate", "相同來源再匯入，阻止重複", csv(), expect("#map-form"), click("#map-form button"), expect("#import-preview", "1 行重複"), expect("#commit-import[disabled]"))),
    flow("import-correction", "CSV 日期錯誤 → 修正來源 → 保存", "import-home",
      step("import-invalid", "未確認日期不能提交", file("#diet-file", "./invalid-meals.csv", "synthetic-invalid.csv", "text/csv"), expect("#map-form"), click("#map-form button"), expect("#commit-import[disabled]"), expect("#import-preview .error")),
      step("import-ready", "換成有效日期嘅來源", csv(), expect("#map-form"), click("#map-form button"), expect("#commit-import:not([disabled])")),
      step("import-committed", "保存修正後嘅資料", click("#commit-import"), expect("#message.notice", "已匯入 1 行"))),
    flow("import-xlsx", "Excel → 選工作表 → 預覽 → 保存", "import-xlsx",
      step("import-mapping", "選第二個工作表", select("#sheet", "1"), expect("#map-form")),
      step("import-ready", "預覽工作表內容", click("#map-form button"), expect("#import-preview", "雞肉飯（虛構）")),
      step("import-committed", "保存 Excel 飲食", click("#commit-import"), expect("#message.notice", "已匯入 1 行"))),
    flow("meal-delete", "刪除飲食 → 取消 → 確認", "import-home",
      step("meal-delete", "顯示刪除確認", click("[data-meal='meal-1']"), expect("dialog[open] [data-confirm]")),
      step("import-home", "取消保留原紀錄", click("[data-cancel]"), expect("[data-meal='meal-1']")),
      step("import-home", "確認後移除指定紀錄", click("[data-meal='meal-1']"), click("[data-confirm]"), expect("[data-meal='meal-2']"), { type: "expect", selector: "#meal-list", text: "雞肉飯" })),
    flow("profile-create", "新增 Profile → 切換記錄對象", "data-home",
      step("data-profile-created", "新增虛構 Profile", fill("#profile-form input", "流程 Profile（虛構）"), click("#profile-form button"), expect("#message.notice", "新 profile 已建立")),
      step("data-home", "切換到家人資料分類", select("#profile", "demo-family"), expect("#profile-form"), { type: "expect", selector: "#profile", value: "demo-family" })),
    flow("profile-conflict", "Profile 名稱重複 → 改名成功", "data-home",
      step("error-conflict", "重複名稱被拒絕", fill("#profile-form input", "我"), click("#profile-form button"), expect("#message.error", "已存在")),
      step("data-profile-created", "改名後建立", fill("#profile-form input", "新名稱（虛構）"), click("#profile-form button"), expect("#message.notice", "新 profile 已建立"))),
    flow("original-export", "選擇原相 → 完整 ZIP 匯出", "data-home",
      step("data-originals", "列出可匯出原相", click("#choose-originals"), expect("[data-original]")),
      step("data-export-complete", "包含所選原相嘅 ZIP", check("[data-original]"), click("#zip-export"), expect("#message.notice", "匯出完成，原紀錄保留"))),
    flow("data-delete", "選刪除範圍 → 取消 → 確認刪除", "data-home",
      step("data-delete", "選取一筆虛構紀錄", click("#choose-delete"), expect("[data-delete-event]"), check("[data-delete-event]")),
      step("data-confirm-delete", "顯示刪除範圍", click("#delete-selected"), expect("[data-confirm-text]", "所選 1 筆")),
      step("data-delete", "取消刪除", click("[data-cancel]"), expect("#delete-selected")),
      step("data-home", "確認刪除指定紀錄", click("#delete-selected"), click("[data-confirm]"), expect("#message.notice", "已刪除 1 筆"), expect("#profile-form"))),
    flow("insights-evidence", "候選模式 → 支持紀錄 → 返回歷史", "insights-candidate",
      step("result-photo", "開啟支持事件", click(".pattern [data-event]"), expect("#doctor-summary")),
      step("history-home", "返回歷史", click("#back"), expect("#history-list [data-event]"))),
    flow("analysis-existing", "分析失敗紀錄 → 再分析 → 保留舊版本", "result-failed",
      step("result-unknown", "重試合成分析", click("#reanalyze"), expect(".lead", "保持未知")),
      step("result-versions", "核對兩個版本都保留", summary("分析及修正紀錄"), expect("#view details[open]", "分析 2 個版本"))),
  );
  // Real controls exercise rejection/retry through the same disposable API.
  for (const code of ["invalid_care_answers", "service_unavailable"]) {
    const s = catalog.find(s=>s.error === code);
    journeys.push(flow(`save-error-${code}`, `${s.title} → 保留草稿 → 重試`, "capture-manual",
      step(s.id, "一次合成 API 拒絕", fault("/api/records", "POST", code), click(".save-capture"), expect("#message.error", s.title), expect("#save-form")),
      step("result-manual", "再次提交同一份草稿", click(".save-capture"), expect("#doctor-summary"), expect(".lead", "已保存今次補記"))));
  }
  for (const code of ["invalid_image", "storage_capacity", "too_large", "integrity_failed", "upload_incomplete"]) {
    const s = catalog.find(s=>s.error === code), endpoint = ["integrity_failed", "upload_incomplete"].includes(code) ? "/api/images/:id/complete" : "/api/images";
    journeys.push(flow(`upload-error-${code}`, `${s.title} → 原相保留 → 重試`, "capture-photo",
      step(s.id, "原相上傳被拒絕，保留本機草稿", check("[name=analyze]", false), fault(endpoint, "POST", code), click(".save-capture"), expect("#message.error", s.title), expect("#save-form")),
      step("result-photo", "重試同一原相", click(".save-capture"), expect(".lead", "原相已保存。未有分析結果"))));
  }
  journeys.push(flow("event-deleted", "事件已刪除 → 顯示拒絕及本機副本", "capture-manual", step("error-event_deleted", "已刪除事件不自動重建", fault("/api/records", "POST", "event_deleted", 410), click(".save-capture"), expect("#message.error", "唔會重新建立"), expect("#sync-state", "本機副本保留"))));
  for (const code of ["analysis_limit_or_running", "analysis_unavailable", "provider_unavailable"]) {
    const s = catalog.find(s=>s.error === code);
    journeys.push(flow(`analysis-error-${code}`, `${s.title} → 紀錄保留 → 重試`, "result-photo",
      step(s.id, "分析拒絕不刪紀錄", fault("/api/records/:id/analyze", "POST", code), click("#reanalyze"), expect("#message.error", s.title), expect("#doctor-summary")),
      step("result-unknown", "合成分析恢復", click("#reanalyze"), expect(".lead", "保持未知"))));
  }
  journeys.push(flow("revision-conflict", "修正衝突 → 重開紀錄 → 保存修正", "result-edit",
    step("error-revision_conflict", "拒絕過期版本", fault("/api/records/:id", "PATCH", "revision_conflict", 409), click("#edit-event button.primary"), expect("#message.error", "另一個畫面改過")),
    step("result-edit", "重開最新版本再修改", click("#refresh"), expect("#doctor-summary"), summary("修改感受"), check("#edit-event [name=pain][value='2']"), click("#edit-event button.primary"), expect("#message.notice", "修正已保存"))));

  const careBase = { scope: "adult", bleeding: "none", severePain: "0", dehydration: "0", warningSigns: "0", diarrheaDays: "0", looseStools24h: "0", changeDays: "0", higherRisk: "0", weightLoss: "0" };
  for (const [kind, answers, observations, expected] of [
    ["insufficient", {}, {}, "資料未足夠"],
    ["record", careBase, { color: "brown", diarrhea: "0", blood: "0" }, "保留紀錄，留意變化"],
    ["contact", { ...careBase, bleeding: "small" }, { color: "brown", diarrhea: "0", blood: "1" }, "聯絡醫生跟進"],
    ["urgent", { ...careBase, diarrheaDays: "3" }, { color: "brown", diarrhea: "1", blood: "0" }, "盡快取得醫療意見"],
    ["emergency", { ...careBase, bleeding: "heavy" }, { color: "brown", diarrhea: "0", blood: "1" }, "立即求助"],
    ["other", { scope: "other" }, {}, "資料未足夠"],
  ]) {
    const answerActions = Object.entries(answers).map(([key,value]) => ["diarrheaDays", "looseStools24h", "changeDays"].includes(key) ? fill(`[name=care_${key}]`, value) : select(`[name=care_${key}]`, value));
    journeys.push(flow(`care-${kind}`, `補充求醫資料 → ${catalog.find(s=>s.id===`care-${kind}`).title}`, "capture-manual",
      step("capture-care", "填寫虛構答案並查看即時提示", summary("外觀、其他"), summary("求醫參考"), ...Object.entries(observations).map(([key,value])=>select(`[name=${key}]`,value)), ...answerActions, expect("[data-care-preview]", expected)),
      step(`care-${kind}`, "保存後結果卡保留相同提示", click(".save-capture"), expect(".care-guidance", expected), expect("#doctor-summary"))));
  }
  for (const code of ["ambiguous_date", "invalid_import_rows"]) {
    const preview = code === "ambiguous_date";
    journeys.push(flow(`import-error-${code}`, `${catalog.find(s=>s.error===code).title} → 重試匯入`, "import-mapping",
      step(`error-${code}`, "顯示拒絕而不遺失欄位", ...(!preview ? [click("#map-form button"), expect("#commit-import:not([disabled])")] : []), fault(preview ? "/api/import/preview" : "/api/import/commit", "POST", code, 422), click(preview ? "#map-form button" : "#commit-import"), expect("#message.error", catalog.find(s=>s.error===code).title)),
      step("import-committed", "修正來源條件後重試", ...(preview ? [click("#map-form button"), expect("#commit-import:not([disabled])")] : []), click("#commit-import"), expect("#message.notice", "已匯入 2 行"))));
  }
  journeys.push(
    flow("export-range", "匯出範圍過大 → 縮窄日期 → 選原相", "data-home",
      step("error-narrow_export_range", "提示縮短匯出範圍", fault("/api/export", "GET", "narrow_export_range", 413), click("#choose-originals"), expect("#message.error", "縮短匯出日期範圍")),
      step("data-originals", "使用較細日期範圍", fill("#from", "2026-10-16"), fill("#to", "2026-10-16"), click("#choose-originals"), expect("#zip-export"))),
    flow("meal-range", "飲食範圍錯誤 → 重新載入", "capture-home",
      step("error-narrow_date_range", "合成讀取拒絕", fault("/api/meals", "GET", "narrow_date_range", 413), click("[data-tab=import]"), expect("#message.error", "縮短日期範圍")),
      step("import-home", "重新載入飲食紀錄", click("[data-tab=import]"), expect("#meal-list [data-meal]"))),
    flow("session-expired", "保存期間登入過期 → 重新登入入口", "capture-manual",
      step("auth-expired", "身份失效時鎖定私人畫面", fault("/api/records", "POST", "sign_in_required", 401), click(".save-capture"), expect("#locked:not([hidden]) #signin"), expect("#locked #lock-message", "登入"))),
    flow("export-documents", "JSON → 可閱讀摘要 → 求診摘要", "data-home",
      step("data-home", "下載 JSON，同時保留資料頁", click("#json-export"), expect("#profile-form")),
      step("data-home", "下載可閱讀摘要", click("#html-export"), expect("#profile-form")),
      step("result-photo", "開啟事件並下載求診摘要", click("[data-tab=history]"), expect("[data-event='event-0']"), click("[data-event='event-0']"), expect("#doctor-summary"), click("#doctor-summary"), expect("#doctor-summary"))),
  );

  for (const s of catalog) {
    const actions = s.error ? [expect("#message.error", s.title)] : checks[s.id];
    if (!actions) throw Error(`Add a reviewed playable case for ${s.id}`);
    journeys.push({ id: `case-${s.id}`, title: s.title, kind: "case", entry: s.id, condition: s.condition || "由呢個已登記嘅虛構情境開始", steps: [step(s.id, `檢視：${s.title}`, ...actions)] });
  }
  return journeys;
}
