"use client";
import { useState } from "react";
import Link from "next/link";
import { useProjectContext, type Sprint } from "../../context/ProjectContext";
import { SprintList } from "../../components/SprintList";

export default function SprintsPage() {
  const { projectMd, sprints, setSprints } = useProjectContext();
  const [isGenerating, setIsGenerating] = useState<boolean>(false);
  const [isDone, setIsDone] = useState<boolean>(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // Pitfall 3 guard: direct /sprints URL access without first brainstorming
  const noProject = projectMd.trim().length === 0;

  const handleGenerate = async () => {
    if (noProject || isGenerating) return;

    setSprints([]);
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
            return;
          }

          try {
            const event = JSON.parse(payload);
            if (event.node === "sprint" && event.data) {
              setSprints((prev: Sprint[]) => [...prev, event.data as Sprint]);
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

  // Plan 02-03 will replace this stub with a real JSZip handler.
  const handleDownloadAll = () => {
    // TODO (02-03): build zip from sprints and trigger download
  };

  const downloadDisabled = !isDone || sprints.length === 0;

  return (
    <div className="flex flex-col h-screen">
      {/* Header — matches Phase 1 header exactly per UI-SPEC */}
      <header className="flex items-center justify-between px-6 py-3 border-b border-gray-200 bg-white shrink-0">
        <span className="font-mono text-sm font-semibold tracking-tight text-gray-800">
          SkeleCode
        </span>
        <div className="flex items-center gap-2">
          <Link
            href="/"
            className="text-sm px-3 py-1 border border-gray-300 rounded hover:bg-gray-50 transition-colors"
          >
            ← Brainstorm
          </Link>
          <button
            type="button"
            onClick={handleDownloadAll}
            disabled={downloadDisabled}
            className="text-sm px-3 py-1 border border-gray-300 rounded hover:bg-gray-50 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
          >
            Download all (.zip)
          </button>
        </div>
      </header>

      {/* Content */}
      <div className="flex flex-1 flex-col overflow-y-auto px-6 py-4 min-h-0">
        {noProject ? (
          <div className="flex flex-1 flex-col items-center justify-center gap-2 text-gray-400 text-sm">
            <p className="font-semibold text-gray-600">No project loaded</p>
            <p>
              Return to{" "}
              <Link href="/" className="underline">
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
                <p className="text-sm text-gray-600">
                  Click Generate Sprints to break your project into Scrum sprints.
                </p>
                <button
                  type="button"
                  onClick={handleGenerate}
                  className="text-sm px-4 py-2 border border-gray-300 rounded hover:bg-gray-50 transition-colors"
                >
                  Generate Sprints
                </button>
              </div>
            )}

            {errorMsg && (
              <div className="flex flex-col items-center gap-2 py-4">
                <p className="text-sm text-red-600">
                  Sprint generation failed. Check your connection and try again.
                </p>
                <button
                  type="button"
                  onClick={handleGenerate}
                  className="text-sm px-3 py-1 border border-gray-300 rounded hover:bg-gray-50 transition-colors"
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
