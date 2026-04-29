export const dynamic = "force-dynamic";

import { db } from "@/lib/db";
import { rules, projectContributors } from "@/lib/db/schema";
import { requireAuth } from "@/lib/auth";
import { jsonOk, jsonError } from "@/lib/api-response";
import { handler } from "@/lib/route-handler";
import { eq, and } from "drizzle-orm";

export const GET = handler(async (_req, ctx) => {
  const session = await requireAuth();
  const projectId = ctx.params.id;

  const [access] = await db
    .select()
    .from(projectContributors)
    .where(and(eq(projectContributors.projectId, projectId), eq(projectContributors.userId, session.userId)));
  if (!access) return jsonError("Forbidden", 403);

  const rows = await db.select().from(rules).where(eq(rules.projectId, projectId)).orderBy(rules.createdAt);
  return jsonOk(rows);
});

export const POST = handler(async (req, ctx) => {
  const session = await requireAuth();
  const projectId = ctx.params.id;

  const [access] = await db
    .select()
    .from(projectContributors)
    .where(and(eq(projectContributors.projectId, projectId), eq(projectContributors.userId, session.userId)));
  if (!access) return jsonError("Forbidden", 403);

  const { condition, behavior } = await req.json();
  if (!condition?.trim() || !behavior?.trim()) return jsonError("condition and behavior required", 400);

  const [rule] = await db
    .insert(rules)
    .values({ projectId, condition, behavior, createdBy: session.userId })
    .returning();

  return jsonOk(rule, 201);
});

export const DELETE = handler(async (req, ctx) => {
  const session = await requireAuth();
  const projectId = ctx.params.id;

  const [access] = await db
    .select()
    .from(projectContributors)
    .where(and(eq(projectContributors.projectId, projectId), eq(projectContributors.userId, session.userId)));
  if (!access) return jsonError("Forbidden", 403);

  const { ruleId } = await req.json();
  if (!ruleId) return jsonError("ruleId required", 400);

  await db.delete(rules).where(and(eq(rules.id, ruleId), eq(rules.projectId, projectId)));
  return jsonOk({ deleted: true });
});
