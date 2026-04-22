import { auth } from "@clerk/nextjs/server";
import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { projects, skeletons } from "@/lib/db/schema";
import { and, eq } from "drizzle-orm";

export const dynamic = "force-dynamic";

interface SkeletonBody {
  folder_tree?: string | null;
  wireframe_html?: string | null;
}

/**
 * PUT /api/projects/[id]/skeleton
 *
 * Save (or replace) the skeleton for a project. Uses DELETE + INSERT
 * (same simplification as the sprints route — no UPSERT).
 *
 * Security (ASVS V4 — Access Control):
 *   1. Clerk auth required (userId present).
 *   2. Ownership check: project.userId === userId.
 *   3. Ownership check runs BEFORE any write. IDOR mitigation.
 */
export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: projectId } = await params;

  const { userId } = await auth();
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // Ownership check — ASVS V4 (required before any write). IDOR mitigation.
  const [owned] = await db
    .select({ id: projects.id })
    .from(projects)
    .where(and(eq(projects.id, projectId), eq(projects.userId, userId)))
    .limit(1);

  if (!owned) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  let body: SkeletonBody;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  // DELETE + INSERT — simpler than UPSERT for MVP (matches sprints route pattern).
  await db.delete(skeletons).where(eq(skeletons.projectId, projectId));

  await db.insert(skeletons).values({
    projectId,
    folderTree: body.folder_tree ?? null,
    wireframeHtml: body.wireframe_html ?? null,
  });

  return NextResponse.json({ ok: true });
}

/**
 * GET /api/projects/[id]/skeleton
 *
 * Load the saved skeleton for a project. Returns
 *   { folder_tree: string | null, wireframe_html: string | null }
 * or { folder_tree: null, wireframe_html: null } if no skeleton row exists
 * (used for page-mount restore — null is the "no saved skeleton" signal).
 *
 * Security: same auth + ownership check as PUT.
 */
export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: projectId } = await params;

  const { userId } = await auth();
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // Ownership check — ASVS V4 (required before read). IDOR mitigation.
  const [owned] = await db
    .select({ id: projects.id })
    .from(projects)
    .where(and(eq(projects.id, projectId), eq(projects.userId, userId)))
    .limit(1);

  if (!owned) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const [row] = await db
    .select()
    .from(skeletons)
    .where(eq(skeletons.projectId, projectId))
    .limit(1);

  if (!row) {
    return NextResponse.json({ folder_tree: null, wireframe_html: null });
  }

  return NextResponse.json({
    folder_tree: row.folderTree,
    wireframe_html: row.wireframeHtml,
  });
}
