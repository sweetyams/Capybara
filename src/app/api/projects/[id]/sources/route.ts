export const dynamic = "force-dynamic";

import { db } from "@/lib/db";
import { sources, chunks, projectContributors } from "@/lib/db/schema";
import { requireAuth } from "@/lib/auth";
import { jsonOk, jsonError } from "@/lib/api-response";
import { handler } from "@/lib/route-handler";
import { eq, and } from "drizzle-orm";
import { sql } from "drizzle-orm";
import OpenAI from "openai";

const MAX_CHUNK_CHARS = 1500;

function chunkText(text: string): string[] {
  const paragraphs = text.split(/\n\s*\n/);
  const result: string[] = [];
  let current = "";

  for (const p of paragraphs) {
    if (current.length + p.length > MAX_CHUNK_CHARS && current) {
      result.push(current.trim());
      current = "";
    }
    current += (current ? "\n\n" : "") + p;
  }
  if (current.trim()) result.push(current.trim());
  return result;
}

async function embed(texts: string[]): Promise<number[][]> {
  const openai = new OpenAI();
  const res = await openai.embeddings.create({
    model: "text-embedding-3-small",
    input: texts,
  });
  return res.data.map((d) => d.embedding);
}

export const POST = handler(async (req, ctx) => {
  const session = await requireAuth();
  const projectId = ctx.params.id;

  // Verify contributor access
  const [access] = await db
    .select()
    .from(projectContributors)
    .where(and(eq(projectContributors.projectId, projectId), eq(projectContributors.userId, session.userId)));
  if (!access) return jsonError("Forbidden", 403);

  const { name, type, content } = await req.json();
  if (!content?.trim()) return jsonError("content required", 400);

  const [source] = await db
    .insert(sources)
    .values({
      projectId,
      type: type || "doc",
      name: name || "Untitled",
      content,
      uploadedBy: session.userId,
      status: "processing",
    })
    .returning();

  try {
    const texts = chunkText(content);
    const embeddings = await embed(texts);

    for (let i = 0; i < texts.length; i++) {
      await db.execute(
        sql`INSERT INTO chunks (source_id, content, embedding, token_count)
            VALUES (${source.id}, ${texts[i]}, ${JSON.stringify(embeddings[i])}::vector, ${Math.ceil(texts[i].length / 4)})`
      );
    }

    await db.update(sources).set({ status: "ready" }).where(eq(sources.id, source.id));
    return jsonOk({ sourceId: source.id, chunks: texts.length }, 201);
  } catch (err) {
    await db.update(sources).set({ status: "failed" }).where(eq(sources.id, source.id));
    throw err;
  }
});

export const GET = handler(async (req, ctx) => {
  const session = await requireAuth();
  const projectId = ctx.params.id;

  const [access] = await db
    .select()
    .from(projectContributors)
    .where(and(eq(projectContributors.projectId, projectId), eq(projectContributors.userId, session.userId)));
  if (!access) return jsonError("Forbidden", 403);

  const rows = await db.select().from(sources).where(eq(sources.projectId, projectId)).orderBy(sources.createdAt);
  return jsonOk(rows);
});
