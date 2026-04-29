export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { createHmac, timingSafeEqual } from "crypto";
import { db } from "@/lib/db";
import { slackChannels, rules } from "@/lib/db/schema";
import { eq, sql } from "drizzle-orm";

function log(label: string, data?: unknown) {
  console.log(`[slack] ${label}`, data ? JSON.stringify(data, null, 2) : "");
}

function verifySlack(body: string, timestamp: string, signature: string): boolean {
  const secret = process.env.SLACK_SIGNING_SECRET;
  if (!secret || !signature || !timestamp) return false;
  const expected = "v0=" + createHmac("sha256", secret).update(`v0:${timestamp}:${body}`).digest("hex");
  if (expected.length !== signature.length) return false;
  return timingSafeEqual(Buffer.from(expected), Buffer.from(signature));
}

export async function POST(request: NextRequest) {
  const rawBody = await request.text();
  const timestamp = request.headers.get("x-slack-request-timestamp") || "";
  const signature = request.headers.get("x-slack-signature") || "";

  log("incoming", { bodyLength: rawBody.length });

  const body = JSON.parse(rawBody);

  if (body.type === "url_verification") {
    return NextResponse.json({ challenge: body.challenge });
  }

  if (!verifySlack(rawBody, timestamp, signature)) {
    log("ERROR: invalid signature");
    return NextResponse.json({ error: "invalid signature" }, { status: 401 });
  }

  log("event", { type: body.event?.type, channel: body.event?.channel, text: body.event?.text?.slice(0, 100), bot_id: body.event?.bot_id });

  if (body.event?.type === "message" && !body.event.bot_id && !body.event.subtype) {
    processMessage(body.event).catch((err) => log("ERROR", { error: String(err) }));
  }

  return NextResponse.json({ ok: true });
}

async function processMessage(event: { channel: string; text: string; ts: string; user: string }) {
  const { WebClient } = await import("@slack/web-api");
  const OpenAI = (await import("openai")).default;
  const openai = new OpenAI();
  const slack = new WebClient(process.env.SLACK_BOT_TOKEN);

  const [link] = await db.select().from(slackChannels).where(eq(slackChannels.channelId, event.channel));
  if (!link) { log("no project for channel", { channel: event.channel }); return; }

  log("project found", { projectId: link.projectId });

  const embRes = await openai.embeddings.create({ model: "text-embedding-3-small", input: event.text });
  const qEmbedding = JSON.stringify(embRes.data[0].embedding);

  const retrieved = await db.execute(
    sql`SELECT c.content, s.name as source_name, 1 - (c.embedding <=> ${qEmbedding}::vector) as similarity
        FROM chunks c JOIN sources s ON s.id = c.source_id
        WHERE s.project_id = ${link.projectId} AND s.status = 'ready'
        ORDER BY c.embedding <=> ${qEmbedding}::vector LIMIT 5`
  );

  const topChunks = retrieved.rows as Array<{ content: string; source_name: string; similarity: number }>;
  log("retrieval", { count: topChunks.length, topSim: topChunks[0]?.similarity });

  if (!topChunks.length || topChunks[0].similarity < 0.3) {
    await slack.chat.postMessage({ channel: event.channel, thread_ts: event.ts, text: "🤷 I don't have enough context for this project yet." });
    return;
  }

  const projectRules = await db.select().from(rules).where(eq(rules.projectId, link.projectId));
  const rulesBlock = projectRules.length ? projectRules.map((r) => `- If ${r.condition} → ${r.behavior}`).join("\n") : "None.";
  const sourcesBlock = topChunks.map((c, i) => `[${i + 1}] (${c.source_name})\n${c.content}`).join("\n\n");

  const completion = await openai.chat.completions.create({
    model: "gpt-4o",
    temperature: 0.3,
    messages: [
      { role: "system", content: `You are a project assistant replying in a Slack thread. Be concise and helpful.\nUse only the provided sources. Cite by number [1], [2], etc.\n\nProject Rules:\n${rulesBlock}\n\nSources:\n${sourcesBlock}` },
      { role: "user", content: event.text },
    ],
  });

  const draft = completion.choices[0].message.content || "I couldn't generate a response.";
  log("draft generated", { length: draft.length });

  const result = await slack.chat.postMessage({ channel: event.channel, thread_ts: event.ts, text: draft });
  log("posted", { ok: result.ok });
}
