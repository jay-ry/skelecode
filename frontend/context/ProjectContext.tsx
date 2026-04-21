"use client";
import { createContext, useContext, useState } from "react";

export interface Sprint {
  number: number;
  goal: string;
  user_stories: string[];
  technical_tasks: string[];
  definition_of_done: string[];
}

export interface ProjectContextValue {
  projectMd: string;
  setProjectMd: (md: string) => void;
  sprints: Sprint[];
  // React.Dispatch allows functional updater: setSprints((prev) => [...prev, sprint])
  setSprints: React.Dispatch<React.SetStateAction<Sprint[]>>;
}

const ProjectContext = createContext<ProjectContextValue | null>(null);

export function ProjectContextProvider({ children }: { children: React.ReactNode }) {
  const [projectMd, setProjectMd] = useState<string>("");
  const [sprints, setSprints] = useState<Sprint[]>([]);

  return (
    <ProjectContext.Provider value={{ projectMd, setProjectMd, sprints, setSprints }}>
      {children}
    </ProjectContext.Provider>
  );
}

export function useProjectContext(): ProjectContextValue {
  const ctx = useContext(ProjectContext);
  if (!ctx) {
    throw new Error("useProjectContext must be used within ProjectContextProvider");
  }
  return ctx;
}
