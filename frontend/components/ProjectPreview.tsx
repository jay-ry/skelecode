"use client";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";

interface ProjectPreviewProps {
  markdown: string;
  isStreaming: boolean;
  hasError: boolean;
  onRetry: () => void;
}

export function ProjectPreview({
  markdown,
  isStreaming,
  hasError,
  onRetry,
}: ProjectPreviewProps) {
  const handleDownload = () => {
    const blob = new Blob([markdown], { type: "text/markdown" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "project.md";
    a.click();
    URL.revokeObjectURL(url);
  };

  if (hasError && !isStreaming) {
    return (
      <div className="flex flex-col h-full">
        <div className="flex items-center justify-between px-4 py-3 border-b border-[rgba(0,255,224,0.12)] bg-[rgba(0,255,224,0.03)]">
          <span className="font-mono text-sm font-semibold text-[#7abfb8]">
            project.md
          </span>
        </div>
        <div className="flex-1 flex flex-col items-center justify-center gap-3 text-center px-8">
          <p className="text-sm text-[#ff003c]">
            Generation failed — try rephrasing your idea
          </p>
          <button
            onClick={onRetry}
            className="text-sm px-3 py-1 border border-[rgba(0,255,224,0.15)] rounded text-[#c8f0ea] hover:bg-[#050d14] hover:border-[#00ffe0] transition-colors"
          >
            Retry
          </button>
        </div>
      </div>
    );
  }

  if (!markdown && !isStreaming) {
    return (
      <div className="flex flex-col h-full">
        <div className="flex items-center px-4 py-3 border-b border-[rgba(0,255,224,0.12)] bg-[rgba(0,255,224,0.03)]">
          <span className="font-mono text-sm font-semibold text-[#7abfb8]">
            project.md
          </span>
        </div>
        <div className="flex-1 flex items-center justify-center text-[#7abfb8] text-sm">
          Your project spec will appear here once the brainstorm is complete
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-[rgba(0,255,224,0.12)] bg-[rgba(0,255,224,0.03)]">
        <div className="flex items-center gap-2">
          <span className="font-mono text-sm font-semibold text-[#7abfb8]">
            project.md
          </span>
          {isStreaming && (
            <span className="text-xs text-[#00ffe0] font-mono animate-pulse">
              generating...
            </span>
          )}
        </div>
        <button
          onClick={handleDownload}
          disabled={!markdown || isStreaming}
          className="text-sm px-3 py-1 border border-[rgba(0,255,224,0.15)] rounded text-[#c8f0ea] hover:bg-[rgba(0,255,224,0.08)] hover:border-[#00ffe0] transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
        >
          Download project.md
        </button>
      </div>

      {/* Markdown content */}
      <div className="flex-1 overflow-auto p-6">
        <div className="prose prose-sm prose-invert max-w-none prose-headings:text-[#00ffe0] prose-headings:font-mono prose-a:text-[#00ffe0] prose-code:text-[#c8f0ea] prose-code:bg-[rgba(0,255,224,0.06)] prose-strong:text-[#c8f0ea] prose-li:text-[#c8f0ea]">
          <ReactMarkdown remarkPlugins={[remarkGfm]}>{markdown}</ReactMarkdown>
        </div>
      </div>
    </div>
  );
}
