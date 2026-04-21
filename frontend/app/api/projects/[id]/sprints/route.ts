import { auth } from "@clerk/nextjs/server";
import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { projects, sprints } from "@/lib/db/schema";
import { and, eq } from "drizzle-orm";

export const dynamic = "force-dynamic";

interface SprintInput {
  number: number;
  goal: string;
  user_stories?: string[];
  technical_tasks?: string[];
  definition_of_done?: string[];
  content_md?: string;
  sprint_data?: unknown;
}

export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: projectId } = await params;

  const { userId } = await auth();
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // Ownership check — ASVS V4 (required before any write)
  const [owned] = await db
    .select({ id: projects.id })
    .from(projects)
    .where(and(eq(projects.id, projectId), eq(projects.userId, userId)))
    .limit(1);

  if (!owned) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  let body: { sprints?: SprintInput[] };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const sprintData = Array.isArray(body.sprints) ? body.sprints : [];

  // DELETE + INSERT — simpler than UPSERT for MVP (CONTEXT.md specifics line 145)
  await db.delete(sprints).where(eq(sprints.projectId, projectId));

  if (sprintData.length > 0) {
    await db.insert(sprints).values(
      sprintData.map((s, i) => ({
        projectId,
        sprintNumber: s.number ?? i + 1,
        goal: s.goal ?? "",
        contentMd: s.content_md ?? null,
        sprintData: (s.sprint_data ?? s) as unknown,
      }))
    );
  }

  return NextResponse.json({ ok: true });
}
