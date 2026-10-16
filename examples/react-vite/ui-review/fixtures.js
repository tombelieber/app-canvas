export function fixtureTransport(scenario) {
  const tasks = scenario.id === "tasks-empty" ? [] : [{ id: "one", title: "Review canvas" }, { id: "two", title: "Edit real source" }];
  let failOnce = scenario.id === "tasks-error", profile = { name: "Demo user" };
  const json = (value, status = 200) => new Response(JSON.stringify(value), { status, headers: { "Content-Type": "application/json" } });
  return async (url, options) => {
    const method = options.method || "GET";
    if (url.pathname === "/api/tasks" && method === "GET") {
      if (scenario.id === "tasks-loading") return new Promise(() => {});
      if (failOnce) { failOnce = false; return json({ error: "synthetic failure" }, 503); }
      return json(tasks);
    }
    if (url.pathname === "/api/tasks" && method === "POST") {
      const task = { id: crypto.randomUUID(), ...JSON.parse(options.body) }; tasks.push(task); return json(task, 201);
    }
    if (url.pathname === "/api/profile") {
      if (scenario.id === "settings-denied") return json({ error: "synthetic denial" }, 403);
      if (method === "PATCH") profile = { ...profile, ...JSON.parse(options.body) };
      return json(profile);
    }
    // Undefined is intentional: installPreview rejects every unknown request.
  };
}
