"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Header } from "../components/Header";

interface ProjectRow {
  id: string;
  name: string;
  createdAt: string;
  projectMd: string | null;
}

export default function DashboardPage() {
  const router = useRouter();

  const [projects, setProjects] = useState<ProjectRow[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [openingId, setOpeningId] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    fetch("/api/projects")
      .then((res) => {
        if (!res.ok) throw new Error(`Failed to load projects (${res.status})`);
        return res.json() as Promise<ProjectRow[]>;
      })
      .then((rows) => {
        if (!cancelled) setProjects(rows);
      })
      .catch((e) => {
        if (!cancelled) setError(e instanceof Error ? e.message : String(e));
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => { cancelled = true; };
  }, []);

  const handleOpen = (projectId: string) => {
    setOpeningId(projectId);
    router.push(`/chat/${projectId}`);
  };

  const handleNewProject = () => {
    router.push("/chat");
  };

  return (
    <div className="flex flex-col min-h-screen bg-[#020408]">
      <Header />

      <main className="flex-1 px-6 py-8 max-w-4xl mx-auto w-full">
        <div className="flex items-center justify-between mb-6">
          <h1 className="text-2xl font-mono text-[#00ffe0]">Your Projects</h1>
          <button
            type="button"
            onClick={handleNewProject}
            className="text-sm px-3 py-1 border border-[rgba(0,255,224,0.15)] rounded text-[#c8f0ea] hover:bg-[#050d14] hover:border-[#00ffe0] transition-colors"
          >
            + New Project
          </button>
        </div>

        {loading && (
          <p className="text-sm text-[#7abfb8]">Loading projects...</p>
        )}

        {error && !loading && (
          <p className="text-sm text-[#ff003c]">{error}</p>
        )}

        {!loading && !error && projects.length === 0 && (
          <div className="flex flex-col items-center justify-center py-16 gap-3">
            <p className="text-sm text-[#7abfb8]">
              No projects yet — start a brainstorm to create your first one.
            </p>
            <button
              type="button"
              onClick={handleNewProject}
              className="text-sm px-4 py-2 border border-[rgba(0,255,224,0.15)] rounded text-[#c8f0ea] hover:bg-[#050d14] hover:border-[#00ffe0] transition-colors"
            >
              Start brainstorming
            </button>
          </div>
        )}

        {!loading && !error && projects.length > 0 && (
          <ul className="flex flex-col gap-2">
            {projects.map((project) => (
              <li
                key={project.id}
                className="flex items-center justify-between border border-[rgba(0,255,224,0.15)] rounded px-4 py-3 hover:border-[#00ffe0] transition-colors"
              >
                <div className="flex flex-col">
                  <span className="text-sm text-[#c8f0ea] font-semibold">{project.name}</span>
                  <span className="text-xs text-[#7abfb8]">
                    {new Date(project.createdAt).toLocaleDateString()}
                  </span>
                </div>
                <button
                  type="button"
                  onClick={() => handleOpen(project.id)}
                  disabled={openingId === project.id}
                  className="text-sm px-3 py-1 border border-[rgba(0,255,224,0.15)] rounded text-[#c8f0ea] hover:bg-[#050d14] hover:border-[#00ffe0] transition-colors disabled:opacity-40"
                >
                  {openingId === project.id ? "Opening..." : "Open"}
                </button>
              </li>
            ))}
          </ul>
        )}
      </main>
    </div>
  );
}
