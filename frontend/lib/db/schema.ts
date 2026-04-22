import { pgTable, uuid, text, integer, jsonb, timestamp } from "drizzle-orm/pg-core";

export const projects = pgTable("projects", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: text("user_id").notNull(),
  name: text("name").notNull(),
  projectMd: text("project_md"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export const sprints = pgTable("sprints", {
  id: uuid("id").primaryKey().defaultRandom(),
  projectId: uuid("project_id")
    .notNull()
    .references(() => projects.id, { onDelete: "cascade" }),
  sprintNumber: integer("sprint_number").notNull(),
  goal: text("goal"),
  contentMd: text("content_md"),
  sprintData: jsonb("sprint_data"),
  createdAt: timestamp("created_at").defaultNow(),
});

export const skeletons = pgTable("skeletons", {
  id: uuid("id").primaryKey().defaultRandom(),
  projectId: uuid("project_id")
    .notNull()
    .references(() => projects.id, { onDelete: "cascade" }),
  folderTree: text("folder_tree"),
  wireframeHtml: text("wireframe_html"),
  createdAt: timestamp("created_at").defaultNow(),
});
