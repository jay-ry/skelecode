"use client";
import { useState, useRef, useEffect } from "react";
import { useParams } from "next/navigation";
import JSZip from "jszip";
import { Header } from "../../../components/Header";
import { FolderTree } from "../../../components/FolderTree";
import { WireframePreview } from "../../../components/WireframePreview";

interface Sprint {
  number: number;
  goal: string;
  user_stories: string[];
  technical_tasks: string[];
  definition_of_done: string[];
}

interface SprintRowApi {
  sprintNumber: number;
  goal: string | null;
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
      return {
        number: blob?.number ?? row.sprintNumber,
        goal: blob?.goal ?? row.goal ?? "",
        user_stories: blob?.user_stories ?? [],
        technical_tasks: blob?.technical_tasks ?? [],
        definition_of_done: blob?.definition_of_done ?? [],
      };
    })
    .sort((a, b) => a.number - b.number);
}

const STUB_SPRINT: Sprint = {
  number: 1,
  goal: "Initial project setup",
  user_stories: ["As a developer, I want a runnable project shell"],
  technical_tasks: ["Create project structure", "Add minimal index route"],
  definition_of_done: ["Navigate to / -> page renders"],
};

export default function SkeletonPage() {
  const { id: projectId } = useParams<{ id: string }>();

  const [projectMd, setProjectMd] = useState<string>("");
  const [sprints, setSprints] = useState<Sprint[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  const [isGenerating, setIsGenerating] = useState<boolean>(false);
  const [isDone, setIsDone] = useState<boolean>(false);
  const [folderTree, setFolderTree] = useState<string>("");
  const [wireframeHtml, setWireframeHtml] = useState<string>("");
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [saveStatus, setSaveStatus] = useState<"idle" | "saved" | "failed">("idle");

  const folderTreeRef = useRef<string>("");
  const wireframeHtmlRef = useRef<string>("");

  // Load project and saved skeleton on mount
  useEffect(() => {
    const load = async () => {
      try {
        const [projectRes, skeletonRes] = await Promise.all([
          fetch(`/api/projects/${projectId}`),
          fetch(`/api/projects/${projectId}/skeleton`),
        ]);

        if (!projectRes.ok) throw new Error(`Failed to load project (${projectRes.status})`);
        const project = (await projectRes.json()) as ProjectResponse;
        setProjectMd(project.projectMd ?? "");
        setSprints(rehydrateSprints(project.sprints ?? []));

        if (skeletonRes.ok) {
          const saved = await skeletonRes.json() as { folder_tree: string | null; wireframe_html: string | null };
          if (saved.folder_tree) {
            setFolderTree(saved.folder_tree);
            folderTreeRef.current = saved.folder_tree;
          }
          if (saved.wireframe_html) {
            setWireframeHtml(saved.wireframe_html);
            wireframeHtmlRef.current = saved.wireframe_html;
          }
          if (saved.folder_tree || saved.wireframe_html) setIsDone(true);
        }
      } catch (e) {
        setLoadError(e instanceof Error ? e.message : String(e));
      } finally {
        setIsLoading(false);
      }
    };
    load();
  }, [projectId]);

  const handleGenerate = async () => {
    if (isGenerating) return;
    setIsGenerating(true);
    setIsDone(false);
    setErrorMsg(null);
    setSaveStatus("idle");
    setFolderTree("");
    setWireframeHtml("");
    folderTreeRef.current = "";
    wireframeHtmlRef.current = "";

    const sprintsPayload = sprints.length > 0 ? sprints : [STUB_SPRINT];

    try {
      const response = await fetch("/api/skeleton", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ project_md: projectMd, sprints: sprintsPayload }),
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

            try {
              const saveRes = await fetch(`/api/projects/${projectId}/skeleton`, {
                method: "PUT",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                  folder_tree: folderTreeRef.current,
                  wireframe_html: wireframeHtmlRef.current,
                }),
              });
              setSaveStatus(saveRes.ok ? "saved" : "failed");
            } catch {
              setSaveStatus("failed");
            }
            return;
          }

          try {
            const event = JSON.parse(payload);
            if (event.type === "tree_line") {
              const next = folderTreeRef.current
                ? `${folderTreeRef.current}\n${event.line}`
                : event.line;
              folderTreeRef.current = next;
              setFolderTree(next);
            } else if (event.type === "wireframe") {
              wireframeHtmlRef.current = event.html;
              setWireframeHtml(event.html);
            } else if (event.type === "error") {
              setErrorMsg(event.reason ?? "Unknown backend error");
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

  const handleDownload = async () => {
    if (isGenerating || !isDone || !folderTree || !wireframeHtml) return;
    const zip = new JSZip();
    zip.file("structure.txt", folderTree);
    zip.file("wireframe.html", wireframeHtml);
    const blob = await zip.generateAsync({ type: "blob" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "skeleton.zip";
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const noSprints = !isLoading && sprints.length === 0;
  const ctaLabel = isGenerating ? "Generating..." : isDone ? "Regenerate" : "Generate Skeleton";

  if (isLoading) {
    return (
      <div className="flex flex-col h-screen bg-[#020408]">
        <Header projectId={projectId} backHref={`/sprints/${projectId}`} backLabel="← Sprints" />
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
        backHref={`/sprints/${projectId}`}
        backLabel="← Sprints"
        onDownload={handleDownload}
        downloadDisabled={isGenerating || !isDone || !folderTree || !wireframeHtml}
        downloadLabel="Download skeleton.zip"
      />

      {noSprints && !isDone ? (
        <div className="flex flex-1 flex-col items-center justify-center gap-2 text-[#7abfb8] text-sm">
          <p className="font-semibold text-[#c8f0ea]">No sprints yet</p>
          <p>Complete the sprint planner first, then return here to generate your skeleton.</p>
          <a href={`/sprints/${projectId}`} className="underline text-[#00ffe0] hover:text-[#c8f0ea] transition-colors">
            Plan your sprints →
          </a>
        </div>
      ) : (
        <>
          <div className="flex items-center justify-center gap-4 py-6">
            {!isDone && !isGenerating && (
              <p className="text-sm text-[#7abfb8]">
                Click Generate Skeleton to build your folder structure and Sprint 1 wireframe.
              </p>
            )}
            <button
              type="button"
              onClick={handleGenerate}
              disabled={isGenerating}
              aria-busy={isGenerating}
              className="text-sm px-4 py-2 border border-[rgba(0,255,224,0.15)] rounded text-[#c8f0ea] hover:bg-[#050d14] hover:border-[#00ffe0] transition-colors disabled:opacity-40 disabled:cursor-not-allowed focus:outline-none focus:ring-1 focus:ring-[#00ffe0]"
            >
              {ctaLabel}
            </button>
            {saveStatus === "saved" && <span className="text-sm text-[#00ffe0]">Saved ✓</span>}
            {saveStatus === "failed" && <span className="text-sm text-[#ff003c]" role="alert">Save failed — try regenerating</span>}
          </div>

          {loadError && <p className="text-sm text-[#ff003c] text-center pb-4">{loadError}</p>}

          {errorMsg && (
            <div className="flex flex-col items-center gap-2 pb-4" role="alert">
              <p className="text-sm text-[#ff003c]">Skeleton generation failed. Check your connection and try again.</p>
              <button type="button" onClick={handleGenerate} className="text-sm px-3 py-1 border border-[rgba(0,255,224,0.15)] rounded text-[#c8f0ea] hover:bg-[#050d14] hover:border-[#00ffe0] transition-colors">
                Try again
              </button>
            </div>
          )}

          <div className="flex flex-1 overflow-hidden min-h-0">
            <div className="w-1/2 flex flex-col border-r border-[rgba(0,255,224,0.15)] overflow-y-auto p-4">
              <div className="text-xs font-semibold uppercase tracking-wide text-[#00ffe0] font-mono mb-3">FOLDER STRUCTURE</div>
              <FolderTree tree={folderTree} isGenerating={isGenerating} />
            </div>
            <div className="w-1/2 flex flex-col overflow-hidden p-4">
              <div className="text-xs font-semibold uppercase tracking-wide text-[#00ffe0] font-mono mb-3">SPRINT 1 WIREFRAME</div>
              <WireframePreview html={wireframeHtml} isLoading={isGenerating} />
            </div>
          </div>
        </>
      )}
    </div>
  );
}
