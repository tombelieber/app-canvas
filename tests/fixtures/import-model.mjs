export function documentFixture(id = "doc-a") {
  return { version: 1, id, viewport: { width: 1440, height: 1000 }, height: 1000, fonts: [], issues: [],
    root: { id: "n1", tag: "body", attrs: {}, style: { margin: "0px", color: "rgb(20, 30, 40)" }, children: [
      { id: "n2", tag: "h1", attrs: {}, style: { "font-size": "32px" }, children: [{ id: "n3", text: "Calendar" }] },
      { id: "n4", tag: "div", attrs: {}, style: { width: "200px", height: "100px" }, children: [{ id: "n5", text: "Card" }] },
    ] } };
}
export function projectFixture() {
  return { kind: "web-import", version: 1, revision: 0, title: "Product reference", viewport: { width: 1440, height: 1000 },
    screens: [{ id: "screen-a", title: "Calendar", pageId: "/calendar", url: "https://example.test/calendar", documentId: "doc-a", capturedAt: "2026-10-19T00:00:00.000Z", quality: "captured", issues: [] }],
    flows: [], observations: [], assets: [], history: [], cursor: 0 };
}
export function captureFixture(id = "doc-a") {
  return { document: documentFixture(id), assets: [], source: { url: "https://example.test/calendar", title: "Calendar", reason: "manual" } };
}
