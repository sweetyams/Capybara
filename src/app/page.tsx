"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { UserButton } from "@clerk/nextjs";

interface Project {
  id: string;
  name: string;
  color: string;
  createdAt: string;
}

export default function DashboardPage() {
  const router = useRouter();
  const [projects, setProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState(true);
  const [name, setName] = useState("");
  const [creating, setCreating] = useState(false);

  useEffect(() => {
    fetch("/api/projects")
      .then((r) => r.json())
      .then((d) => setProjects(d.data ?? []))
      .finally(() => setLoading(false));
  }, []);

  async function createProject(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim() || creating) return;
    setCreating(true);
    const res = await fetch("/api/projects", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name }),
    });
    const { data } = await res.json();
    if (data) {
      setProjects((prev) => [data, ...prev]);
      setName("");
    }
    setCreating(false);
  }

  return (
    <div className="flex flex-col flex-1">
      <header className="flex items-center justify-between px-6 py-4 border-b border-zinc-200 dark:border-zinc-800">
        <h1 className="text-lg font-semibold">Capybara</h1>
        <UserButton />
      </header>

      <main className="flex-1 max-w-2xl mx-auto w-full px-6 py-10">
        <form onSubmit={createProject} className="flex gap-3 mb-8">
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="New project name…"
            className="flex-1 px-4 py-2 rounded-lg border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-900 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
          />
          <button
            type="submit"
            disabled={creating || !name.trim()}
            className="px-4 py-2 rounded-lg bg-indigo-600 text-white text-sm font-medium hover:bg-indigo-700 disabled:opacity-50"
          >
            {creating ? "…" : "Create"}
          </button>
        </form>

        {loading ? (
          <p className="text-sm text-zinc-500">Loading…</p>
        ) : projects.length === 0 ? (
          <p className="text-sm text-zinc-500">No projects yet. Create one above.</p>
        ) : (
          <div className="space-y-2">
            {projects.map((p) => (
              <button
                key={p.id}
                onClick={() => router.push(`/project/${p.id}`)}
                className="w-full flex items-center gap-3 px-4 py-3 rounded-lg border border-zinc-200 dark:border-zinc-800 hover:bg-zinc-100 dark:hover:bg-zinc-800/50 text-left transition-colors"
              >
                <span
                  className="w-3 h-3 rounded-full shrink-0"
                  style={{ backgroundColor: p.color }}
                />
                <span className="font-medium text-sm">{p.name}</span>
                <span className="ml-auto text-xs text-zinc-400">
                  {new Date(p.createdAt).toLocaleDateString()}
                </span>
              </button>
            ))}
          </div>
        )}
      </main>
    </div>
  );
}
