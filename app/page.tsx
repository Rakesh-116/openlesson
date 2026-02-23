"use client";

import { useState } from "react";
import { ProblemInput } from "@/components/ProblemInput";
import { TopicBrowser } from "@/components/TopicBrowser";
import { PlanModeSelect } from "@/components/PlanModeSelect";
import { AgenticModeSelect } from "@/components/AgenticModeSelect";
import { Footer } from "@/components/Footer";
import { Navbar } from "@/components/Navbar";

type Mode = "session" | "plan" | "agentic";

export default function Home() {
  const [selectedTopic, setSelectedTopic] = useState("");
  const [mode, setMode] = useState<Mode>("session");

  return (
    <main className="min-h-screen flex flex-col bg-[#0a0a0a]">
      <Navbar />

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
