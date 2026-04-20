"use client";
import { useState } from "react";
import { BrainstormChat } from "../components/BrainstormChat";
import { ProjectPreview } from "../components/ProjectPreview";

export default function BrainstormPage() {
  const [markdown, setMarkdown] = useState<string>("");
  const [isStreaming, setIsStreaming] = useState<boolean>(false);
  const [hasError, setHasError] = useState<boolean>(false);

  const handleStartOver = () => {
    setMarkdown("");
    setIsStreaming(false);
    setHasError(false);
    // Note: CopilotKit conversation persists until page reload — acceptable for Phase 1
    // Phase 3 (auth + persistence) will implement proper session reset
  };

  const handleRetry = () => {
    setHasError(false);
    setMarkdown("");
    // User retries by sending another message in the chat
  };

  return (
    <div className="flex flex-col h-screen">
      {/* Header */}
      <header className="flex items-center justify-between px-6 py-3 border-b border-gray-200 bg-white">
        <span className="font-mono text-sm font-semibold tracking-tight text-gray-800">
          SkeleCode
        </span>
        <button
          onClick={handleStartOver}
          className="text-sm px-3 py-1 border border-gray-300 rounded hover:bg-gray-50 transition-colors"
        >
          Start over
        </button>
      </header>

      {/* Two-column layout: 40% chat / 60% preview — desktop only */}
      <div className="flex flex-1 overflow-hidden">
        {/* Left panel — chat (40%) */}
        <div className="w-2/5 flex flex-col border-r border-gray-200 overflow-hidden">
          <BrainstormChat
            onMarkdownUpdate={setMarkdown}
            onStreamingChange={setIsStreaming}
            onError={setHasError}
          />
        </div>

        {/* Right panel — preview (60%) */}
        <div className="w-3/5 flex flex-col overflow-hidden">
          <ProjectPreview
            markdown={markdown}
            isStreaming={isStreaming}
            hasError={hasError}
            onRetry={handleRetry}
          />
        </div>
      </div>
    </div>
  );
}
