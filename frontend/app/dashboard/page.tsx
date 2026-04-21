"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Header } from "../../components/Header";
import { useProjectContext, type Sprint } from "../../context/ProjectContext";

interface ProjectRow {
  id: string;
  name: string;
  createdAt: string;
  projectMd: string | null;
}

interface SprintRowApi {
  id: string;
  projectId: string;
  sprintNumber: number;
  goal: string | null;
  contentMd: string | null;
  sprintData: unknown;
  createdAt: string;
}

interface ProjectWithSprintsResponse extends ProjectRow {
  userId: string;
  updatedAt: string;
  sprints: SprintRowApi[];
}

export default function DashboardPage() {
  const router = useRouter();
  const { setProjectMd, setSprints, setProjectId } = useProjectContext();

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
    return () => {
      cancelled = true;
    };
  }, []);

  const handleOpen = async (projectId: string) => {
    setOpeningId(projectId);
    try {
      const res = await fetch(`/api/projects/${projectId}`);
      if (!res.ok) throw new Error(`Failed to open project (${res.status})`);
      const data = (await res.json()) as ProjectWithSprintsResponse;

      setProjectMd(data.projectMd ?? "");
      setProjectId(data.id);

      // Rehydrate sprints: server stores the full Sprint object in `sprintData` JSONB (Plan 04 Task 2).
      const rehydratedSprints: Sprint[] = (data.sprints ?? [])
        .map((row) => {
          const blob = row.sprintData as Partial<Sprint> | null;
          return {
            number: blob?.number ?? row.sprintNumber,
            goal: blob?.goal ?? row.goal ?? "",
            user_stories: blob?.user_stories ?? [],
            technical_tasks: blob?.technical_tasks ?? [],
            definition_of_done: blob?.definition_of_done ?? [],
          };
        })
        .sort((a, b) => a.number - b.number);

      setSprints(rehydratedSprints);
      router.push("/sprints");
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
      setOpeningId(null);
    }
  };

  const handleNewProject = () => {
    setProjectMd("");
    setSprints([]);
    setProjectId(null);
    router.push("/");
  };

  return (
    <div className="flex flex-col min-h-screen bg-[#020408]">
      <Header backHref="/" backLabel="← Brainstorm" />

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
