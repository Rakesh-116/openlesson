"use client";

import { useState } from "react";
import { ProblemInput } from "@/components/ProblemInput";
import { TopicBrowser } from "@/components/TopicBrowser";
import { PlanModeSelect } from "@/components/PlanModeSelect";
import { AgenticModeSelect } from "@/components/AgenticModeSelect";
import { Footer } from "@/components/Footer";
import { Navbar } from "@/components/Navbar";
import { DemoBanner } from "@/components/DemoBanner";

type Mode = "session" | "plan" | "agentic";

export default function Home() {
  const [selectedTopic, setSelectedTopic] = useState("");
  const [mode, setMode] = useState<Mode>("session");

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
              Learn
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
            {/* Hero Text */}
            <div className="text-center mb-8">
              <h1 className="text-3xl sm:text-4xl lg:text-5xl font-bold text-white mb-4 tracking-tight">
                What Do You Want to Learn Today?
              </h1>
              <p className="text-slate-400 max-w-xl mx-auto text-base sm:text-lg leading-relaxed">
                Your personal AI tutor that guides you through any topic. 
                Speak your thoughts — get the right questions to deepen your understanding.
              </p>
            </div>

            {/* Problem Input */}
            <ProblemInput initialTopic={selectedTopic} theme="slate" />

            {/* Topic Browser */}
            <div className="w-full max-w-3xl mx-auto mt-6 rounded-2xl border border-slate-800/60 bg-slate-900/30 p-4 sm:p-5">
              <TopicBrowser onSelectTopic={setSelectedTopic} fullWidth />
            </div>
          </>
        )}

        {mode === "plan" && <PlanModeSelect theme="slate" />}

        {mode === "agentic" && <AgenticModeSelect />}
      </div>

      <Footer />
    </main>
  );
}
