import React from "react";
import { createRoot } from "react-dom/client";
import { installPreview, readScenario, waitFor, ready, failed } from "virtual:app-canvas-preview";
import example from "./catalog.json";
import { fixtureTransport } from "./fixtures.js";
const scenario = readScenario(example.catalog, { key: "tasks-example" });
installPreview({ handleFetch: fixtureTransport(scenario) });
history.replaceState(null, "", scenario.path);
try {
  // Install transport before importing application modules with side effects.
  const { default: App } = await import("../src/App.jsx");
  createRoot(document.getElementById("root")).render(<App />);
  if (scenario.id === "settings-saved") {
    await waitFor('[data-state=settings]');
    // Reach the saved state through the original form, never fixture markup.
    document.querySelector('button').click();
  }
  await waitFor(scenario.ready);
  ready();
} catch (error) { failed(error); }
