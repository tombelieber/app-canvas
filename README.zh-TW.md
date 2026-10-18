<!-- Generated from launch/locales/zh-TW.json; run npm run docs:generate. -->
# App Canvas

[English](README.md) · [繁體中文](README.zh-TW.md) · [简体中文](README.zh-CN.md) · [日本語](README.ja.md) · [Español](README.es.md) · [Français](README.fr.md) · [Deutsch](README.de.md) · [Português](README.pt.md) · [Italiano](README.it.md) · [한국어](README.ko.md) · [Nederlands](README.nl.md)

## 整個 UI，一張畫布，來自真實程式碼。

與 coding agent 一起建立及維護可縮放畫布，同時查看真實頁面、狀態及互動流程。

**[開啟互動 Demo](https://tombelieber.github.io/app-canvas/) · [加入現有 Repo](https://tombelieber.github.io/app-canvas/about/zh-TW/start/) · [產品發布文章](https://tombelieber.github.io/app-canvas/about/zh-TW/release/)**

## TL;DR

- 一次看清已實作的完整頁面、具名狀態及相連流程。
- 只維護一份 UI。Coding agent 負責 fixtures、adapter 及 coverage checks。
- 公開虛構資料 Demo 有 77 個狀態及 44 條流程，毋須登入或 API key。

![真實 StoolSense UI 狀態並排在 App Canvas 畫布上](docs/stoolsense-overview.jpg)

公開 Demo 真實畫面：77 個已編寫狀態、44 條流程、121 個可播放項目。隊列包含獨立 case，並非 121 條端到端流程。

## 看全貌、直接操作、播放流程

### 縮小，看清整個 App

按頁面分組查看完整畫面，搜尋、篩選或收起側欄。按流程連結後，鏡頭會移到目標畫面。

### 放大，操作真實 UI

Browse 會鎖住控制項，方便拖動畫布。選取畫面後按 Interact，即可以虛構資料操作原有 App 程式。

### 按 Demo，展示完整旅程

在同一個持續運行的 App session 播放成功、失敗及復原流程，附操作提示、字幕、暫停、速度及步驟時間軸。

![真實 Demo 在離線儲存失敗後保留草稿，等待重試](docs/stoolsense-playback.jpg)

實際失敗及復原畫面。播放會執行已編寫操作與檢查；畫一條連線本身並不等於測試。

## 由現有 Repo 變成完整互動畫布

交給能讀寫 Repo 及執行指令的 coding agent。不需要事先準備 Storybook 或手寫畫面清單；只安裝套件並不會自動填滿畫布。

### 貼給你的 Coding Agent

```text
Read https://github.com/tombelieber/app-canvas/blob/v0.10.3/AGENT_GUIDE.md and add a completely populated App Canvas to this repository. Discover all screens, components, variants, states and navigation from the whole application source. Use original UI code. Create the missing synthetic fixtures and render harnesses. Reconcile an independent source inventory with rendered cases and source-linked runtime checks. Add checked happy, failure and recovery journeys. Run --complete against the original source root. Continue until the full landscape is populated and verified; report genuine blockers as incomplete. Keep production sessions, credentials and real user data out of previews.
```

### 1. 安裝共用工具

使用 Node.js 22+，沿用專案的 package manager 與 lockfile。安裝固定版本的 GitHub release，再安裝瀏覽器。npm 12 若阻擋此直接 Git dependency，才加 --allow-git=root；毋須更改全域設定。

```sh
npm install --save-dev github:tombelieber/app-canvas#v0.10.3
npx app-canvas browsers
```

### 2. 先盤點，再選 Case

從整個 App 根目錄執行 discover。Agent 要逐一檢視來源區段及候選項、清理 pending，並獨立列出語意狀態，而非倒過來由 catalog 決定範圍。未解決 blocker 必須保留。

```sh
npx app-canvas discover --source-root . --out .artifacts/app-canvas/inventory.json
npx app-canvas pending --inventory .artifacts/app-canvas/inventory.json
```

### 3. 用 Fixtures 渲染原有 UI

Agent 建立 ui-review/canvas.config.mjs、catalog、虛構 fixtures、preview entry 及可檢查 journeys。Web adapter 匯入原有頁面、providers 與樣式；fixtures 只替代資料和依賴，不能重寫 UI。拒絕未知網絡請求。

### 4. 驗證狀態與互動

涵蓋已實作的一般、空白、載入、錯誤、拒絕存取、對話框及復原狀態。每個 case 都要有檢查，流程要操作真實控制項。核對 inventory、來源連結 assertions 與 routes，再對同一 App 根目錄通過 --complete。

```sh
npx app-canvas --config ui-review/canvas.config.mjs --check
npx app-canvas --config ui-review/canvas.config.mjs --verify
npx app-canvas --config ui-review/canvas.config.mjs --complete --source-root .
```

### 5. 由原始碼維護與檢視

執行 ui:review，查看總覽及狀態圖，再播放流程。請 Agent 修改真正 App 原始碼；既有 preview 會重建。新 route 或狀態需要更新 inventory、fixture 與 journey，交付前必須通過完整檢查。

```sh
npm run ui:review
```


### 哪些東西留在你的 App Repo

共用套件維護 viewer、CLI 及 skill；各 Repo 維護自己的 adapter、fixtures、獨立 inventory、catalog 與互動檢查。可從可執行的 React/Vite 範例開始；其他技術棧使用專屬 adapter。

[Agent guide](https://github.com/tombelieber/app-canvas/blob/v0.10.3/AGENT_GUIDE.md) · [React/Vite](https://github.com/tombelieber/app-canvas/tree/v0.10.3/examples/react-vite)

### 可選的 Agent Skill

Codex 與 Claude Code 可安裝內附 skill，其他 coding agent 可直接閱讀 AGENT_GUIDE.md。Canvas runtime 不呼叫模型，也不需要模型 API key；你選用的 Agent 有自己的費用與權限。

```sh
npx app-canvas install --target both
```

## 這個版本能證明甚麼，有甚麼限制

- Web preview 使用真實 HTML/CSS，互動時執行原有 JavaScript。UIKit、SwiftUI、Android 需要原生 runtime harness 及證據；原生截圖不等於可操作的原生 App。
- Coverage 是經審查的來源與 case 對照，不會自動推斷所有業務情境。UI checks 不代表 production backend、醫療準確率或模型 precision 已合格。
- Viewer 控制介面目前是繁體中文；產品頁及教學提供多語言。公開 Demo 是固定的虛構資料 frontend export，實際整合才會監看你的來源。尚未量測實體 iPad 效能。

虛構資料 Demo · 無 App backend · 毋須登入 · 毋須 API key

[Safari 優化實錄](https://tomtang3.ai/blog/app-canvas-safari-rendering/)

完整 API、原生流程、替代工具及 release 維護，詳見英文 README 與 Agent 指南。 [English README](README.md) · [MIT](LICENSE)
