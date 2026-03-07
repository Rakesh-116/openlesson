"use client";

import { useState } from "react";
import { ProblemInput } from "@/components/ProblemInput";
import { PlanModeSelect } from "@/components/PlanModeSelect";
import { Footer } from "@/components/Footer";
import { Navbar } from "@/components/Navbar";

type Mode = "session" | "plan";

const EVAL_TOPICS = [
  { topic: "Evaluate my Python skills: implement a binary search tree", category: "Technical Interview", emoji: "🌳" },
  { topic: "Test my SQL: write a query to find duplicate emails", category: "Database", emoji: "🗃️" },
  { topic: "System design: design a URL shortener", category: "System Design", emoji: "🔗" },
  { topic: "Explain Big-O of this algorithm and optimize it", category: "Algorithms", emoji: "📊" },
];

export default function EvalPage() {
  const [selectedTopic, setSelectedTopic] = useState("");
  const [mode, setMode] = useState<Mode>("session");

  return (
    <main className="min-h-screen flex flex-col bg-[#0a0a0a]">
      <Navbar />

      <div className="flex-1 flex items-center justify-center px-4 sm:px-6 py-6 lg:py-4">
        <div className="w-full max-w-7xl grid grid-cols-1 lg:grid-cols-2 gap-6 lg:gap-10 items-stretch">
          
          {/* Left Column - Visual/Mock */}
          <div className="order-2 lg:order-1 flex flex-col">
            <div className="rounded-2xl border border-slate-800 bg-slate-900/30 overflow-hidden flex-1 flex flex-col">
              <div className="bg-slate-800/50 px-5 py-2.5 border-b border-slate-800 flex items-center justify-between">
                <span className="text-sm font-medium text-slate-300">Assessment Results</span>
                <span className="text-xs text-slate-500">Sample Report</span>
              </div>
              <div className="p-5 flex-1 flex flex-col justify-between">
                <div className="flex items-center gap-6 mb-4">
                  <div className="w-20 h-20 rounded-full border-4 border-emerald-500 flex items-center justify-center">
                    <span className="text-xl font-bold text-emerald-400">78%</span>
                  </div>
                  <div>
                    <h3 className="text-lg font-semibold text-white mb-1">Overall: Proficient</h3>
                    <p className="text-sm text-slate-400">Python, SQL, System Design</p>
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-3 flex-1">
                  {[
                    { skill: "Algorithms", score: 85, status: "Advanced" },
                    { skill: "System Design", score: 72, status: "Proficient" },
                    { skill: "SQL", score: 91, status: "Advanced" },
                    { skill: "Debugging", score: 64, status: "Needs Work" },
                  ].map(({ skill, score, status }) => (
                    <div key={skill} className="bg-slate-800/50 rounded-xl p-3 flex flex-col justify-center">
                      <p className="text-xs text-slate-400 mb-1.5">{skill}</p>
                      <div className="flex items-center justify-between">
                        <span className="text-lg font-bold text-white">{score}%</span>
                        <span className={`text-[10px] px-2 py-0.5 rounded ${
                          status === "Advanced" ? "bg-emerald-500/20 text-emerald-400" :
                          status === "Proficient" ? "bg-blue-500/20 text-blue-400" :
                          "bg-amber-500/20 text-amber-400"
                        }`}>{status}</span>
                      </div>
                    </div>
                  ))}
                </div>
                <div className="mt-4 pt-4 border-t border-slate-800">
                  <p className="text-xs text-slate-500">
                    "Strong fundamentals in algorithms and SQL. Debugging async patterns needs improvement."
                  </p>
                </div>
              </div>
            </div>

          </div>

          {/* Right Column - Mode Toggle + Prompt + Topics */}
          <div className="order-1 lg:order-2 flex flex-col">
            {/* Solution Label */}
            <div className="flex justify-center mb-4">
              <span className="text-xs text-slate-500 uppercase tracking-widest">For HR</span>
            </div>

            {/* Mode Toggle */}
            <div className="flex justify-center mb-5">
              <div className="bg-slate-900/80 rounded-xl p-1 flex gap-1 border border-slate-800">
                <button
                  onClick={() => setMode("session")}
                  className={`px-5 py-2 text-sm font-medium rounded-lg transition-all ${
                    mode === "session"
                      ? "bg-slate-700/50 text-slate-200 shadow-sm border border-slate-600"
                      : "text-slate-500 hover:text-white"
                  }`}
                >
                  Take Assessment
                </button>
                <button
                  onClick={() => setMode("plan")}
                  className={`px-5 py-2 text-sm font-medium rounded-lg transition-all ${
                    mode === "plan"
                      ? "bg-slate-700/50 text-slate-200 shadow-sm border border-slate-600"
                      : "text-slate-500 hover:text-white"
                  }`}
                >
                  View Reports
                </button>
              </div>
            </div>

            {mode === "session" && (
              <div className="flex flex-col flex-1">
                <div className="text-center mb-5">
                  <h2 className="text-2xl sm:text-3xl font-bold text-white mb-2 tracking-tight">
                    Test candidate skills through conversation
                  </h2>
                  <p className="text-slate-500 max-w-md mx-auto text-sm leading-relaxed">
                    AI-powered assessments that identify gaps. Get competency reports — no multiple choice.
                  </p>
                </div>

                <div className="w-full max-w-lg mx-auto">
                  <ProblemInput initialTopic={selectedTopic} theme="slate" />
                </div>

                <div className="mt-6 flex-1 flex flex-col">
                  <p className="text-sm text-slate-500 mb-3 text-center">
                    Or try one of these evaluation scenarios:
                  </p>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 flex-1">
                    {EVAL_TOPICS.map(({ topic, category, emoji }) => (
                      <button
                        key={topic}
                        onClick={() => setSelectedTopic(topic)}
                        className="text-left p-3 rounded-xl border border-slate-800 bg-slate-900/50 hover:bg-slate-800/80 hover:border-slate-600 transition-all duration-200"
                      >
                        <p className="text-[13px] text-slate-300 hover:text-white leading-snug mb-1.5">
                          {topic}
                        </p>
                        <div className="flex items-center gap-1.5">
                          <span className="text-xs">{emoji}</span>
                          <span className="text-[11px] text-slate-600">{category}</span>
                        </div>
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            )}

            {mode === "plan" && (
              <div className="w-full flex-1 flex flex-col">
                <PlanModeSelect theme="slate" />
              </div>
            )}
          </div>
        </div>
      </div>

      <Footer />
    </main>
  );
}
