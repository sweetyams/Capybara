export const dynamic = "force-dynamic";

import { db } from "@/lib/db";
import { questions, drafts, rules, sources, projectContributors } from "@/lib/db/schema";
import { requireAuth } from "@/lib/auth";
import { jsonOk, jsonError } from "@/lib/api-response";
import { handler } from "@/lib/route-handler";
import { eq, and } from "drizzle-orm";
import { sql } from "drizzle-orm";
import OpenAI from "openai";

const getOpenAI = () => new OpenAI();

export const POST = handler(async (req, ctx) => {
  const session = await requireAuth();
  const projectId = ctx.params.id;

  const [access] = await db
    .select()
    .from(projectContributors)
    .where(and(eq(projectContributors.projectId, projectId), eq(projectContributors.userId, session.userId)));
  if (!access) return jsonError("Forbidden", 403);

  const { question } = await req.json();
  if (!question?.trim()) return jsonError("question required", 400);

  const openai = getOpenAI();

  // Embed the question
  const embRes = await openai.embeddings.create({
    model: "text-embedding-3-small",
    input: question,
  });
  const qEmbedding = JSON.stringify(embRes.data[0].embedding);

  // Vector search: top 10 chunks from this project's sources
  const retrieved = await db.execute(
    sql`SELECT c.id, c.content, c.source_id, s.name as source_name,
               1 - (c.embedding <=> ${qEmbedding}::vector) as similarity
        FROM chunks c
        JOIN sources s ON s.id = c.source_id
        WHERE s.project_id = ${projectId} AND s.status = 'ready'
        ORDER BY c.embedding <=> ${qEmbedding}::vector
        LIMIT 10`
  );

  const topChunks = retrieved.rows as Array<{
    id: string; content: string; source_id: string; source_name: string; similarity: number;
  }>;

  if (!topChunks.length || topChunks[0].similarity < 0.3) {
    return jsonOk({
      draft: null,
      message: "Not enough context found. Try uploading more sources.",
    });
  }

  // Get project rules
  const projectRules = await db.select().from(rules).where(eq(rules.projectId, projectId));

  // Build LLM prompt
  const rulesBlock = projectRules.length
    ? projectRules.map((r) => `- If ${r.condition} → ${r.behavior}`).join("\n")
    : "None yet.";

  const sourcesBlock = topChunks
    .map((c, i) => `[${i + 1}] (${c.source_name})\n${c.content}`)
    .join("\n\n");

  const completion = await openai.chat.completions.create({
    model: "gpt-4o",
    temperature: 0.3,
    messages: [
      {
        role: "system",
        content: `You are helping answer questions about a project using past context.

Instructions:
- Use only the provided sources
- Prefer explicit decisions over speculation
- Be concise and confident
- Cite sources by number [1], [2], etc.

Project Rules:
${rulesBlock}

Sources:
${sourcesBlock}`,
      },
      { role: "user", content: question },
    ],
  });

  const draftContent = completion.choices[0].message.content || "";

  // Persist question + draft
  const [q] = await db
    .insert(questions)
    .values({ projectId, content: question, askedBy: session.userId })
    .returning();

  const [draft] = await db
    .insert(drafts)
    .values({
      questionId: q.id,
      projectId,
      content: draftContent,
      sourcesUsed: topChunks.map((c) => c.id),
      confidence: topChunks[0].similarity,
    })
    .returning();

  return jsonOk({
    draft: {
      id: draft.id,
      content: draftContent,
      sources: topChunks.map((c) => ({
        id: c.id,
        name: c.source_name,
        excerpt: c.content.slice(0, 200),
        similarity: c.similarity,
      })),
    },
  });
});
