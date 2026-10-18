<!-- Generated from launch/locales/ja.json; run npm run docs:generate. -->
# App Canvas

[English](README.md) · [繁體中文](README.zh-TW.md) · [简体中文](README.zh-CN.md) · [日本語](README.ja.md) · [Español](README.es.md) · [Français](README.fr.md) · [Deutsch](README.de.md) · [Português](README.pt.md) · [Italiano](README.it.md) · [한국어](README.ko.md) · [Nederlands](README.nl.md)

## UI 全体を、一枚のキャンバスに。実際のコードで。

コーディングエージェントと構築・保守する、実際の画面、状態、操作フローを見渡せるキャンバス。

**[デモを開く](https://tombelieber.github.io/app-canvas/) · [既存リポジトリに導入](https://tombelieber.github.io/app-canvas/about/ja/start/) · [リリース記事](https://tombelieber.github.io/app-canvas/about/ja/release/)**

## TL;DR

- 実装済みの画面、名前付き状態、接続されたフローを一望。
- UI 実装は一つ。エージェントが fixtures、adapter、カバレッジ検証を作成。
- 公開の合成データデモで 77 状態と 44 フローを体験。ログインも API キーも不要。

![App Canvas に並ぶ実際の StoolSense の UI 状態](docs/stoolsense-overview.jpg)

公開デモの実画面：77 状態、44 フロー、121 再生項目。単独ケースを含み、121 本の E2E フローではありません。

## 全体を見る、操作する、再生する

### 縮小してアプリを理解

画面をページ別に表示。検索、絞り込み、サイドバーの開閉が可能。フローのリンクを選ぶと、移動先へカメラが追従します。

### 拡大して実際の UI を操作

Browse は操作をロックして移動を優先。画面を選び Interact を押すと、使い捨ての合成データで元のアプリコードを操作できます。

### Demo でフローを説明

継続するアプリセッション内で成功、失敗、復旧を再生。操作表示、字幕、一時停止、速度調整、ステップのタイムラインを備えます。

![オフライン保存失敗後に下書きを保持して再試行する実際のデモ](docs/stoolsense-playback.jpg)

失敗と復旧の実画面。再生は定義された操作と検証を実行します。線を引くだけではテストになりません。

## 既存リポジトリから対話的なキャンバスへ

リポジトリを読み書きし、コマンドを実行できるエージェントに依頼します。既存の Storybook や手作業の画面一覧は不要。インストールだけで画面が揃うわけではありません。

### エージェントに貼り付ける指示

```text
Read https://github.com/tombelieber/app-canvas/blob/v0.10.3/AGENT_GUIDE.md and add a completely populated App Canvas to this repository. Discover all screens, components, variants, states and navigation from the whole application source. Use original UI code. Create the missing synthetic fixtures and render harnesses. Reconcile an independent source inventory with rendered cases and source-linked runtime checks. Add checked happy, failure and recovery journeys. Run --complete against the original source root. Continue until the full landscape is populated and verified; report genuine blockers as incomplete. Keep production sessions, credentials and real user data out of previews.
```

### 1. 共通ツールを導入

Node.js 22+ とプロジェクトのパッケージ管理・lockfile を使用。固定した GitHub リリースとブラウザをインストールします。npm 12 が直接 Git 依存を拒否する場合のみ --allow-git=root を追加。グローバル設定は変更しません。

```sh
npm install --save-dev github:tombelieber/app-canvas#v0.10.3
npx app-canvas browsers
```

### 2. ケース選択の前に棚卸し

アプリ全体のルートで discover を実行。エージェントは全ソース領域と候補を確認し、pending を解消。catalog とは独立して意味のある状態を列挙します。未解決の問題は残して明示します。

```sh
npx app-canvas discover --source-root . --out .artifacts/app-canvas/inventory.json
npx app-canvas pending --inventory .artifacts/app-canvas/inventory.json
```

### 3. Fixtures で元の UI を描画

ui-review/canvas.config.mjs、catalog、合成 fixtures、preview entry、検証付き journeys を作成。Web adapter は元のページ、providers、CSS を取り込みます。fixtures はデータと依存関係を置換し、UI は複製しません。未知の通信を拒否します。

### 4. 状態と操作を検証

通常、空、読み込み、エラー、アクセス拒否、ダイアログ、復旧を網羅。全ケースを確認し、連続フローで実際のコントロールを操作。inventory、ソースに紐づく assertions、routes を照合し、同じルートで --complete を通します。

```sh
npx app-canvas --config ui-review/canvas.config.mjs --check
npx app-canvas --config ui-review/canvas.config.mjs --verify
npx app-canvas --config ui-review/canvas.config.mjs --complete --source-root .
```

### 5. ソースからレビューと保守

ui:review で全体と状態図を確認し、フローを再生。変更は実際のアプリソースへ依頼します。既存プレビューは再構築されます。新ルートや状態には inventory、fixture、journey の更新が必要。引き渡し前に完全性検証を必須にします。

```sh
npm run ui:review
```


### アプリ側に保持するもの

共通パッケージは viewer、CLI、skill を管理。各リポジトリは adapter、fixtures、独立 inventory、catalog、操作検証を管理します。動作する React/Vite 例を参考にし、他の構成には専用 adapter を用意します。

[Agent guide](https://github.com/tombelieber/app-canvas/blob/v0.10.3/AGENT_GUIDE.md) · [React/Vite](https://github.com/tombelieber/app-canvas/tree/v0.10.3/examples/react-vite)

### 任意のエージェント Skill

Codex と Claude Code には同梱 skill を導入可能。他のエージェントは AGENT_GUIDE.md を直接読めます。Canvas runtime はモデルを呼ばず API キーも不要。利用するエージェント自体の料金と権限は別です。

```sh
npx app-canvas install --target both
```

## このリリースの範囲と限界

- Web は実際の HTML/CSS と操作時の元の JavaScript を利用。UIKit、SwiftUI、Android は元の runtime による harness と証拠が必要です。キャプチャ画像は操作可能なネイティブアプリではありません。
- カバレッジは確認済みのソースとケースの対応です。全業務条件の自動発見ではなく、バックエンド、医療精度、モデル精度の保証でもありません。
- Viewer の操作 UI は現在繁体字中国語です。製品ページとガイドは多言語。公開デモは固定の合成 frontend export、実際の統合はソースを監視します。実機 iPad の性能は未測定です。

合成データ · アプリバックエンドなし · ログイン不要 · API キー不要

[Safari 技術記事](https://tomtang3.ai/blog/app-canvas-safari-rendering/)

詳細 API、ネイティブ手順、代替ツール、リリース保守は英語 README とガイドを参照。 [English README](README.md) · [MIT](LICENSE)
