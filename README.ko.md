<!-- Generated from launch/locales/ko.json; run npm run docs:generate. -->
# App Canvas

[English](README.md) · [繁體中文](README.zh-TW.md) · [简体中文](README.zh-CN.md) · [日本語](README.ja.md) · [Español](README.es.md) · [Français](README.fr.md) · [Deutsch](README.de.md) · [Português](README.pt.md) · [Italiano](README.it.md) · [한국어](README.ko.md) · [Nederlands](README.nl.md)

## 전체 UI를 하나의 캔버스에. 실제 코드로.

코딩 에이전트와 구축하고 유지하는 확대 가능한 캔버스에서 실제 화면, 상태, 상호작용 흐름을 탐색하세요.

**[데모 열기](https://tombelieber.github.io/app-canvas/) · [기존 저장소에 추가](https://tombelieber.github.io/app-canvas/about/ko/start/) · [출시 이야기](https://tombelieber.github.io/app-canvas/about/ko/release/)**

## TL;DR

- 구현된 전체 화면, 이름 있는 상태, 연결된 흐름을 함께 봅니다.
- UI 구현은 하나만 유지합니다. 에이전트가 fixtures, adapter, 커버리지 검증을 만듭니다.
- 합성 데이터 공개 데모에서 77개 상태와 44개 흐름을 체험하세요. 로그인과 API 키가 필요 없습니다.

![App Canvas에 배치된 실제 StoolSense UI 상태](docs/stoolsense-overview.jpg)

실제 공개 데모: 상태 77개, 흐름 44개, 재생 항목 121개. 개별 케이스를 포함하며 E2E 흐름 121개라는 뜻은 아닙니다.

## 보고, 사용하고, 재생하기

### 축소해서 앱 전체 이해하기

페이지별 전체 화면, 검색, 필터, 접을 수 있는 패널을 제공합니다. 흐름 링크를 누르면 카메라가 목적지로 이동합니다.

### 확대해서 실제 UI 사용하기

Browse는 이동 중 컨트롤을 잠급니다. 화면을 선택하고 Interact를 눌러 임시 합성 데이터로 원래 앱 코드를 사용하세요.

### Demo로 흐름 설명하기

하나의 연속된 앱 세션에서 성공, 실패, 복구를 재생합니다. 동작 표시, 자막, 일시 정지, 속도, 단계 타임라인을 제공합니다.

![오프라인 저장 실패 후 초안을 유지하고 재시도하는 실제 데모](docs/stoolsense-playback.jpg)

실제 실패 및 복구 UI입니다. 재생은 작성된 동작과 검증을 실행합니다. 연결선을 그리는 것만으로 테스트가 되지 않습니다.

## 기존 저장소를 상호작용 캔버스로

파일을 읽고 수정하고 명령을 실행할 수 있는 에이전트에 통합을 맡기세요. 기존 Storybook이나 수동 화면 목록은 필요 없습니다. 패키지 설치만으로 캔버스가 채워지지는 않습니다.

### 코딩 에이전트에 붙여 넣기

```text
Read https://github.com/tombelieber/app-canvas/blob/v0.11.0/AGENT_GUIDE.md and add a completely populated App Canvas to this repository. Discover all screens, components, variants, states and navigation from the whole application source. Use original UI code. Create the missing synthetic fixtures and render harnesses. Reconcile an independent source inventory with rendered cases and source-linked runtime checks. Add checked happy, failure and recovery journeys. Run --complete against the original source root. Continue until the full landscape is populated and verified; report genuine blockers as incomplete. Keep production sessions, credentials and real user data out of previews.
```

### 1. 공유 도구 설치

Node.js 22+와 프로젝트의 패키지 관리자 및 lockfile을 사용합니다. 고정한 GitHub 릴리스와 브라우저를 설치하세요. npm 12가 이 직접 Git 의존성을 차단할 때만 --allow-git=root를 추가하고 전역 정책은 바꾸지 마세요.

```sh
npm install --save-dev github:tombelieber/app-canvas#v0.11.0
npx app-canvas browsers
```

### 2. 케이스 선택 전에 소스 조사

전체 앱 루트에서 discover를 실행합니다. 에이전트는 모든 소스 영역과 후보를 검토하고 pending을 해결하며 catalog와 독립적으로 의미 있는 상태를 열거합니다. 미해결 문제는 그대로 표시합니다.

```sh
npx app-canvas discover --source-root . --out .artifacts/app-canvas/inventory.json
npx app-canvas pending --inventory .artifacts/app-canvas/inventory.json
```

### 3. Fixtures로 원래 UI 렌더링

ui-review에 config, catalog, 합성 fixtures, preview entry, 검증 가능한 journeys를 만듭니다. Adapter는 실제 페이지, providers, 스타일을 가져옵니다. 데이터와 의존성만 교체하고 UI를 복제하지 않습니다. 알 수 없는 네트워크 요청은 거부합니다.

### 4. 상태와 상호작용 검증

정상, 빈 화면, 로딩, 오류, 접근 거부, 대화상자, 복구를 포함합니다. 각 케이스와 연속 흐름의 실제 컨트롤을 검증하세요. Inventory, 소스와 연결된 assertions, routes를 대조하고 같은 루트에서 --complete를 통과합니다.

```sh
npx app-canvas --config ui-review/canvas.config.mjs --check
npx app-canvas --config ui-review/canvas.config.mjs --verify
npx app-canvas --config ui-review/canvas.config.mjs --complete --source-root .
```

### 5. 소스에서 검토하고 유지

ui:review로 전체 화면과 상태 그래프를 보고 흐름을 재생하세요. 에이전트는 실제 앱 코드를 수정합니다. 기존 preview는 다시 빌드되지만 새 경로와 상태는 inventory, fixture, journey 업데이트가 필요합니다. 인계 전에 전체 검증을 요구하세요.

```sh
npm run ui:review
```


### 앱 저장소에 남는 파일

공유 패키지는 viewer, CLI, skill을 관리합니다. 각 저장소는 adapter, fixtures, 독립 inventory, catalog, 상호작용 검증을 관리합니다. 실행 가능한 React/Vite 예제로 시작하고 다른 스택에는 전용 adapter를 사용하세요.

[Agent guide](https://github.com/tombelieber/app-canvas/blob/v0.11.0/AGENT_GUIDE.md) · [React/Vite](https://github.com/tombelieber/app-canvas/tree/v0.11.0/examples/react-vite)

### 선택 사항인 Agent Skill

Codex와 Claude Code는 포함된 skill을 설치할 수 있습니다. 다른 에이전트는 AGENT_GUIDE.md를 직접 읽습니다. Runtime은 모델을 호출하지 않으며 API 키도 필요 없습니다. 선택한 에이전트 자체의 비용과 권한은 별도입니다.

```sh
npx app-canvas install --target both
```

## 이번 릴리스의 범위와 한계

- Web은 실제 HTML/CSS와 상호작용 시 원래 JavaScript를 사용합니다. UIKit, SwiftUI, Android는 원래 runtime의 harness와 증거가 필요합니다. 캡처 이미지는 조작 가능한 네이티브 앱이 아닙니다.
- 커버리지는 검토한 소스와 케이스의 대응이며 모든 업무 조건의 자동 발견이 아닙니다. UI 검증은 운영 backend나 의료 정확도, 모델 정밀도를 보장하지 않습니다.
- Viewer 컨트롤은 현재 번체 중국어입니다. 이 제품 페이지와 가이드는 다국어입니다. 공개 데모는 고정된 합성 frontend export이고 실제 통합은 소스를 감시합니다. 실제 iPad 성능은 측정하지 않았습니다.

합성 데이터 · 앱 backend 없음 · 로그인 불필요 · API 키 불필요

[Safari 기술 글](https://tomtang3.ai/blog/app-canvas-safari-rendering/)

상세 API, 네이티브 절차, 대안, 릴리스 관리는 영어 README와 에이전트 가이드를 참고하세요. [English README](README.md) · [MIT](LICENSE)
