"use client";
import { useState } from "react";
import type { Sprint } from "../context/ProjectContext";

interface SprintCardProps {
  sprint: Sprint;
  defaultOpen?: boolean;
}

/**
 * Accordion card for one Sprint.
 * - D-01: header shows number + goal only; body hidden by default
 * - D-02: read-only — no inline editing
 * - D-03: defaultOpen prop controls INITIAL useState only.
 *   Passing defaultOpen=true to a newly mounted card opens it (auto-expand on arrival).
 *   Passing it to an already-mounted card does NOTHING — user collapses are preserved.
 */
export function SprintCard({ sprint, defaultOpen = false }: SprintCardProps) {
  const [open, setOpen] = useState<boolean>(defaultOpen);

  return (
    <div className="border border-gray-200 rounded mb-2">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="w-full flex items-center justify-between px-4 py-3 text-left hover:bg-gray-50 transition-colors"
        aria-expanded={open}
      >
        <span className="font-mono text-sm font-semibold text-gray-900">
          Sprint {sprint.number} — {sprint.goal}
        </span>
        <span className="text-gray-400 text-sm" aria-hidden="true">
          {open ? "▲" : "▼"}
        </span>
      </button>
      {open && (
        <div className="px-4 pb-4 border-t border-gray-100 space-y-4">
          <Section label="User Stories" items={sprint.user_stories} />
          <Section label="Technical Tasks" items={sprint.technical_tasks} />
          <Section label="Definition of Done" items={sprint.definition_of_done} />
        </div>
      )}
    </div>
  );
}

function Section({ label, items }: { label: string; items: string[] }) {
  return (
    <div>
      <div className="text-xs font-semibold uppercase tracking-wide text-gray-500 mt-4 mb-1">
        {label}
      </div>
      <ul className="list-disc pl-4 text-sm text-gray-700 leading-relaxed space-y-1">
        {items.map((item, i) => (
          <li key={i}>{item}</li>
        ))}
      </ul>
    </div>
  );
}
