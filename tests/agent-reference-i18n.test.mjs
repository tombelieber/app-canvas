import test from "node:test";
import assert from "node:assert/strict";
import { createRequire } from "node:module";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { build } from "esbuild";

const result = await build({
  stdin: {
    contents: 'export {AgentReference} from "./ui/AgentReference.jsx"; export {I18nProvider} from "./ui/i18n.jsx";',
    resolveDir: new URL("../", import.meta.url).pathname,
    loader: "jsx",
  },
  bundle: true, write: false, format: "cjs", platform: "node",
  external: ["react"], loader: { ".css": "empty" },
});
const compiled = { exports: {} };
new Function("require", "module", "exports", result.outputFiles[0].text)(createRequire(import.meta.url), compiled, compiled.exports);
const { AgentReference, I18nProvider } = compiled.exports;

function render(locale, properties = {}) {
  const original = Object.getOwnPropertyDescriptor(globalThis, "location");
  const storage = Object.getOwnPropertyDescriptor(globalThis, "localStorage");
  Object.defineProperty(globalThis, "localStorage", { configurable: true, value: { getItem() { return null; } } });
  Object.defineProperty(globalThis, "location", { configurable: true, value: { search: `?lang=${locale}` } });
  try {
    return renderToStaticMarkup(React.createElement(I18nProvider, null, React.createElement(AgentReference, {
      project: "Synthetic example", screen: { id: "capture-home", title: "Capture" },
      element: { tag: "button", selector: "button#manual" }, canPick: true, onPick() {}, ...properties,
    })));
  } finally {
    if (original) Object.defineProperty(globalThis, "location", original);
    else delete globalThis.location;
    if (storage) Object.defineProperty(globalThis, "localStorage", storage);
    else delete globalThis.localStorage;
  }
}

test("the real reference component localizes Traditional Chinese controls without altering source selectors", () => {
  const html = render("zh-TW");
  assert.ok(html.includes('<h3>同 Agent 一齊修改</h3>'));
  assert.ok(html.includes('aria-label="同 Agent 一齊修改"'));
  assert.ok(html.includes("指向 UI 元素</button>"));
  assert.ok(html.includes("已選取元素："));
  assert.ok(html.includes('aria-label="想修改甚麼？"'));
  assert.ok(html.includes('placeholder="令呢個按鈕更容易搵到。"'));
  assert.ok(html.includes("複製修改要求</button>"));
  assert.ok(html.includes("只會喺你要求時複製。Agent Canvas 唔會將要求傳送到 AI 服務。"));
  assert.ok(html.includes("<code>button#manual</code>"));
  assert.ok(!html.includes("Point to an element</button>"));
  assert.ok(!html.includes("Copy change request</button>"));
});

test("pointing guidance and imported-capture boundary use the viewer locale", () => {
  const picking = render("zh-TW", { picking: true });
  assert.ok(picking.includes("取消指向</button>"));
  assert.ok(picking.includes("按一下預覽內嘅元素；唔會執行原本操作。按 Escape 取消。"));
  const imported = render("zh-TW", { imported: true });
  assert.ok(imported.includes("呢個係本機擷取嘅設計版本。Agent 需要對應嘅原始專案先可以套用修改。"));
});

test("English reference control names used by the public workflow remain unchanged", () => {
  const html = render("en");
  assert.ok(html.includes('<h3>Change with your agent</h3>'));
  assert.ok(html.includes("Point to an element</button>"));
  assert.ok(html.includes('aria-label="What should change?"'));
  assert.ok(html.includes("Copy change request</button>"));
  assert.ok(html.includes("<code>button#manual</code>"));
});

test("all eleven viewer locales render their own reference heading rather than English fallback", () => {
  const headings = {
    en: "Change with your agent", "zh-TW": "同 Agent 一齊修改", "zh-CN": "与 Agent 一起修改",
    ja: "エージェントと変更する", es: "Cambiar con tu agente", fr: "Modifier avec votre agent",
    de: "Mit deinem Agenten ändern", pt: "Alterar com o seu agente", it: "Modifica con il tuo agente",
    ko: "에이전트와 함께 수정", nl: "Wijzigen met je agent",
  };
  for (const [locale, heading] of Object.entries(headings)) {
    const html = render(locale);
    assert.ok(html.includes(`<h3>${heading}</h3>`), `${locale} renders its own heading`);
    assert.ok(html.includes("<code>button#manual</code>"));
    if (locale !== "en") assert.ok(!html.includes("Copy change request</button>"));
  }
});
