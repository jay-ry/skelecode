"use client";
import { useState, useRef } from "react";
import Link from "next/link";
import JSZip from "jszip";
import { Header } from "../../components/Header";
import { useProjectContext, type Sprint } from "../../context/ProjectContext";
import { SprintList } from "../../components/SprintList";

function formatSprintMarkdown(sprint: Sprint): string {
  const lines: string[] = [
    `# Sprint ${sprint.number}: ${sprint.goal}`,
    "",
    "## User Stories",
    ...sprint.user_stories.map((s) => `- ${s}`),
    "",
    "## Technical Tasks",
    ...sprint.technical_tasks.map((t) => `- ${t}`),
    "",
    "## Definition of Done",
    ...sprint.definition_of_done.map((d) => `- ${d}`),
    "",
  ];
  return lines.join("\n");
}

export default function SprintsPage() {
  const { projectMd, sprints, setSprints, projectId } = useProjectContext();
  const [isGenerating, setIsGenerating] = useState<boolean>(false);
  const [isDone, setIsDone] = useState<boolean>(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  // Ref-backed accumulator so the [DONE] handler can read the full sprint list
  // without relying on state (which would be stale in the closure) or performing
  // side-effectful fetches inside a state updater function.
  const accumulatedSprintsRef = useRef<Sprint[]>([]);

  // Pitfall 3 guard: direct /sprints URL access without first brainstorming
  const noProject = projectMd.trim().length === 0;

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

            // Read from the ref (not state) to avoid stale-closure issues.
            // The fetch runs outside the state setter — state updaters must be pure.
            const accumulatedSprints = accumulatedSprintsRef.current;
            setSprints(accumulatedSprints);

            if (projectId && accumulatedSprints.length > 0) {
              fetch(`/api/projects/${projectId}/sprints`, {
                method: "PUT",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ sprints: accumulatedSprints }),
              })
                .then((res) => {
                  if (!res.ok) {
                    console.warn(
                      "[SprintsPage] Sprint save failed with status",
                      res.status,
                    );
                  }
                })
                .catch((e) => {
                  console.warn("[SprintsPage] Sprint auto-save skipped", e);
                });
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
            // Partial JSON — skip; next chunk will complete it
          }
        }
      }
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : String(err));
      setIsGenerating(false);
    }
  };

  const handleDownloadAll = async () => {
    // Guard — should not trigger while disabled, but defensive anyway (D-04)
    if (isGenerating || sprints.length === 0) return;

    const zip = new JSZip();
    for (const sprint of sprints) {
      zip.file(`sprint-${sprint.number}.md`, formatSprintMarkdown(sprint));
    }

    const blob = await zip.generateAsync({ type: "blob" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "sprints.zip"; // CONTEXT.md specifics: sprints.zip
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const downloadDisabled = isGenerating || sprints.length === 0;

  return (
    <div className="flex flex-col h-screen bg-[#020408]">
      <Header
        backHref="/"
        backLabel="← Brainstorm"
        onDownload={handleDownloadAll}
        downloadDisabled={downloadDisabled}
        downloadLabel="Download all (.zip)"
      />

      {/* Content */}
      <div className="flex flex-1 flex-col overflow-y-auto px-6 py-4 min-h-0">
        {noProject ? (
          <div className="flex flex-1 flex-col items-center justify-center gap-2 text-[#7abfb8] text-sm">
            <p className="font-semibold text-[#c8f0ea]">No project loaded</p>
            <p>
              Return to{" "}
              <Link href="/" className="underline text-[#00ffe0] hover:text-[#c8f0ea] transition-colors">
                Brainstorm
              </Link>{" "}
              to generate a project spec first.
            </p>
          </div>
        ) : (
          <>
            {/* Generate Sprints CTA — hidden once generation has started */}
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
