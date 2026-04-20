"use client";
import { useState } from "react";

export default function BrainstormPage() {
  const [markdown, setMarkdown] = useState<string>("");
  const [isStreaming, setIsStreaming] = useState<boolean>(false);

  const handleStartOver = () => {
    setMarkdown("");
    setIsStreaming(false);
    // CopilotKit conversation reset is handled by remounting BrainstormChat
    // Plan 01-03 wires the actual reset mechanism
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
        <div className="w-2/5 flex flex-col border-r border-gray-200">
          {/* BrainstormChat component goes here in Plan 01-03 */}
          <div className="flex-1 flex items-center justify-center text-gray-400 text-sm">
            Chat panel — BrainstormChat loads here
          </div>
        </div>

        {/* Right panel — preview (60%) */}
        <div className="w-3/5 flex flex-col">
          {/* ProjectPreview component goes here in Plan 01-03 */}
          <div className="flex-1 flex items-center justify-center text-gray-400 text-sm">
            Preview panel — ProjectPreview loads here
          </div>
        </div>
      </div>
    </div>
  );
}
