"use client";
import { useState, useEffect } from "react";

interface WireframePreviewProps {
  htmls: Record<number, string>; // sprint_number → html
  isLoading?: boolean;
}

/**
 * SECURITY: sandbox="allow-scripts" permits inline <script> tags but blocks
 * navigation, form submission, and parent DOM/cookie access. Do NOT add any
 * extra sandbox permissions.
 */
export function WireframePreview({ htmls, isLoading = false }: WireframePreviewProps) {
  const sprintNumbers = Object.keys(htmls)
    .map(Number)
    .sort((a, b) => a - b);

  const [activeTab, setActiveTab] = useState<number>(sprintNumbers[0] ?? 1);

  // When new sprints arrive during streaming, auto-advance to the latest
  useEffect(() => {
    if (sprintNumbers.length > 0) {
      setActiveTab(sprintNumbers[sprintNumbers.length - 1]);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sprintNumbers.length]);

  const activeHtml = htmls[activeTab] ?? "";

  const handleOpenInNewTab = () => {
    if (!activeHtml) return;
    const blob = new Blob([activeHtml], { type: "text/html" });
    const url = URL.createObjectURL(blob);
    window.open(url, "_blank");
  };

  const isEmpty = sprintNumbers.length === 0;

  return (
    <div className="flex-1 min-h-0 flex flex-col gap-2">
      {/* Tab bar — only shown once at least one wireframe exists */}
      {!isEmpty && (
        <div className="flex gap-1 flex-wrap shrink-0">
          {sprintNumbers.map((n) => (
            <button
              key={n}
              type="button"
              onClick={() => setActiveTab(n)}
              className={`text-xs px-3 py-1 rounded border font-mono transition-colors ${
                activeTab === n
                  ? "border-[#00ffe0] text-[#00ffe0] bg-[#050d14]"
                  : "border-[rgba(0,255,224,0.15)] text-[#7abfb8] hover:border-[#00ffe0] hover:text-[#c8f0ea]"
              }`}
            >
              Sprint {n}
            </button>
          ))}
          {isLoading && (
            <span className="text-xs px-3 py-1 text-[#7abfb8] font-mono animate-pulse">
              generating…
            </span>
          )}
        </div>
      )}

      {/* Iframe / placeholder */}
      {isLoading && isEmpty ? (
        <div
          className="flex-1 flex items-center justify-center border border-[rgba(0,255,224,0.15)] rounded text-sm text-[#7abfb8] font-mono animate-pulse"
          role="status"
        >
          Generating wireframes…
        </div>
      ) : !isEmpty ? (
        <iframe
          key={activeTab}
          srcDoc={activeHtml}
          sandbox="allow-scripts"
          className="flex-1 min-h-0 w-full border border-[rgba(0,255,224,0.15)] rounded"
          title={`Sprint ${activeTab} wireframe preview`}
        />
      ) : (
        <div
          className="flex-1 flex items-center justify-center border border-[rgba(0,255,224,0.15)] rounded text-sm text-[#7abfb8]"
          role="status"
        >
          Wireframes will appear here after generation.
        </div>
      )}

      {/* Actions */}
      <div className="flex justify-end shrink-0">
        <button
          type="button"
          onClick={handleOpenInNewTab}
          disabled={!activeHtml}
          className="text-sm px-3 py-1 border border-[rgba(0,255,224,0.15)] rounded text-[#c8f0ea] hover:bg-[#050d14] hover:border-[#00ffe0] transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
        >
          Open in new tab
        </button>
      </div>
    </div>
  );
}
