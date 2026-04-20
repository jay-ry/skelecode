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
    a.download = "project.md"; // Always named project.md (CONTEXT.md decision)
    a.click();
    URL.revokeObjectURL(url);
  };

  // Error state (CONTEXT.md: inline error in preview panel with retry button)
  if (hasError && !isStreaming) {
    return (
      <div className="flex flex-col h-full">
        <div className="flex items-center justify-between px-4 py-3 border-b border-gray-200">
          <span className="font-mono text-sm font-semibold text-gray-700">
            project.md
          </span>
        </div>
        <div className="flex-1 flex flex-col items-center justify-center gap-3 text-center px-8">
          <p className="text-sm text-red-600">
            Generation failed — try rephrasing your idea
          </p>
          <button
            onClick={onRetry}
            className="text-sm px-3 py-1 border border-gray-300 rounded hover:bg-gray-50 transition-colors"
          >
            Retry
          </button>
        </div>
      </div>
    );
  }

  // Empty state (no markdown, not streaming)
  if (!markdown && !isStreaming) {
    return (
      <div className="flex flex-col h-full">
        <div className="flex items-center px-4 py-3 border-b border-gray-200">
          <span className="font-mono text-sm font-semibold text-gray-700">
            project.md
          </span>
        </div>
        <div className="flex-1 flex items-center justify-center text-gray-400 text-sm">
          Your project spec will appear here once the brainstorm is complete
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full">
      {/* Header with filename and download button */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-gray-200">
        <div className="flex items-center gap-2">
          <span className="font-mono text-sm font-semibold text-gray-700">
            project.md
          </span>
          {isStreaming && (
            <span className="text-xs text-gray-400 font-mono animate-pulse">
              generating...
            </span>
          )}
        </div>
        <button
          onClick={handleDownload}
          disabled={!markdown || isStreaming}
          className="text-sm px-3 py-1 border border-gray-300 rounded hover:bg-gray-50 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
        >
          Download project.md
        </button>
      </div>

      {/* Markdown content with Tailwind prose styling */}
      <div className="flex-1 overflow-auto p-6">
        <div className="prose prose-sm max-w-none">
          <ReactMarkdown remarkPlugins={[remarkGfm]}>{markdown}</ReactMarkdown>
        </div>
      </div>
    </div>
  );
}
