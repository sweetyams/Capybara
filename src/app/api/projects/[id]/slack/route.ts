export const dynamic = "force-dynamic";

import { db } from "@/lib/db";
import { slackChannels, projectContributors } from "@/lib/db/schema";
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

  const rows = await db.select().from(slackChannels).where(eq(slackChannels.projectId, projectId));
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

  const { channelId, channelName } = await req.json();
  if (!channelId?.trim()) return jsonError("channelId required", 400);

  const [link] = await db
    .insert(slackChannels)
    .values({ projectId, channelId: channelId.trim(), channelName: channelName || null })
    .returning();

  return jsonOk(link, 201);
});

export const DELETE = handler(async (req, ctx) => {
  const session = await requireAuth();
  const projectId = ctx.params.id;

  const [access] = await db
    .select()
    .from(projectContributors)
    .where(and(eq(projectContributors.projectId, projectId), eq(projectContributors.userId, session.userId)));
  if (!access) return jsonError("Forbidden", 403);

  const { channelId } = await req.json();
  if (!channelId) return jsonError("channelId required", 400);

  await db
    .delete(slackChannels)
    .where(and(eq(slackChannels.projectId, projectId), eq(slackChannels.channelId, channelId)));

  return jsonOk({ deleted: true });
});
