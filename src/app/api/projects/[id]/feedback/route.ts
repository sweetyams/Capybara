export const dynamic = "force-dynamic";

import { db } from "@/lib/db";
import { feedbackEvents, rules, projectContributors } from "@/lib/db/schema";
import { requireAuth } from "@/lib/auth";
import { jsonOk, jsonError } from "@/lib/api-response";
import { handler } from "@/lib/route-handler";
import { eq, and } from "drizzle-orm";

export const POST = handler(async (req, ctx) => {
  const session = await requireAuth();
  const projectId = ctx.params.id;

  const [access] = await db
    .select()
    .from(projectContributors)
    .where(and(eq(projectContributors.projectId, projectId), eq(projectContributors.userId, session.userId)));
  if (!access) return jsonError("Forbidden", 403);

  const { draftId, type, diff, rule } = await req.json();
  if (!draftId || !type) return jsonError("draftId and type required", 400);

  const [event] = await db
    .insert(feedbackEvents)
    .values({ draftId, type, diff: diff || null, userId: session.userId })
    .returning();

  // If "teach" feedback, create a rule
  if (type === "teach" && rule?.condition && rule?.behavior) {
    await db.insert(rules).values({
      projectId,
      condition: rule.condition,
      behavior: rule.behavior,
      createdBy: session.userId,
    });
  }

  return jsonOk(event, 201);
});
