"use client";
import { useState, useMemo } from "react";

interface FolderTreeProps {
  tree: string;              // full ASCII tree (may be "" while streaming has not started)
  isGenerating?: boolean;    // true while SSE loop is active — disables collapse/expand
}

/**
 * Renders an ASCII folder tree inside a <pre> block.
 *
 * Features:
 *   - Copy-to-clipboard button (top-right)
 *   - Post-streaming collapse/expand on directory lines (CONTEXT.md + UI-SPEC.md)
 *     Disabled while isGenerating === true (don't block streaming).
 *     Collapsed directories show ▶ prefix; expanded show ▼ (text-[#00ffe0]).
 */
export function FolderTree({ tree, isGenerating = false }: FolderTreeProps) {
  const [copied, setCopied] = useState<boolean>(false);
  const [collapsed, setCollapsed] = useState<Set<number>>(new Set());

  const handleCopy = async () => {
    if (!tree) return;
    try {
      await navigator.clipboard.writeText(tree);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      // clipboard API can fail in insecure contexts; silently ignore for MVP
    }
  };

  // Parse lines + compute depth + directory flag.
  // Line index is the stable key for collapsed state.
  const parsed = useMemo(() => {
    const lines = tree.split("\n");
    return lines.map((raw, idx) => {
      // Depth heuristic: count 4-char indent units ("│   " or "    ") before the
      // last branch marker. Lines containing ├── or └── add +1 to that count.
      let depth = 0;
      let rest = raw;
      // Consume leading indent units
      while (rest.startsWith("│   ") || rest.startsWith("    ")) {
        depth += 1;
        rest = rest.slice(4);
      }
      const branchIdx = Math.max(rest.lastIndexOf("├── "), rest.lastIndexOf("└── "));
      let nameSegment: string;
      if (branchIdx >= 0) {
        depth += 1;
        nameSegment = rest.slice(branchIdx + 4);
      } else {
        nameSegment = rest;
      }
      const trimmedName = nameSegment.trimEnd();
      const isDirectory = trimmedName.endsWith("/");
      return { idx, raw, depth, isDirectory, nameSegment: trimmedName };
    });
  }, [tree]);

  // Compute which lines are hidden due to a collapsed ancestor.
  const visibility = useMemo(() => {
    const hidden = new Set<number>();
    let hideBelowDepth: number | null = null;
    for (const line of parsed) {
      if (hideBelowDepth !== null) {
        if (line.depth > hideBelowDepth) {
          hidden.add(line.idx);
          continue;
        } else {
          hideBelowDepth = null;
        }
      }
      if (line.isDirectory && collapsed.has(line.idx)) {
        hideBelowDepth = line.depth;
      }
    }
    return hidden;
  }, [parsed, collapsed]);

  const toggleDirectory = (lineIdx: number) => {
    if (isGenerating) return; // Disabled during streaming
    setCollapsed((prev) => {
      const next = new Set(prev);
      if (next.has(lineIdx)) {
        next.delete(lineIdx);
      } else {
        next.add(lineIdx);
      }
      return next;
    });
  };

  return (
    <div className="relative w-full" role="region" aria-label="Folder structure tree">
      <div className="flex justify-end mb-2">
        <button
          type="button"
          onClick={handleCopy}
          disabled={!tree || isGenerating}
          className="text-sm px-3 py-1 border border-[rgba(0,255,224,0.15)] rounded text-[#c8f0ea] hover:bg-[#050d14] hover:border-[#00ffe0] transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
          aria-live="polite"
        >
          <span>{copied ? "Copied!" : "Copy"}</span>
        </button>
      </div>
      <pre className="font-mono text-sm text-[#c8f0ea] leading-relaxed whitespace-pre overflow-x-auto bg-[#020408] p-0">
        {tree === ""
          ? (isGenerating ? "Streaming..." : "")
          : parsed.map((line) => {
              if (visibility.has(line.idx)) return null;
              if (line.isDirectory) {
                const isCollapsed = collapsed.has(line.idx);
                const indicator = isCollapsed ? " ▶" : " ▼";
                return (
                  <div
                    key={line.idx}
                    onClick={() => toggleDirectory(line.idx)}
                    className={
                      isGenerating
                        ? "select-text"
                        : "cursor-pointer hover:bg-[#050d14]"
                    }
                    role={isGenerating ? undefined : "button"}
                    aria-expanded={isGenerating ? undefined : !isCollapsed}
                  >
                    {line.raw}
                    <span className="text-[#00ffe0]">{indicator}</span>
                  </div>
                );
              }
              return <div key={line.idx}>{line.raw}</div>;
            })}
      </pre>
    </div>
  );
}
