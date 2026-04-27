"use client";
import { useState } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import type { Sprint } from "../types/sprint";

interface SprintCardProps {
  sprint: Sprint;
  defaultOpen?: boolean;
}

/**
 * Accordion card for one Sprint.
 * - Header shows `Sprint N — <goal>` and a toggle arrow (D-01 from phase 2).
 * - Body renders sprint.content_md via react-markdown when present (D-12, phase 5).
 *   Falls back to legacy structured Section components when content_md is empty
 *   (backwards compat for DB rows generated before phase 5).
 * - defaultOpen controls the INITIAL useState only; later changes don't reopen
 *   a card the user collapsed.
 */
export function SprintCard({ sprint, defaultOpen = false }: SprintCardProps) {
  const [open, setOpen] = useState<boolean>(defaultOpen);
  const hasMarkdown =
    typeof sprint.content_md === "string" && sprint.content_md.trim().length > 0;

  return (
    <div className="border border-[rgba(0,255,224,0.15)] rounded mb-2 bg-[#020408]">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="w-full flex items-center justify-between px-4 py-3 text-left hover:bg-[#050d14] transition-colors"
        aria-expanded={open}
      >
        <span className="font-mono text-sm font-semibold text-[#c8f0ea]">
          Sprint {sprint.number} — {sprint.goal}
        </span>
        <span className="text-[#00ffe0] text-sm" aria-hidden="true">
          {open ? "▲" : "▼"}
        </span>
      </button>
      {open && (
        <div className="border-t border-[rgba(0,255,224,0.08)]">
          {hasMarkdown ? (
            <div className="prose prose-sm prose-invert max-w-none prose-headings:text-[#00ffe0] prose-headings:font-mono prose-a:text-[#00ffe0] prose-code:text-[#c8f0ea] prose-code:bg-[rgba(0,255,224,0.06)] prose-strong:text-[#c8f0ea] prose-li:text-[#c8f0ea] overflow-auto px-4 pb-4">
              <ReactMarkdown remarkPlugins={[remarkGfm]}>{sprint.content_md}</ReactMarkdown>
            </div>
          ) : (
            <div className="px-4 pb-4 space-y-4">
              <Section label="User Stories" items={sprint.user_stories ?? []} />
              <Section label="Technical Tasks" items={sprint.technical_tasks ?? []} />
              <Section label="Definition of Done" items={sprint.definition_of_done ?? []} />
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function Section({ label, items }: { label: string; items: string[] }) {
  return (
    <div>
      <div className="text-xs font-semibold uppercase tracking-wide text-[#00ffe0] mt-4 mb-1 font-mono">
        {label}
      </div>
      <ul className="list-disc pl-4 text-sm text-[#c8f0ea] leading-relaxed space-y-1">
        {items.map((item, i) => (
          <li key={i}>{item}</li>
        ))}
      </ul>
    </div>
  );
}
