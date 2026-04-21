"use client";
import { useState } from "react";
import Link from "next/link";
import { BrainstormChat } from "../components/BrainstormChat";
import { ProjectPreview } from "../components/ProjectPreview";
import { useProjectContext } from "../context/ProjectContext";

export default function BrainstormPage() {
  const { projectMd, setProjectMd, setSprints } = useProjectContext();

  const [markdown, setMarkdown] = useState<string>(projectMd);
  const [isStreaming, setIsStreaming] = useState<boolean>(false);
  const [hasError, setHasError] = useState<boolean>(false);
  const [previewOpen, setPreviewOpen] = useState<boolean>(true);

  // Dual-write: update BOTH local state (for ProjectPreview) AND context (for /sprints)
  const handleMarkdownUpdate = (md: string) => {
    setMarkdown(md);
    setProjectMd(md);
  };

  const handleStartOver = () => {
    setMarkdown("");
    setProjectMd("");
    setSprints([]);          // clear any previously generated sprints
    setIsStreaming(false);
    setHasError(false);
  };

  const handleRetry = () => {
    setHasError(false);
    setMarkdown("");
    setProjectMd("");
  };

  // Plan Sprints → nav appears only when we have a project to plan from (CONTEXT.md specifics)
  const hasProject = projectMd.trim().length > 0;

  return (
    <div className="flex flex-col h-screen">
      {/* Header */}
      <header className="flex items-center justify-between px-6 py-3 border-b border-gray-200 bg-white shrink-0">
        <span className="font-mono text-sm font-semibold tracking-tight text-gray-800">
          SkeleCode
        </span>
        <div className="flex items-center gap-2">
          {hasProject && (
            <Link
              href="/sprints"
              className="text-sm px-3 py-1 border border-gray-300 rounded hover:bg-gray-50 transition-colors"
            >
              Plan Sprints →
            </Link>
          )}
          <button
            onClick={() => setPreviewOpen((v) => !v)}
            className="text-sm px-3 py-1 border border-gray-300 rounded hover:bg-gray-50 transition-colors"
          >
            {previewOpen ? "Hide preview" : "Show preview"}
          </button>
          <button
            onClick={handleStartOver}
            className="text-sm px-3 py-1 border border-gray-300 rounded hover:bg-gray-50 transition-colors"
          >
            Start over
          </button>
        </div>
      </header>

      {/* Two-column layout */}
      <div className="flex flex-1 overflow-hidden min-h-0">
        {/* Left panel — chat */}
        <div
          className={`flex flex-col border-r border-gray-200 overflow-hidden min-h-0 transition-all duration-200 ${
            previewOpen ? "w-2/5" : "w-full"
          }`}
        >
          <BrainstormChat
            onMarkdownUpdate={handleMarkdownUpdate}
            onStreamingChange={setIsStreaming}
            onError={setHasError}
          />
        </div>

        {/* Right panel — preview */}
        {previewOpen && (
          <div className="w-3/5 flex flex-col overflow-hidden min-h-0">
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
