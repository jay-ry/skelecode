"use client";
import { SprintCard } from "./SprintCard";
import type { Sprint } from "../context/ProjectContext";

interface SprintListProps {
  sprints: Sprint[];
  isGenerating: boolean;
}

export function SprintList({ sprints, isGenerating }: SprintListProps) {
  // Empty + not generating: idle state — "Click Generate Sprints ..."
  if (sprints.length === 0 && !isGenerating) {
    return (
      <div className="flex flex-1 items-center justify-center text-gray-400 text-sm">
        Click &quot;Generate Sprints&quot; to plan your project
      </div>
    );
  }

  // Empty + generating: first-sprint-loading state
  if (sprints.length === 0 && isGenerating) {
    return (
      <div className="flex flex-1 items-center justify-center text-gray-400 text-sm font-mono animate-pulse">
        Generating your first sprint...
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-0">
      {sprints.map((sprint) => (
        // defaultOpen={true} — card auto-expands on mount per D-03
        <SprintCard key={sprint.number} sprint={sprint} defaultOpen={true} />
      ))}
      {isGenerating && (
        <span className="text-sm text-gray-400 font-mono animate-pulse px-4 py-2">
          Generating next sprint...
        </span>
      )}
    </div>
  );
}
