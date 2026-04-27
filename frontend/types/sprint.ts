export interface Sprint {
  number: number;
  goal: string;
  content_md: string;
  // Legacy fields — populated only by older DB rows generated before phase 5.
  // New generations leave these undefined; SprintCard falls back to content_md.
  user_stories?: string[];
  technical_tasks?: string[];
  definition_of_done?: string[];
}
