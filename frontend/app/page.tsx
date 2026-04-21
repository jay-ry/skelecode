"use client";
import { useState, useRef } from "react";
import { BrainstormChat } from "../components/BrainstormChat";
import { ProjectPreview } from "../components/ProjectPreview";
import { Header } from "../components/Header";
import { useProjectContext } from "../context/ProjectContext";

export default function BrainstormPage() {
  const { projectMd, setProjectMd, setSprints, setProjectId } = useProjectContext();

  const [markdown, setMarkdown] = useState<string>(projectMd);
  const [isStreaming, setIsStreaming] = useState<boolean>(false);
  const [hasError, setHasError] = useState<boolean>(false);
  const [previewOpen, setPreviewOpen] = useState<boolean>(true);
  const [splitPercent, setSplitPercent] = useState<number>(40);

  const containerRef = useRef<HTMLDivElement>(null);
  const isDragging = useRef(false);

  const handleDividerMouseDown = (e: React.MouseEvent) => {
    e.preventDefault();
    isDragging.current = true;

    const onMouseMove = (ev: MouseEvent) => {
      if (!isDragging.current || !containerRef.current) return;
      const rect = containerRef.current.getBoundingClientRect();
      const pct = ((ev.clientX - rect.left) / rect.width) * 100;
      setSplitPercent(Math.min(Math.max(pct, 20), 80));
    };

    const onMouseUp = () => {
      isDragging.current = false;
      document.removeEventListener("mousemove", onMouseMove);
      document.removeEventListener("mouseup", onMouseUp);
    };

    document.addEventListener("mousemove", onMouseMove);
    document.addEventListener("mouseup", onMouseUp);
  };

  const handleMarkdownUpdate = (md: string) => {
    setMarkdown(md);
    setProjectMd(md);
  };

  const handleStartOver = () => {
    setMarkdown("");
    setProjectMd("");
    setSprints([]);
    setProjectId(null);
    setIsStreaming(false);
    setHasError(false);
  };

  const handleRetry = () => {
    setHasError(false);
    setMarkdown("");
    setProjectMd("");
    setProjectId(null);
  };

  const hasProject = projectMd.trim().length > 0;

  return (
    <div className="flex flex-col h-screen">
      <Header
        forwardHref={hasProject ? "/sprints" : undefined}
        forwardLabel="Plan Sprints →"
        onTogglePreview={() => setPreviewOpen((v) => !v)}
        previewOpen={previewOpen}
        onStartOver={handleStartOver}
      />

      {/* Two-column layout */}
      <div ref={containerRef} className="flex flex-1 overflow-hidden min-h-0">
        {/* Left panel — chat */}
        <div
          className="flex flex-col overflow-hidden min-h-0"
          style={{ width: previewOpen ? `${splitPercent}%` : "100%" }}
        >
          <BrainstormChat
            onMarkdownUpdate={handleMarkdownUpdate}
            onStreamingChange={setIsStreaming}
            onError={setHasError}
            onProjectSaved={setProjectId}
          />
        </div>

        {/* Drag divider */}
        {previewOpen && (
          <div
            className="w-1 shrink-0 cursor-col-resize bg-[rgba(0,255,224,0.15)] hover:bg-[#00ffe0] transition-colors"
            onMouseDown={handleDividerMouseDown}
          />
        )}

        {/* Right panel — preview (glassmorphic) */}
        {previewOpen && (
          <div
            className="flex flex-col overflow-hidden min-h-0 bg-[rgba(0,255,224,0.03)] backdrop-blur-md"
            style={{ width: `${100 - splitPercent}%` }}
          >
            <ProjectPreview
              markdown={markdown}
              isStreaming={isStreaming}
              hasError={hasError}
              onRetry={handleRetry}
            />
          </div>
        )}
      </div>
    </div>
  );
}
