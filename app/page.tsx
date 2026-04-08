"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { createBrowserClient } from "@supabase/ssr";
import { ProblemInput } from "@/components/ProblemInput";
import { TopicBrowser } from "@/components/TopicBrowser";
import { PlanModeSelect } from "@/components/PlanModeSelect";
import { AgenticModeSelect } from "@/components/AgenticModeSelect";
import { Footer } from "@/components/Footer";
import { Navbar } from "@/components/Navbar";
import { DemoBanner } from "@/components/DemoBanner";
import { useI18n } from "@/lib/i18n";
import Link from "next/link";

type Mode = "session" | "plan" | "agentic";

interface RecentPlan {
  id: string;
  title: string;
  root_topic: string;
  cover_image_url?: string;
  created_at: string;
  status: string;
}

interface RecentSession {
  id: string;
  problem: string;
  status: string;
  created_at: string;
}

function RecentPlanCards({ plans }: { plans: RecentPlan[] }) {
  const router = useRouter();
  const { t } = useI18n();
  if (plans.length === 0) return null;

  return (
    <div className="w-full max-w-3xl mx-auto mt-6">
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-sm font-medium text-slate-500">{t('home.recentPlans')}</h3>
        <Link href="/dashboard?tab=plans" className="text-xs text-slate-500 hover:text-white transition-colors">{t('home.showAll')}</Link>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        {plans.map((plan) => (
          <Link
            key={plan.id}
            href={`/plan/${plan.id}`}
            className="group relative overflow-hidden rounded-xl border border-slate-800/60 h-32 flex flex-col justify-end transition-all hover:border-slate-700 hover:shadow-lg hover:shadow-black/20"
          >
            {/* Background: cover image or gradient */}
            {plan.cover_image_url ? (
              <img
                src={plan.cover_image_url}
                alt=""
                className="absolute inset-0 w-full h-full object-cover transition-transform group-hover:scale-105"
              />
            ) : (
              <div className="absolute inset-0 bg-gradient-to-br from-violet-950/60 via-slate-900 to-emerald-950/40" />
            )}
            {/* Gradient overlay */}
            <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/30 to-transparent" />
            {/* Content */}
            <div className="relative z-10 p-3">
              <p className="text-sm font-medium text-white truncate drop-shadow-md">
                {plan.title || plan.root_topic}
              </p>
              <p className="text-[11px] text-white/50 mt-0.5">
                {new Date(plan.created_at).toLocaleDateString()}
              </p>
            </div>
          </Link>
        ))}
      </div>
    </div>
  );
}

function RecentSessionCards({ sessions }: { sessions: RecentSession[] }) {
  const { t } = useI18n();
  if (sessions.length === 0) return null;

  return (
    <div className="w-full max-w-3xl mx-auto mt-6">
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-sm font-medium text-slate-500">{t('home.recentSessions')}</h3>
        <Link href="/dashboard?tab=sessions" className="text-xs text-slate-500 hover:text-white transition-colors">{t('home.showAll')}</Link>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        {sessions.map((session) => (
          <Link
            key={session.id}
            href={`/session?id=${session.id}`}
            className="group relative overflow-hidden rounded-xl border border-slate-800/60 bg-slate-900/40 p-3.5 transition-all hover:border-slate-700 hover:bg-slate-900/60"
          >
            <p className="text-sm font-medium text-white truncate">
              {session.problem}
            </p>
            <div className="flex items-center gap-2 mt-1.5">
              <span className="text-[11px] text-slate-500">
                {new Date(session.created_at).toLocaleDateString()}
              </span>
              <span className={`text-[10px] px-1.5 py-0.5 rounded-full ${
                session.status === "completed" || session.status === "ended_by_tutor"
                  ? "bg-green-900/30 text-green-400"
                  : session.status === "active"
                    ? "bg-blue-900/30 text-blue-400"
                    : "bg-slate-800 text-slate-500"
              }`}>
                {session.status === "ended_by_tutor" ? t('home.statusCompleted') : session.status}
              </span>
            </div>
          </Link>
        ))}
      </div>
    </div>
  );
}

export default function Home() {
  const [selectedTopic, setSelectedTopic] = useState("");
  const [mode, setMode] = useState<Mode>("plan");
  const { t } = useI18n();

  const [recentPlans, setRecentPlans] = useState<RecentPlan[]>([]);
  const [recentSessions, setRecentSessions] = useState<RecentSession[]>([]);
  const [isLoggedIn, setIsLoggedIn] = useState(false);

  useEffect(() => {
    const supabase = createBrowserClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
    );

    async function loadRecents() {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      setIsLoggedIn(true);

      // Fetch recent plans and sessions in parallel
      const [plansRes, sessionsRes] = await Promise.all([
        supabase
          .from("learning_plans")
          .select("id, title, root_topic, cover_image_url, created_at, status")
          .eq("user_id", user.id)
          .order("created_at", { ascending: false })
          .limit(3),
        supabase
          .from("sessions")
          .select("id, problem, status, created_at")
          .eq("user_id", user.id)
          .not("status", "in", '("completed","ended_by_tutor")')
          .order("created_at", { ascending: false })
          .limit(3),
      ]);

      if (plansRes.data) setRecentPlans(plansRes.data);
      if (sessionsRes.data) setRecentSessions(sessionsRes.data);
    }

    loadRecents();
  }, []);

  return (
    <main className="min-h-screen flex flex-col bg-[#0a0a0a]">
      <DemoBanner />
      <Navbar />

      {/* Hero Section */}
      <div className="flex flex-col items-center px-4 sm:px-6 py-8 sm:py-12">
        {/* Mode Toggle */}
        <div className="flex justify-center mb-8">
          <div className="bg-slate-900/80 rounded-xl p-1 flex gap-1 border border-slate-800">
            <button
              onClick={() => setMode("session")}
              className={`px-6 py-2 text-sm font-medium rounded-lg transition-all ${
                mode === "session"
                  ? "bg-slate-700/50 text-slate-200 shadow-sm border border-slate-600"
                  : "text-slate-500 hover:text-white"
              }`}
            >
              {t('home.learn')}
            </button>
            <button
              onClick={() => setMode("plan")}
              className={`px-6 py-2 text-sm font-medium rounded-lg transition-all ${
                mode === "plan"
                  ? "bg-slate-700/50 text-slate-200 shadow-sm border border-slate-600"
                  : "text-slate-500 hover:text-white"
              }`}
            >
              {t('home.plan')}
            </button>
            <button
              onClick={() => setMode("agentic")}
              className={`px-6 py-2 text-sm font-medium rounded-lg transition-all ${
                mode === "agentic"
                  ? "bg-slate-700/50 text-slate-200 shadow-sm border border-slate-600"
                  : "text-slate-500 hover:text-white"
              }`}
            >
              {t('home.agentic')}
            </button>
          </div>
        </div>

        {mode === "session" && (
          <>
            {/* Hero Text */}
            <div className="text-center mb-8">
              <h1 className="text-3xl sm:text-4xl lg:text-5xl font-bold text-white mb-4 tracking-tight">
                {t('home.heroTitle')}
              </h1>
              <p className="text-slate-400 max-w-xl mx-auto text-base sm:text-lg leading-relaxed">
                {t('home.heroSubtitle')}
              </p>
            </div>

            {/* Problem Input */}
            <ProblemInput initialTopic={selectedTopic} theme="slate" />

            {/* Recent Sessions */}
            {isLoggedIn && recentSessions.length > 0 && (
              <RecentSessionCards sessions={recentSessions} />
            )}

            {/* Topic Browser */}
            <div className="w-full max-w-3xl mx-auto mt-6 rounded-2xl border border-slate-800/60 bg-slate-900/30 p-4 sm:p-5">
              <TopicBrowser onSelectTopic={setSelectedTopic} fullWidth />
            </div>
          </>
        )}

        {mode === "plan" && (
          <>
            <PlanModeSelect theme="slate" />

            {/* Recent Plans */}
            {isLoggedIn && recentPlans.length > 0 && (
              <RecentPlanCards plans={recentPlans} />
            )}
          </>
        )}

        {mode === "agentic" && <AgenticModeSelect />}
      </div>

      <Footer />
    </main>
  );
}
