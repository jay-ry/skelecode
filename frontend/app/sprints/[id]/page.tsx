"use client";
import { useState, useRef, useEffect } from "react";
import { useParams } from "next/navigation";
import JSZip from "jszip";
import { Header } from "../../../components/Header";
import { SprintList } from "../../../components/SprintList";
import type { Sprint } from "../../../types/sprint";

interface SprintRowApi {
  sprintNumber: number;
  goal: string | null;
  contentMd: string | null;
  sprintData: Partial<Sprint> | null;
}

interface ProjectResponse {
  id: string;
  projectMd: string | null;
  sprints: SprintRowApi[];
}

function rehydrateSprints(rows: SprintRowApi[]): Sprint[] {
  return rows
    .map((row) => {
      const blob = row.sprintData;
      // Prefer the dedicated contentMd column; fall back to a content_md
      // embedded in legacy sprintData blobs; finally an empty string so
      // the type is satisfied (SprintCard treats "" as "use legacy fallback").
      const contentMd =
        row.contentMd ??
        (typeof blob?.content_md === "string" ? blob.content_md : null) ??
        "";
      return {
        number: blob?.number ?? row.sprintNumber,
        goal: blob?.goal ?? row.goal ?? "",
        content_md: contentMd,
        user_stories: blob?.user_stories ?? [],
        technical_tasks: blob?.technical_tasks ?? [],
        definition_of_done: blob?.definition_of_done ?? [],
      };
    })
    .sort((a, b) => a.number - b.number);
}

function formatSprintMarkdown(sprint: Sprint): string {
  return [
    `# Sprint ${sprint.number}: ${sprint.goal}`,
    "",
    "## User Stories",
    ...(sprint.user_stories ?? []).map((s) => `- ${s}`),
    "",
    "## Technical Tasks",
    ...(sprint.technical_tasks ?? []).map((t) => `- ${t}`),
    "",
    "## Definition of Done",
    ...(sprint.definition_of_done ?? []).map((d) => `- ${d}`),
    "",
  ].join("\n");
}

export default function SprintsPage() {
  const { id: projectId } = useParams<{ id: string }>();

  const [projectMd, setProjectMd] = useState<string>("");
  const [sprints, setSprints] = useState<Sprint[]>([]);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);

  const [isGenerating, setIsGenerating] = useState<boolean>(false);
  const [isDone, setIsDone] = useState<boolean>(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const accumulatedSprintsRef = useRef<Sprint[]>([]);

  // Load project on mount
  useEffect(() => {
    fetch(`/api/projects/${projectId}`)
      .then((res) => {
        if (!res.ok) throw new Error(`Failed to load project (${res.status})`);
        return res.json() as Promise<ProjectResponse>;
      })
      .then((data) => {
        setProjectMd(data.projectMd ?? "");
        setSprints(rehydrateSprints(data.sprints ?? []));
        if ((data.sprints ?? []).length > 0) setIsDone(true);
      })
      .catch((e) => setLoadError(e instanceof Error ? e.message : String(e)))
      .finally(() => setIsLoading(false));
  }, [projectId]);

  const noProject = !isLoading && projectMd.trim().length === 0;

  const handleGenerate = async () => {
    if (noProject || isGenerating) return;
    setSprints([]);
    accumulatedSprintsRef.current = [];
    setIsDone(false);
    setErrorMsg(null);
    setIsGenerating(true);

    try {
      const response = await fetch("/api/sprint-planner", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ project_md: projectMd }),
      });

      if (!response.ok || !response.body) {
        throw new Error(`Stream failed: ${response.status}`);
      }

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split("\n");
        buffer = lines.pop() ?? "";

        for (const line of lines) {
          if (!line.startsWith("data: ")) continue;
          const payload = line.slice(6).trim();

          if (payload === "[DONE]") {
            setIsGenerating(false);
            setIsDone(true);
            const accumulated = accumulatedSprintsRef.current;
            setSprints(accumulated);

            if (accumulated.length > 0) {
              fetch(`/api/projects/${projectId}/sprints`, {
                method: "PUT",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ sprints: accumulated }),
              }).catch((e) => console.warn("[SprintsPage] Sprint auto-save skipped", e));
            }
            return;
          }

          try {
            const event = JSON.parse(payload);
            if (event.node === "sprint" && event.data) {
              accumulatedSprintsRef.current = [...accumulatedSprintsRef.current, event.data as Sprint];
              setSprints(accumulatedSprintsRef.current);
            } else if (event.node === "error") {
              setErrorMsg(event.data?.reason ?? "Unknown backend error");
            }
          } catch {
            // Partial JSON — skip
          }
        }
      }
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : String(err));
      setIsGenerating(false);
    }
  };

  const handleDownloadAll = async () => {
    if (isGenerating || sprints.length === 0) return;
    const zip = new JSZip();
    for (const sprint of sprints) {
      const md =
        sprint.content_md && sprint.content_md.trim().length > 0
          ? sprint.content_md
          : formatSprintMarkdown(sprint);
      zip.file(`sprint-${sprint.number}.md`, md);
    }
    const blob = await zip.generateAsync({ type: "blob" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "sprints.zip";
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  if (isLoading) {
    return (
      <div className="flex flex-col h-screen bg-[#020408]">
        <Header projectId={projectId} />
        <div className="flex flex-1 items-center justify-center">
          <p className="text-sm text-[#7abfb8]">Loading project...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-screen bg-[#020408]">
      <Header
        projectId={projectId}
        onDownload={handleDownloadAll}
        downloadDisabled={isGenerating || sprints.length === 0}
        downloadLabel="Download all (.zip)"
      />

      <div className="flex flex-1 flex-col overflow-y-auto px-6 py-4 min-h-0">
        {loadError && (
          <p className="text-sm text-[#ff003c] py-4">{loadError}</p>
        )}

        {noProject && !loadError && (
          <div className="flex flex-1 flex-col items-center justify-center gap-2 text-[#7abfb8] text-sm">
            <p className="font-semibold text-[#c8f0ea]">No project spec found</p>
            <a href={`/chat/${projectId}`} className="underline text-[#00ffe0] hover:text-[#c8f0ea] transition-colors">
              Back to brainstorm
            </a>
          </div>
        )}

        {!noProject && !loadError && (
          <>
            {!isGenerating && sprints.length === 0 && (
              <div className="flex flex-col items-center justify-center gap-4 py-8">
                <p className="text-sm text-[#7abfb8]">
                  Click Generate Sprints to break your project into Scrum sprints.
                </p>
                <button
                  type="button"
                  onClick={handleGenerate}
                  className="text-sm px-4 py-2 border border-[rgba(0,255,224,0.15)] rounded text-[#c8f0ea] hover:bg-[#050d14] hover:border-[#00ffe0] transition-colors"
                >
                  Generate Sprints
                </button>
              </div>
            )}

            {errorMsg && (
              <div className="flex flex-col items-center gap-2 py-4">
                <p className="text-sm text-[#ff003c]">
                  Sprint generation failed. Check your connection and try again.
                </p>
                <button
                  type="button"
                  onClick={handleGenerate}
                  className="text-sm px-3 py-1 border border-[rgba(0,255,224,0.15)] rounded text-[#c8f0ea] hover:bg-[#050d14] hover:border-[#00ffe0] transition-colors"
                >
                  Try again
                </button>
              </div>
            )}

            <div className="mt-4 flex flex-1 flex-col">
              <SprintList sprints={sprints} isGenerating={isGenerating} />
            </div>
          </>
        )}
      </div>
    </div>
  );
}
