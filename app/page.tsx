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

      {/* Hero */}
      <div className="flex-1 flex flex-col items-center justify-center px-4 sm:px-6 py-6">
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
              Session
            </button>
            <button
              onClick={() => setMode("plan")}
              className={`px-6 py-2 text-sm font-medium rounded-lg transition-all ${
                mode === "plan"
                  ? "bg-slate-700/50 text-slate-200 shadow-sm border border-slate-600"
                  : "text-slate-500 hover:text-white"
              }`}
            >
              Plan
            </button>
            <button
              onClick={() => setMode("agentic")}
              className={`px-6 py-2 text-sm font-medium rounded-lg transition-all ${
                mode === "agentic"
                  ? "bg-slate-700/50 text-slate-200 shadow-sm border border-slate-600"
                  : "text-slate-500 hover:text-white"
              }`}
            >
              Agentic
            </button>
          </div>
        </div>

        {mode === "session" && (
          <>
            <div className="text-center mb-8">
              <h2 className="text-3xl sm:text-4xl font-bold text-white mb-4 tracking-tight">
                What do you want to Learn today?
              </h2>
              <p className="text-slate-500 max-w-lg mx-auto text-sm leading-relaxed">
                Pick a topic, start talking through it. Your tutor listens for reasoning gaps
                and asks you the right questions — never gives answers.
              </p>
            </div>

            <ProblemInput initialTopic={selectedTopic} theme="slate" />

            <div className="w-full my-8">
              <div className="h-px bg-slate-800" />
            </div>

            <TopicBrowser onSelectTopic={setSelectedTopic} fullWidth />
          </>
        )}

        {mode === "plan" && <PlanModeSelect theme="slate" />}

        {mode === "agentic" && <AgenticModeSelect />}
      </div>

      <Footer />
    </main>
  );
}
