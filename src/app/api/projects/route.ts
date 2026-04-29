export const dynamic = "force-dynamic";

import { db } from "@/lib/db";
import { projects, projectContributors } from "@/lib/db/schema";
import { requireAuth } from "@/lib/auth";
import { jsonOk, jsonError } from "@/lib/api-response";
import { handler } from "@/lib/route-handler";
import { eq, desc } from "drizzle-orm";

export const GET = handler(async () => {
  const session = await requireAuth();
  const rows = await db
    .select({ project: projects })
    .from(projects)
    .innerJoin(projectContributors, eq(projectContributors.projectId, projects.id))
    .where(eq(projectContributors.userId, session.userId))
    .orderBy(desc(projects.createdAt));
  return jsonOk(rows.map((r) => r.project));
});

export const POST = handler(async (req) => {
  const session = await requireAuth();
  const { name, color } = await req.json();
  if (!name?.trim()) return jsonError("name required", 400);

  const [project] = await db
    .insert(projects)
    .values({ name: name.trim(), color: color || "#6366f1", createdBy: session.userId })
    .returning();

  await db.insert(projectContributors).values({
    projectId: project.id,
    userId: session.userId,
  });

  return jsonOk(project, 201);
});
