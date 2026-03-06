"use client";

import { useEffect, useState, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import {
  getSession,
  saveSession,
  type Session,
} from "@/lib/storage";
import { Navbar } from "@/components/Navbar";
import { Footer } from "@/components/Footer";

interface SessionSummary {
  audioChunks: number;
  transcripts: number;
  eegChunks: number;
  toolData: number;
}

function ResultsContent() {
  const searchParams = useSearchParams();
  const sessionId = searchParams.get("id");
  const [session, setSession] = useState<Session | null>(null);
  const [summary, setSummary] = useState<SessionSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [reportLoading, setReportLoading] = useState(false);

  useEffect(() => {
    if (!sessionId) {
      setLoading(false);
      return;
    }

    const loadSession = async () => {
      const s = await getSession(sessionId);
      setSession(s);

      setLoading(false);

      if (s && (s.status === "completed" || s.status === "ended_by_tutor")) {
        if (!s.report) generateAndSaveReport(s);
      }
    };

    loadSession();
  }, [sessionId]);

  useEffect(() => {
    if (!sessionId || !session) return;

    const loadSummary = async () => {
      const supabase = (await import("@/lib/supabase/client")).createClient();
      
      const user = (await supabase.auth.getUser()).data.user;
      if (!user) return;

      const storagePath = `${user.id}/${sessionId}`;

      const [audioFiles, transcriptFiles, eegFiles, toolFiles, transcriptChunksRes] = await Promise.all([
        supabase.storage.from("session-audio").list(storagePath, { limit: 100 }),
        supabase.storage.from("session-transcript").list(storagePath, { limit: 100 }),
        supabase.storage.from("session-eeg").list(storagePath, { limit: 100 }),
        supabase.storage.from("session-tool").list(storagePath, { limit: 100 }),
        supabase
          .from("transcript_rag_chunks")
          .select("chunk_index", { count: "exact", head: true })
          .eq("session_id", sessionId),
      ]);

      const audioCount = audioFiles.data?.length || 0;
      const transcriptCount = transcriptFiles.data?.length || 0;
      const eegCount = eegFiles.data?.length || 0;
      const toolCount = toolFiles.data?.length || 0;

      const finalTranscriptCount = 
        (transcriptChunksRes.count || 0) ||
        transcriptCount;

      setSummary({
        audioChunks: audioCount,
        transcripts: finalTranscriptCount,
        eegChunks: eegCount,
        toolData: toolCount,
      });
    };

    loadSummary();
  }, [sessionId, session]);

  const generateAndSaveReport = async (s: Session) => {
    setReportLoading(true);
    try {
      const durationMin = Math.round(s.durationMs / 60000);

      const res = await fetch("/api/generate-report", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          problem: s.problem,
          duration: `${durationMin} minutes`,
          probeCount: s.probes.length,
          avgGapScore: s.probes.length > 0 
            ? s.probes.reduce((acc, p) => acc + p.gapScore, 0) / s.probes.length 
            : 0,
          probesSummary: s.probes
            .map((p, i) => `Probe ${i + 1}: ${p.text}`)
            .join("\n"),
          eegContext: undefined,
        }),
      });

      if (res.ok) {
        const { report } = await res.json();
        if (report) {
          const updatedSession = { ...s, report, reportGeneratedAt: new Date().toISOString() };
          setSession(updatedSession);
          await saveSession(updatedSession);
        }
      }
    } catch (err) {
      console.error("Report generation failed:", err);
    } finally {
      setReportLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#0a0a0a]">
        <div className="animate-spin w-8 h-8 border-2 border-blue-500 border-t-transparent rounded-full" />
      </div>
    );
  }

  if (!session) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center px-6 bg-[#0a0a0a]">
        <h1 className="text-2xl font-bold text-white mb-4">Session Not Found</h1>
        <p className="text-neutral-500 mb-8 text-sm">
          This session may have been deleted or doesn&apos;t exist.
        </p>
        <Link
          href="/"
          className="px-5 py-2.5 bg-white/10 hover:bg-white/15 text-white text-sm rounded-xl transition-colors"
        >
          Go to Dashboard
        </Link>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex flex-col bg-[#0a0a0a]">
      <Navbar 
        breadcrumbs={[
          { label: "Results" }
        ]}
      />

      <div className="flex-1 max-w-3xl mx-auto w-full px-4 sm:px-6 py-6 sm:py-8">
        <div className="mb-6">
          <h2 className="text-lg sm:text-xl font-semibold text-white mb-2">{session.problem}</h2>
          <div className="flex items-center gap-3 text-xs text-neutral-500">
            <span>
              {new Date(session.startedAt).toLocaleDateString("en-US", {
                weekday: "short",
                month: "short",
                day: "numeric",
                hour: "2-digit",
                minute: "2-digit",
              })}
            </span>
            {session.status === "ended_by_tutor" && (
              <>
                <span className="text-neutral-800">&middot;</span>
                <span className="px-1.5 py-0.5 rounded bg-amber-500/15 text-amber-400 border border-amber-500/20">
                  Ended by tutor
                </span>
              </>
            )}
          </div>
        </div>

        {summary && (
          <div className="mb-8">
            <div className="mb-2">
              <h3 className="text-xs font-medium text-neutral-500 uppercase tracking-wider">
                Stored Data Chunks
              </h3>
              <p className="text-[10px] text-neutral-600 mt-0.5">
                Audio recordings, transcriptions, EEG readings, and tool interactions captured during the session
              </p>
            </div>
            <div className="grid grid-cols-4 gap-3">
              <SummaryCard label="Audio" value={summary.audioChunks} />
              <SummaryCard label="Transcripts" value={summary.transcripts} />
              <SummaryCard label="EEG" value={summary.eegChunks} />
              <SummaryCard label="Tools" value={summary.toolData} />
            </div>
            <p className="text-[10px] text-neutral-500 mt-3">
              Your data is contributing to the{" "}
              <a href="https://huggingface.co/datasets/unsys/ghc" target="_blank" rel="noopener noreferrer" className="text-blue-400 hover:underline">
                Global Human Conversation dataset
              </a>{" "}
              to help advance AI understanding of human learning. Thank you!{" "}
              <a href="https://x.com/uncertainsys" target="_blank" rel="noopener noreferrer" className="text-blue-400 hover:underline">
                Contact us on X
              </a>{" "}
              with any questions.
            </p>
          </div>
        )}

        {session.report ? (
          <div className="rounded-xl border border-neutral-800 bg-neutral-900/50 p-5">
            <h3 className="text-sm font-medium text-neutral-300 mb-3">Session Report</h3>
            <div
              className="prose prose-sm prose-invert max-w-none text-neutral-400 leading-relaxed text-sm"
              dangerouslySetInnerHTML={{ __html: markdownToHtml(session.report) }}
            />
          </div>
        ) : reportLoading ? (
          <div className="rounded-xl border border-neutral-800 bg-neutral-900/50 p-5">
            <h3 className="text-sm font-medium text-neutral-300 mb-3">Session Report</h3>
            <div className="flex items-center gap-3 py-6 justify-center">
              <div className="animate-spin w-4 h-4 border-2 border-blue-500 border-t-transparent rounded-full" />
              <p className="text-sm text-neutral-500">Generating your session report...</p>
            </div>
          </div>
        ) : null}

        <div className="flex justify-center mt-8 pb-8">
          <Link
            href="/dashboard"
            className="px-6 py-2.5 bg-white/10 hover:bg-white/15 text-white text-sm font-medium rounded-xl transition-colors"
          >
            Back to Dashboard
          </Link>
        </div>
      </div>
      <Footer />
    </div>
  );
}

export default function ResultsPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen flex items-center justify-center bg-[#0a0a0a]">
          <div className="animate-spin w-8 h-8 border-2 border-blue-500 border-t-transparent rounded-full" />
        </div>
      }
    >
      <ResultsContent />
    </Suspense>
  );
}

function SummaryCard({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-xl border border-neutral-800 bg-neutral-900/50 p-3 text-center">
      <p className="text-[11px] text-neutral-600 uppercase tracking-wider">{label}</p>
      <p className="text-xl font-bold text-white mt-1">{value}</p>
    </div>
  );
}

function markdownToHtml(markdown: string): string {
  return markdown
    .replace(/^### (.*$)/gm, '<h3 class="text-neutral-200 font-medium mt-4 mb-2 text-sm">$1</h3>')
    .replace(/^## (.*$)/gm, '<h2 class="text-neutral-200 font-medium mt-5 mb-2">$1</h2>')
    .replace(/^# (.*$)/gm, '<h1 class="text-white font-semibold mt-6 mb-3">$1</h1>')
    .replace(/\*\*(.*?)\*\*/g, '<strong class="text-neutral-200">$1</strong>')
    .replace(/\*(.*?)\*/g, "<em>$1</em>")
    .replace(/^- (.*$)/gm, '<li class="ml-4">$1</li>')
    .replace(/^(\d+)\. (.*$)/gm, '<li class="ml-4">$2</li>')
    .replace(/\n\n/g, '</p><p class="mb-2">')
    .replace(/\n/g, "<br/>")
    .replace(/^/, '<p class="mb-2">')
    .replace(/$/, "</p>");
}