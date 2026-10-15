import test from "node:test";
import assert from "node:assert/strict";
import { parseRoutes, checkRouteCoverage } from "../lib/routes.mjs";
import { mkdtemp, writeFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
test("React Router JSX keeps pages and redirects separate, including nested paths", () => {
  const rows = parseRoutes(
    '<Routes><Route path="/" element={<Navigate to="/home"/>}/><Route element={<AuthGate/>}><Route path="/home" element={<HomePage/>}/><Route path="/settings"><Route path="profile" element={<ProfilePage/>}/></Route></Route></Routes>',
  );
  assert.deepEqual(
    rows.map((r) => [r.path, r.component, r.kind]),
    [
      ["/", "Navigate", "redirect"],
      ["/home", "HomePage", "page"],
      ["/settings/profile", "ProfilePage", "page"],
    ],
  );
});
test("a missing catalog page and a newly added source route fail coverage", async () => {
  const root = await mkdtemp(join(tmpdir(), "app-canvas-routes-"));
  try {
    const text =
      '<Routes><Route path="/" element={<Home/>}/><Route path="/old" element={<Navigate to="/"/>}/></Routes>';
    await writeFile(join(root, "App.tsx"), text);
    await writeFile(
      join(root, "routes.json"),
      JSON.stringify(parseRoutes(text, { file: "App.tsx" })),
    );
    const project = {
      catalog: [{ path: "/" }],
      routeCoverage: [{ file: "App.tsx", snapshot: "routes.json" }],
    };
    assert.deepEqual(await checkRouteCoverage(project, root), [
      { file: "App.tsx", pages: 1, redirects: 1 },
    ]);
    await assert.rejects(
      () => checkRouteCoverage({ ...project, catalog: [] }, root),
      /Pages missing/,
    );
    await writeFile(
      join(root, "App.tsx"),
      text.replace(
        "</Routes>",
        '<Route path="/new" element={<New/>}/></Routes>',
      ),
    );
    await assert.rejects(
      () => checkRouteCoverage(project, root),
      /Route inventory changed/,
    );
  } finally {
    await rm(root, { recursive: true });
  }
});
test("object routes resolve imported path constants and wrapper components", () => {
  const rows = parseRoutes(
    'createBrowserRouter([{path:"/",element:<Layout/>,children:[{index:true,element:<HomePage/>},{path:APP_ROUTE.detail.slice(1),element:<Protected><Suspense><DetailPage/></Suspense></Protected>},{path:"old",element:<Navigate to="/"/>}]}])',
    { constants: { APP_ROUTE: { detail: "/detail/:id" } } },
  );
  assert.deepEqual(
    rows.map((r) => [r.path, r.component, r.kind]),
    [
      ["/", "HomePage", "page"],
      ["/detail/:id", "DetailPage", "page"],
      ["/old", "Navigate", "redirect"],
    ],
  );
  assert.throws(
    () => parseRoutes("createBrowserRouter([{path:UNKNOWN,element:<Page/>}])"),
    /Unresolved/,
  );
});
