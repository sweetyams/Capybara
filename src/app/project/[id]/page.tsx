"use client";

import { useEffect, useState, useCallback } from "react";
import { useParams, useRouter } from "next/navigation";
import { UserButton } from "@clerk/nextjs";

interface Source {
  id: string;
  name: string;
  type: string;
  status: string;
  createdAt: string;
}

interface DraftSource {
  id: string;
  name: string;
  excerpt: string;
  similarity: number;
}

interface Draft {
  id: string;
  content: string;
  sources: DraftSource[];
}

interface Rule {
  id: string;
  condition: string;
  behavior: string;
}

export default function ProjectPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();

  const [sources, setSources] = useState<Source[]>([]);
  const [rules, setRules] = useState<Rule[]>([]);
  const [draft, setDraft] = useState<Draft | null>(null);
  const [noContext, setNoContext] = useState("");

  // Upload state
  const [uploadName, setUploadName] = useState("");
  const [uploadContent, setUploadContent] = useState("");
  const [uploading, setUploading] = useState(false);

  // Ask state
  const [question, setQuestion] = useState("");
  const [asking, setAsking] = useState(false);

  // Feedback state
  const [feedbackSent, setFeedbackSent] = useState("");
  const [teachMode, setTeachMode] = useState(false);
  const [teachCondition, setTeachCondition] = useState("");
  const [teachBehavior, setTeachBehavior] = useState("");

  // Slack state
  const [slackChannels, setSlackChannels] = useState<Array<{ id: string; channelId: string; channelName: string | null }>>([]);
  const [slackChannelId, setSlackChannelId] = useState("");
  const [slackChannelName, setSlackChannelName] = useState("");

  const loadSources = useCallback(() => {
    fetch(`/api/projects/${id}/sources`).then((r) => r.json()).then((d) => setSources(d.data ?? []));
  }, [id]);

  const loadRules = useCallback(() => {
    fetch(`/api/projects/${id}/rules`).then((r) => r.json()).then((d) => setRules(d.data ?? []));
  }, [id]);

  const loadSlack = useCallback(() => {
    fetch(`/api/projects/${id}/slack`).then((r) => r.json()).then((d) => setSlackChannels(d.data ?? []));
  }, [id]);

  useEffect(() => {
    loadSources();
    loadRules();
    loadSlack();
  }, [loadSources, loadRules, loadSlack]);

  function handleFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!uploadName) setUploadName(file.name);
    const reader = new FileReader();
    reader.onload = () => setUploadContent(reader.result as string);
    reader.readAsText(file);
  }

  async function upload(e: React.FormEvent) {
    e.preventDefault();
    if (!uploadContent.trim() || uploading) return;
    setUploading(true);
    await fetch(`/api/projects/${id}/sources`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: uploadName || "Untitled", type: "doc", content: uploadContent }),
    });
    setUploadName("");
    setUploadContent("");
    setUploading(false);
    loadSources();
  }

  async function ask(e: React.FormEvent) {
    e.preventDefault();
    if (!question.trim() || asking) return;
    setAsking(true);
    setDraft(null);
    setNoContext("");
    setFeedbackSent("");
    setTeachMode(false);
    const res = await fetch(`/api/projects/${id}/ask`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ question }),
    });
    const { data } = await res.json();
    if (data?.draft) {
      setDraft(data.draft);
    } else {
      setNoContext(data?.message || "No context found.");
    }
    setAsking(false);
  }

  async function sendFeedback(type: string) {
    if (!draft) return;
    await fetch(`/api/projects/${id}/feedback`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ draftId: draft.id, type }),
    });
    setFeedbackSent(type);
  }

  async function sendTeach() {
    if (!draft || !teachCondition.trim() || !teachBehavior.trim()) return;
    await fetch(`/api/projects/${id}/feedback`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        draftId: draft.id,
        type: "teach",
        rule: { condition: teachCondition, behavior: teachBehavior },
      }),
    });
    setFeedbackSent("teach");
    setTeachMode(false);
    setTeachCondition("");
    setTeachBehavior("");
    loadRules();
  }

  async function deleteRule(ruleId: string) {
    await fetch(`/api/projects/${id}/rules`, {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ruleId }),
    });
    loadRules();
  }

  async function connectSlack(e: React.FormEvent) {
    e.preventDefault();
    if (!slackChannelId.trim()) return;
    await fetch(`/api/projects/${id}/slack`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ channelId: slackChannelId, channelName: slackChannelName || slackChannelId }),
    });
    setSlackChannelId("");
    setSlackChannelName("");
    loadSlack();
  }

  async function disconnectSlack(channelId: string) {
    await fetch(`/api/projects/${id}/slack`, {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ channelId }),
    });
    loadSlack();
  }

  const sectionClass = "rounded-xl border border-zinc-200 dark:border-zinc-800 p-5";
  const labelClass = "text-xs font-semibold uppercase tracking-wider text-zinc-400 mb-3 block";
  const inputClass = "w-full px-3 py-2 rounded-lg border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-900 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500";
  const btnPrimary = "px-4 py-2 rounded-lg bg-indigo-600 text-white text-sm font-medium hover:bg-indigo-700 disabled:opacity-50";
  const btnGhost = "px-3 py-1.5 rounded-lg border border-zinc-300 dark:border-zinc-700 text-sm hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors";

  return (
    <div className="flex flex-col flex-1">
      <header className="flex items-center justify-between px-6 py-4 border-b border-zinc-200 dark:border-zinc-800">
        <div className="flex items-center gap-3">
          <button onClick={() => router.push("/")} className="text-sm text-zinc-400 hover:text-zinc-600">← Projects</button>
        </div>
        <UserButton />
      </header>

      <main className="flex-1 max-w-2xl mx-auto w-full px-6 py-8 space-y-6">
        {/* Sources */}
        <div className={sectionClass}>
          <span className={labelClass}>Context Sources</span>
          {sources.length === 0 ? (
            <p className="text-sm text-zinc-500">No sources yet. Upload one below.</p>
          ) : (
            <div className="space-y-1 mb-4">
              {sources.map((s) => (
                <div key={s.id} className="flex items-center gap-2 text-sm py-1">
                  <span className={`w-2 h-2 rounded-full ${s.status === "ready" ? "bg-green-500" : s.status === "failed" ? "bg-red-500" : "bg-yellow-500"}`} />
                  <span className="font-medium">{s.name}</span>
                  <span className="text-zinc-400 text-xs">({s.type})</span>
                </div>
              ))}
            </div>
          )}
          <form onSubmit={upload} className="space-y-2 pt-3 border-t border-zinc-100 dark:border-zinc-800">
            <input value={uploadName} onChange={(e) => setUploadName(e.target.value)} placeholder="Source name" className={inputClass} />
            <input type="file" accept=".txt,.md,.csv,.json" onChange={handleFile} className="block text-sm text-zinc-500 file:mr-3 file:py-1.5 file:px-3 file:rounded-lg file:border file:border-zinc-300 dark:file:border-zinc-700 file:text-sm file:bg-white dark:file:bg-zinc-900 file:cursor-pointer" />
            <textarea
              value={uploadContent}
              onChange={(e) => setUploadContent(e.target.value)}
              placeholder="Or paste text directly…"
              rows={4}
              className={inputClass}
            />
            <button type="submit" disabled={uploading || !uploadContent.trim()} className={btnPrimary}>
              {uploading ? "Uploading…" : "Upload Context"}
            </button>
          </form>
        </div>

        {/* Ask */}
        <div className={sectionClass}>
          <span className={labelClass}>Ask a Question</span>
          <form onSubmit={ask} className="flex gap-2">
            <input
              value={question}
              onChange={(e) => setQuestion(e.target.value)}
              placeholder="e.g. Do we still call this supplier delivery?"
              className={`flex-1 ${inputClass}`}
            />
            <button type="submit" disabled={asking || !question.trim()} className={btnPrimary}>
              {asking ? "Thinking…" : "Ask"}
            </button>
          </form>
        </div>

        {/* Draft */}
        {(draft || noContext || asking) && (
          <div className={sectionClass}>
            <span className={labelClass}>Draft Reply</span>
            {asking ? (
              <p className="text-sm text-zinc-500 animate-pulse">Generating draft…</p>
            ) : noContext ? (
              <p className="text-sm text-zinc-500">{noContext}</p>
            ) : draft ? (
              <>
                <div className="prose prose-sm dark:prose-invert max-w-none mb-4 whitespace-pre-wrap">{draft.content}</div>
                {draft.sources.length > 0 && (
                  <details className="mb-4">
                    <summary className="text-xs text-zinc-400 cursor-pointer">Sources used ({draft.sources.length})</summary>
                    <div className="mt-2 space-y-1">
                      {draft.sources.map((s) => (
                        <div key={s.id} className="text-xs text-zinc-500 pl-3 border-l-2 border-zinc-200 dark:border-zinc-700">
                          <span className="font-medium">{s.name}</span> — {s.excerpt}…
                        </div>
                      ))}
                    </div>
                  </details>
                )}
                {feedbackSent ? (
                  <p className="text-sm text-green-600">✓ Feedback recorded: {feedbackSent}</p>
                ) : (
                  <div className="flex flex-wrap gap-2">
                    <button onClick={() => sendFeedback("approved")} className={btnGhost}>✓ Approve</button>
                    <button onClick={() => sendFeedback("edited")} className={btnGhost}>✎ Edited</button>
                    <button onClick={() => sendFeedback("rejected")} className={btnGhost}>✗ Reject</button>
                    <button onClick={() => setTeachMode(true)} className={btnGhost}>💡 Teach</button>
                  </div>
                )}
                {teachMode && (
                  <div className="mt-3 space-y-2 p-3 rounded-lg bg-zinc-50 dark:bg-zinc-900">
                    <p className="text-xs text-zinc-500">Teach the system a rule for this project:</p>
                    <input value={teachCondition} onChange={(e) => setTeachCondition(e.target.value)} placeholder="If… (condition)" className={inputClass} />
                    <input value={teachBehavior} onChange={(e) => setTeachBehavior(e.target.value)} placeholder="Then… (behavior)" className={inputClass} />
                    <button onClick={sendTeach} disabled={!teachCondition.trim() || !teachBehavior.trim()} className={btnPrimary}>Remember</button>
                  </div>
                )}
              </>
            ) : null}
          </div>
        )}

        {/* Slack */}
        <div className={sectionClass}>
          <span className={labelClass}>Slack Integration</span>
          {slackChannels.length > 0 && (
            <div className="space-y-1 mb-3">
              {slackChannels.map((ch) => (
                <div key={ch.id} className="flex items-center gap-2 text-sm">
                  <span className="w-2 h-2 rounded-full bg-green-500" />
                  <span className="font-medium">#{ch.channelName || ch.channelId}</span>
                  <button onClick={() => disconnectSlack(ch.channelId)} className="ml-auto text-xs text-zinc-400 hover:text-red-500">Disconnect</button>
                </div>
              ))}
            </div>
          )}
          <form onSubmit={connectSlack} className="flex gap-2">
            <input value={slackChannelId} onChange={(e) => setSlackChannelId(e.target.value)} placeholder="Channel ID (e.g. C07XXXXXX)" className={`flex-1 ${inputClass}`} />
            <input value={slackChannelName} onChange={(e) => setSlackChannelName(e.target.value)} placeholder="Name (optional)" className={`w-36 ${inputClass}`} />
            <button type="submit" disabled={!slackChannelId.trim()} className={btnPrimary}>Connect</button>
          </form>
          <p className="text-xs text-zinc-400 mt-2">Messages in connected channels will trigger context-aware replies.</p>
        </div>

        {/* Rules */}
        {rules.length > 0 && (
          <div className={sectionClass}>
            <span className={labelClass}>Learned Rules</span>
            <div className="space-y-2">
              {rules.map((r) => (
                <div key={r.id} className="flex items-start gap-2 text-sm">
                  <div className="flex-1">
                    <span className="text-zinc-500">If</span> {r.condition} <span className="text-zinc-500">→</span> {r.behavior}
                  </div>
                  <button onClick={() => deleteRule(r.id)} className="text-xs text-zinc-400 hover:text-red-500">×</button>
                </div>
              ))}
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
