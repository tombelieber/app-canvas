import React, { useEffect, useState } from "react";
import { createRoot } from "react-dom/client";
function App() {
  const [draft, setDraft] = useState(""), [saved, save] = useState("");
  useEffect(() => { document.documentElement.dataset.reviewReady = "true"; }, []);
  return <main data-draft={draft} data-saved={saved}><h1>Original React runtime</h1><label>Draft<input value={draft} onChange={e => setDraft(e.target.value)} /></label>
    <button onClick={() => save(draft)}>Save</button><output>{saved}</output></main>;
}
createRoot(document.getElementById("root")).render(<App />);
