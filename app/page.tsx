"use client";

import { useState, useEffect } from "react";
import { ProblemInput } from "@/components/ProblemInput";
import { TopicBrowser } from "@/components/TopicBrowser";
import { PlanModeSelect } from "@/components/PlanModeSelect";
import { AgenticModeSelect } from "@/components/AgenticModeSelect";
import { Footer } from "@/components/Footer";
import Link from "next/link";
import { createBrowserClient } from "@supabase/ssr";

type Mode = "session" | "plan" | "agentic";

export default function Home() {
  const [selectedTopic, setSelectedTopic] = useState("");
  const [isLoggedIn, setIsLoggedIn] = useState<boolean | null>(null);
  const [mode, setMode] = useState<Mode>("session");

  useEffect(() => {
    const supabase = createBrowserClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
    );
    supabase.auth.getUser().then(({ data }) => {
      setIsLoggedIn(!!data.user);
    });
  }, []);

  return (
    <main className="min-h-screen flex flex-col bg-[#0a0a0a]">
      {/* Header */}
      <header className="border-b border-neutral-800/60 px-4 sm:px-6 py-4 backdrop-blur-sm bg-[#0a0a0a]/80 sticky top-0 z-20">
        <div className="max-w-5xl mx-auto flex items-center justify-between">
          <Link href="/" className="text-base sm:text-lg font-semibold text-white tracking-tight hover:text-neutral-300 transition-colors">
            openLesson
          </Link>
          <div className="flex items-center gap-3 sm:gap-4">
            <Link href="/pricing" className="text-xs sm:text-sm text-neutral-500 hover:text-white transition-colors">
              Pricing
            </Link>
            <Link href="/coaching" className="text-xs sm:text-sm text-neutral-500 hover:text-white transition-colors">
              Coaching
            </Link>
            <Link href="/dashboard" className="text-xs sm:text-sm text-neutral-500 hover:text-white transition-colors">
              Dashboard
            </Link>
            {isLoggedIn === false && (
              <Link href="/login" className="px-3 sm:px-3.5 py-1.5 text-xs sm:text-sm bg-white/10 hover:bg-white/15 text-white rounded-lg transition-colors">
                Sign In
              </Link>
            )}
          </div>
        </div>
      </header>

      {/* Mode Toggle */}
      <div>
        <div className="max-w-5xl mx-auto px-4 sm:px-6 py-4">
          <div className="flex justify-center">
            <div className="bg-neutral-900/80 rounded-xl p-1 flex gap-1 border border-neutral-800">
              <button
                onClick={() => setMode("session")}
                className={`px-6 py-2 text-sm font-medium rounded-lg transition-all ${
                  mode === "session"
                    ? "bg-white/15 text-white shadow-sm"
                    : "text-neutral-500 hover:text-white"
                }`}
              >
                Session
              </button>
              <button
                onClick={() => setMode("plan")}
                className={`px-6 py-2 text-sm font-medium rounded-lg transition-all ${
                  mode === "plan"
                    ? "bg-white/15 text-white shadow-sm"
                    : "text-neutral-500 hover:text-white"
                }`}
              >
                Plan
              </button>
              <button
                onClick={() => setMode("agentic")}
                className={`px-6 py-2 text-sm font-medium rounded-lg transition-all ${
                  mode === "agentic"
                    ? "bg-white/15 text-white shadow-sm"
                    : "text-neutral-500 hover:text-white"
                }`}
              >
                Agentic
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Hero */}
      <div className="flex-1 flex flex-col items-center justify-center px-4 sm:px-6 py-10 sm:py-16">
        {mode === "session" && (
          <>
            <div className="text-center mb-10">
              <h2 className="text-3xl sm:text-4xl font-bold text-white mb-4 tracking-tight">
                What do you want to Learn today?
              </h2>
              <p className="text-neutral-500 max-w-lg mx-auto text-sm leading-relaxed">
                Pick a topic, start talking through it. Your tutor listens for reasoning gaps
                and asks you the right questions — never gives answers.
              </p>
            </div>

            <ProblemInput initialTopic={selectedTopic} />

            <div className="mt-12" />

            <TopicBrowser onSelectTopic={setSelectedTopic} />
          </>
        )}

        {mode === "plan" && <PlanModeSelect />}

        {mode === "agentic" && <AgenticModeSelect />}
      </div>

      <Footer />
    </main>
  );
}
