"use client";
import { useState, useRef, useEffect } from "react";
import { useParams, useRouter } from "next/navigation";
import { BrainstormChat } from "../../../components/BrainstormChat";
import { ProjectPreview } from "../../../components/ProjectPreview";
import { Header } from "../../../components/Header";

export default function ChatPage() {
  const params = useParams<{ id: string }>();
  const projectId = params.id;
  const router = useRouter();

  const [markdown, setMarkdown] = useState<string>("");
  const [isStreaming, setIsStreaming] = useState<boolean>(false);
  const [hasError, setHasError] = useState<boolean>(false);
  const [previewOpen, setPreviewOpen] = useState<boolean>(true);
  const [splitPercent, setSplitPercent] = useState<number>(40);

  const containerRef = useRef<HTMLDivElement>(null);
  const isDragging = useRef(false);

  // Load existing project_md if this project was previously saved
  useEffect(() => {
    fetch(`/api/projects/${projectId}`)
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (data?.projectMd) setMarkdown(data.projectMd);
      })
      .catch(() => { /* silent — new project has no spec yet */ });
  }, [projectId]);

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

  const handleRetry = () => {
    setHasError(false);
    setMarkdown("");
  };

  const hasProject = markdown.trim().length > 0;

  return (
    <div className="flex flex-col h-screen">
      <Header
        projectId={projectId}
        backHref="/"
        backLabel="← Dashboard"
        forwardHref={hasProject ? `/sprints/${projectId}` : undefined}
        forwardLabel="Plan Sprints →"
        onTogglePreview={() => setPreviewOpen((v) => !v)}
        previewOpen={previewOpen}
        onStartOver={() => router.push("/")}
      />

      <div ref={containerRef} className="flex flex-1 overflow-hidden min-h-0">
        <div
          className="flex flex-col overflow-hidden min-h-0"
          style={{ width: previewOpen ? `${splitPercent}%` : "100%" }}
        >
          <BrainstormChat
            projectId={projectId}
            onMarkdownUpdate={setMarkdown}
            onStreamingChange={setIsStreaming}
            onError={setHasError}
          />
        </div>

        {previewOpen && (
          <div
            className="w-1 shrink-0 cursor-col-resize bg-[rgba(0,255,224,0.15)] hover:bg-[#00ffe0] transition-colors"
            onMouseDown={handleDividerMouseDown}
          />
        )}

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
