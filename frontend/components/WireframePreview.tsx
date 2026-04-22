"use client";

interface WireframePreviewProps {
  html: string;             // complete HTML string from wireframe_builder
  isLoading?: boolean;      // true while waiting for the wireframe event
}

/**
 * Renders a wireframe HTML string inside a sandboxed iframe.
 *
 * SECURITY (RESEARCH.md Pitfall 5):
 *   sandbox="allow-scripts" allows inline <script> tags in generated HTML but
 *   BLOCKS navigation, form submission, and access to the parent page's DOM/cookies.
 *   Do NOT add any extra sandbox permissions — keeping it to allow-scripts only
 *   ensures iframe cannot access parent DOM, cookies, or localStorage (XSS defense).
 */
export function WireframePreview({ html, isLoading = false }: WireframePreviewProps) {
  const handleOpenInNewTab = () => {
    if (!html) return;
    const blob = new Blob([html], { type: "text/html" });
    const url = URL.createObjectURL(blob);
    window.open(url, "_blank");
    // Do NOT revoke URL immediately — the new tab needs it alive.
  };

  return (
    <div className="w-full flex flex-col gap-2">
      {isLoading && !html ? (
        <div
          className="flex items-center justify-center h-[500px] border border-[rgba(0,255,224,0.15)] rounded text-sm text-[#7abfb8] font-mono animate-pulse"
          role="status"
        >
          Generating wireframe...
        </div>
      ) : html ? (
        <iframe
          srcDoc={html}
          sandbox="allow-scripts"
          className="w-full h-[500px] border border-[rgba(0,255,224,0.15)] rounded"
          title="Sprint 1 wireframe preview"
        />
      ) : (
        <div
          className="flex items-center justify-center h-[500px] border border-[rgba(0,255,224,0.15)] rounded text-sm text-[#7abfb8]"
          role="status"
        >
          Wireframe will appear here after generation.
        </div>
      )}
      <div className="flex justify-end mt-1">
        <button
          type="button"
          onClick={handleOpenInNewTab}
          disabled={!html}
          className="text-sm px-3 py-1 border border-[rgba(0,255,224,0.15)] rounded text-[#c8f0ea] hover:bg-[#050d14] hover:border-[#00ffe0] transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
        >
          Open in new tab
        </button>
      </div>
    </div>
  );
}
