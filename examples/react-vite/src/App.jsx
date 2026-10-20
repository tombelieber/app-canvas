import React, { useEffect, useState } from "react";
import { BrowserRouter, Link, Route, Routes } from "react-router-dom";
import "./style.css";

async function api(path, options) {
  const response = await fetch(path, options);
  if (!response.ok) throw Error(response.status === 403 ? "Access denied" : "Could not load tasks");
  return response.json();
}
function Tasks() {
  const [tasks, setTasks] = useState(null), [error, setError] = useState("");
  const load = () => { setError(""); setTasks(null); api("/api/tasks").then(setTasks).catch((e) => setError(e.message)); };
  useEffect(load, []);
  if (error) return <section data-state="error"><h1>{error}</h1><button onClick={load}>Retry</button></section>;
  if (!tasks) return <p data-state="loading">Loading tasks…</p>;
  return <section data-state={tasks.length ? "populated" : "empty"}>
    <h1>Tasks</h1>{!tasks.length && <p>No tasks yet.</p>}
    <ul>{tasks.map((task) => <li key={task.id}>{task.title}</li>)}</ul>
    <form onSubmit={async (e) => {
      e.preventDefault(); const form = e.currentTarget;
      const task = await api("/api/tasks", { method: "POST", body: JSON.stringify({ title: new FormData(form).get("title") }) });
      setTasks((items) => [...items, task]); form.reset();
    }}><label>Task title<input name="title" required /></label><button>Add task</button></form>
  </section>;
}
function Settings() {
  const [profile, setProfile] = useState(null), [error, setError] = useState(""), [saved, setSaved] = useState(false);
  useEffect(() => { api("/api/profile").then(setProfile).catch((e) => setError(e.message)); }, []);
  if (error) return <section data-state="denied"><h1>{error}</h1></section>;
  if (!profile) return <p data-state="profile-loading">Loading profile…</p>;
  return <section data-state="settings"><h1>Settings</h1><form onSubmit={async (e) => {
    e.preventDefault(); const name = new FormData(e.currentTarget).get("name");
    setProfile(await api("/api/profile", { method: "PATCH", body: JSON.stringify({ name }) })); setSaved(true);
  }}><label>Display name<input name="name" defaultValue={profile.name} required /></label><button>Save profile</button></form>{saved && <p role="status">Saved {profile.name}</p>}</section>;
}
export default function App() {
  return <BrowserRouter><main><nav><Link to="/">Tasks</Link><Link to="/settings">Settings</Link></nav><Routes>
    <Route path="/" element={<Tasks />} />
    <Route path="/settings" element={<Settings />} />
  </Routes></main></BrowserRouter>;
}
