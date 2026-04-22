"use client";
import { useState, useRef, useEffect } from "react";
import Link from "next/link";
import JSZip from "jszip";
import { Header } from "../../components/Header";
import { useProjectContext } from "../../context/ProjectContext";
import { FolderTree } from "../../components/FolderTree";
import { WireframePreview } from "../../components/WireframePreview";

/**
 * /skeleton — Phase 4 page.
 *
 * Two-panel layout:
 *   Left: streamed ASCII folder tree (FolderTree component — post-streaming collapse/expand enabled)
 *   Right: Sprint 1 HTML wireframe (WireframePreview component with sandboxed iframe)
 *
 * Flow:
 *   1. On mount — if projectId present, GET /api/projects/{id}/skeleton to restore state.
 *   2. User clicks Generate Skeleton -> POST /api/skeleton with {project_md, sprints}.
 *   3. SSE loop parses {type:"tree_line"}, {type:"wireframe"}, ends on [DONE].
 *   4. On [DONE] — PUT /api/projects/{projectId}/skeleton with the accumulated result.
 *
 * IMPORTANT (RESEARCH.md Pitfall 2): useRef accumulators mirror state so the
 * [DONE] handler reads the FINAL accumulated value, not a stale closure.
 */
export default function SkeletonPage() {
  const { projectMd, sprints, projectId } = useProjectContext();

  const [isGenerating, setIsGenerating] = useState<boolean>(false);
  const [isDone, setIsDone] = useState<boolean>(false);
  const [folderTree, setFolderTree] = useState<string>("");
  const [wireframeHtml, setWireframeHtml] = useState<string>("");
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [saveStatus, setSaveStatus] = useState<"idle" | "saved" | "failed">("idle");
  const [isLoadingSaved, setIsLoadingSaved] = useState<boolean>(false);

  // Refs mirror state so [DONE] handler can read latest values (stale-closure fix).
  const folderTreeRef = useRef<string>("");
  const wireframeHtmlRef = useRef<string>("");

  const noSprints = sprints.length === 0;

  // Hardcoded stub Sprint 1 — used only if user hits /skeleton without completing
  // the sprint planner (CONTEXT.md "Stub / Mock Strategy"). Lets dev/test flow run.
  const stubSprint = {
    number: 1,
    goal: "Initial project setup",
    user_stories: ["As a developer, I want a runnable project shell"],
    technical_tasks: ["Create project structure", "Add minimal index route"],
    definition_of_done: ["Navigate to / -> page renders"],
  };

  // --- Page mount: restore saved skeleton if one exists for this project ---
  useEffect(() => {
    if (!projectId) return;
    setIsLoadingSaved(true);
    fetch(`/api/projects/${projectId}/skeleton`)
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (data?.folder_tree) {
          setFolderTree(data.folder_tree);
          folderTreeRef.current = data.folder_tree;
        }
        if (data?.wireframe_html) {
          setWireframeHtml(data.wireframe_html);
          wireframeHtmlRef.current = data.wireframe_html;
        }
        if (data?.folder_tree || data?.wireframe_html) {
          setIsDone(true);
        }
      })
      .catch(() => {
        // Silent — unsaved project is a valid state
      })
      .finally(() => setIsLoadingSaved(false));
  }, [projectId]);

  // --- Generate handler ---
  const handleGenerate = async () => {
    if (isGenerating) return;

    // Reset state for a new generation cycle.
    setIsGenerating(true);
    setIsDone(false);
    setErrorMsg(null);
    setSaveStatus("idle");
    setFolderTree("");
    setWireframeHtml("");
    folderTreeRef.current = "";
    wireframeHtmlRef.current = "";

    const sprintsPayload = sprints.length > 0 ? sprints : [stubSprint];

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

            // Read from refs (not state — stale closure). Save runs outside setter.
            if (projectId) {
              fetch(`/api/projects/${projectId}/skeleton`, {
                method: "PUT",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                  folder_tree: folderTreeRef.current,
                  wireframe_html: wireframeHtmlRef.current,
                }),
              })
                .then((res) => {
                  setSaveStatus(res.ok ? "saved" : "failed");
                  if (!res.ok) {
                    console.warn("[SkeletonPage] Save failed with status", res.status);
                  }
                })
                .catch((e) => {
                  setSaveStatus("failed");
                  console.warn("[SkeletonPage] Save skipped", e);
                });
            }
            return;
          }

          try {
            const event = JSON.parse(payload);
            // NOTE: uses 'type' key, not 'node' key (Phase 4 event-shape contract).
            if (event.type === "tree_line") {
              const nextLine = event.line as string;
              folderTreeRef.current = folderTreeRef.current
                ? folderTreeRef.current + "\n" + nextLine
                : nextLine;
              setFolderTree(folderTreeRef.current);
            } else if (event.type === "wireframe") {
              wireframeHtmlRef.current = event.html as string;
              setWireframeHtml(event.html as string);
            } else if (event.type === "error") {
              setErrorMsg(event.reason ?? "Unknown backend error");
            }
          } catch {
            // Partial JSON — skip; next chunk completes it.
          }
        }
      }
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : String(err));
      setIsGenerating(false);
    }
  };

  // --- Download skeleton.zip ---
  const handleDownload = async () => {
    if (isGenerating || !isDone || folderTree === "" || wireframeHtml === "") return;
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

  const downloadDisabled = isGenerating || !isDone || folderTree === "" || wireframeHtml === "";

  // --- CTA button label ---
  const ctaLabel = isGenerating ? "Generating..." : isDone ? "Regenerate" : "Generate Skeleton";

  return (
    <div className="flex flex-col h-screen bg-[#020408]">
      <Header
        backHref="/sprints"
        backLabel="← Sprints"
        onDownload={handleDownload}
        downloadDisabled={downloadDisabled}
        downloadLabel="Download skeleton.zip"
      />

      {/* Empty state: no sprints in context */}
      {noSprints && !isLoadingSaved && !isDone ? (
        <div className="flex flex-1 flex-col items-center justify-center gap-2 text-[#7abfb8] text-sm">
          <p className="font-semibold text-[#c8f0ea]">No sprints yet</p>
          <p>
            Complete the sprint planner first, then return here to generate your skeleton.
          </p>
          <Link
            href="/sprints"
            className="underline text-[#00ffe0] hover:text-[#c8f0ea] transition-colors"
          >
            Plan your sprints →
          </Link>
        </div>
      ) : (
        <>
          {/* Generate / Regenerate CTA row */}
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
            {saveStatus === "saved" && (
              <span className="text-sm text-[#00ffe0]">Saved ✓</span>
            )}
            {saveStatus === "failed" && (
              <span className="text-sm text-[#ff003c]" role="alert">
                Save failed — try regenerating
              </span>
            )}
          </div>

          {errorMsg && (
            <div className="flex flex-col items-center gap-2 pb-4" role="alert">
              <p className="text-sm text-[#ff003c]">
                Skeleton generation failed. Check your connection and try again.
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

          {/* Two-panel layout */}
          <div className="flex flex-1 overflow-hidden min-h-0">
            {/* Left: FOLDER STRUCTURE */}
            <div className="w-1/2 flex flex-col border-r border-[rgba(0,255,224,0.15)] overflow-y-auto p-4">
              <div className="text-xs font-semibold uppercase tracking-wide text-[#00ffe0] font-mono mb-3">
                FOLDER STRUCTURE
              </div>
              {isLoadingSaved ? (
                <div className="text-[#7abfb8] text-sm">Loading...</div>
              ) : (
                <FolderTree tree={folderTree} isGenerating={isGenerating} />
              )}
            </div>

            {/* Right: SPRINT 1 WIREFRAME */}
            <div className="w-1/2 flex flex-col overflow-hidden p-4">
              <div className="text-xs font-semibold uppercase tracking-wide text-[#00ffe0] font-mono mb-3">
                SPRINT 1 WIREFRAME
              </div>
              {isLoadingSaved ? (
                <div className="text-[#7abfb8] text-sm">Loading...</div>
              ) : (
                <WireframePreview html={wireframeHtml} isLoading={isGenerating} />
              )}
            </div>
          </div>
        </>
      )}
    </div>
  );
}
