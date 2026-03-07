"use client";

import { useState } from "react";
import { ProblemInput } from "@/components/ProblemInput";
import { PlanModeSelect } from "@/components/PlanModeSelect";
import { Footer } from "@/components/Footer";
import { Navbar } from "@/components/Navbar";
import { RoadmapBadge } from "@/components/FeatureStatus";
import { LeadCapture } from "@/components/LeadCapture";
import { DemoBanner } from "@/components/DemoBanner";

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
      <DemoBanner />
      <Navbar />

      <div className="flex-1 flex flex-col lg:flex-row">
        {/* Left Column - Scrollable with lighter background (shows below on mobile) */}
        <div className="order-2 lg:order-1 lg:w-1/2 bg-slate-900/40 lg:border-r border-t lg:border-t-0 border-slate-800 lg:h-[calc(100vh-113px)] lg:overflow-y-auto px-4 sm:px-6 py-6 lg:py-8">
          <div className="w-full max-w-xl mx-auto flex flex-col gap-8">
            {/* Mockup */}
            <div className="rounded-2xl border border-slate-700 bg-slate-800/30 overflow-hidden flex flex-col relative">
              <RoadmapBadge label="Report Preview" eta="Q2 2026" />
              <div className="bg-slate-700/50 px-5 py-2.5 border-b border-slate-700 flex items-center justify-between">
                <span className="text-sm font-medium text-slate-300">Assessment Results</span>
                <span className="text-xs text-slate-500">Sample Report</span>
              </div>
              <div className="p-5 flex flex-col">
                <div className="flex items-center gap-6 mb-4">
                  <div className="w-20 h-20 rounded-full border-4 border-emerald-500 flex items-center justify-center">
                    <span className="text-xl font-bold text-emerald-400">78%</span>
                  </div>
                  <div>
                    <h3 className="text-lg font-semibold text-white mb-1">Overall: Proficient</h3>
                    <p className="text-sm text-slate-400">Python, SQL, System Design</p>
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  {[
                    { skill: "Algorithms", score: 85, status: "Advanced" },
                    { skill: "System Design", score: 72, status: "Proficient" },
                    { skill: "SQL", score: 91, status: "Advanced" },
                    { skill: "Debugging", score: 64, status: "Needs Work" },
                  ].map(({ skill, score, status }) => (
                    <div key={skill} className="bg-slate-700/50 rounded-xl p-3 flex flex-col justify-center">
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
                <div className="mt-4 pt-4 border-t border-slate-700">
                  <p className="text-xs text-slate-500">
                    "Strong fundamentals in algorithms and SQL. Debugging async patterns needs improvement."
                  </p>
                </div>
              </div>
            </div>

            {/* Value Proposition - Updated to bullet format */}
            <div className="space-y-4">
              <h3 className="text-lg font-semibold text-white">The Problem With Technical Interviews</h3>
              <ul className="space-y-2">
                <li className="flex items-start gap-2 text-sm text-slate-400">
                  <span className="text-red-400 mt-0.5">✗</span>
                  <span>Candidates memorize LeetCode solutions without understanding</span>
                </li>
                <li className="flex items-start gap-2 text-sm text-slate-400">
                  <span className="text-red-400 mt-0.5">✗</span>
                  <span>Take-home tests get outsourced or AI-assisted</span>
                </li>
                <li className="flex items-start gap-2 text-sm text-slate-400">
                  <span className="text-red-400 mt-0.5">✗</span>
                  <span>Live coding creates anxiety that masks true ability</span>
                </li>
              </ul>
              
              <h3 className="text-lg font-semibold text-white pt-4">How openLesson Helps</h3>
              <ul className="space-y-2">
                <li className="flex items-start gap-2 text-sm text-slate-400">
                  <span className="text-emerald-400 mt-0.5">✓</span>
                  <span>Candidates explain their reasoning verbally</span>
                </li>
                <li className="flex items-start gap-2 text-sm text-slate-400">
                  <span className="text-emerald-400 mt-0.5">✓</span>
                  <span>AI probes with follow-up questions, like a patient interviewer</span>
                </li>
                <li className="flex items-start gap-2 text-sm text-slate-400">
                  <span className="text-emerald-400 mt-0.5">✓</span>
                  <span>Reports show exactly where understanding breaks down</span>
                </li>
              </ul>
            </div>

            {/* Trust Elements */}
            <div className="grid grid-cols-3 gap-3">
              <div className="rounded-xl border border-slate-800 bg-slate-900/50 p-4 text-center">
                <span className="text-2xl mb-2 block">⚖️</span>
                <p className="text-xs text-slate-400">Fair & Consistent</p>
              </div>
              <div className="rounded-xl border border-slate-800 bg-slate-900/50 p-4 text-center">
                <span className="text-2xl mb-2 block">📊</span>
                <p className="text-xs text-slate-400">Detailed Reports</p>
              </div>
              <div className="rounded-xl border border-slate-800 bg-slate-900/50 p-4 text-center">
                <span className="text-2xl mb-2 block">📈</span>
                <p className="text-xs text-slate-400">Scalable Screening</p>
              </div>
            </div>

            {/* Disclaimer */}
            <div className="rounded-xl border border-amber-500/20 bg-amber-500/5 p-4">
              <p className="text-xs text-amber-400/80">
                <strong>Note:</strong> openLesson is a supplementary assessment tool, not a replacement for human judgment in hiring decisions.
              </p>
            </div>

            {/* Lead Capture Form */}
            <LeadCapture 
              audience="hr"
              title="Request a Demo for Your Team"
              subtitle="See how conversational assessments can improve your hiring process."
            />
          </div>
        </div>

        {/* Right Column - Sticky at top (shows on top on mobile) */}
        <div className="order-1 lg:order-2 w-full lg:w-1/2 lg:sticky lg:top-[113px] lg:h-[calc(100vh-113px)] flex items-center justify-center px-4 sm:px-6 py-6 lg:py-4">
          <div className="w-full max-w-xl flex flex-col">
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
                  Assess Now
                </button>
                <button
                  onClick={() => setMode("plan")}
                  className={`px-5 py-2 text-sm font-medium rounded-lg transition-all ${
                    mode === "plan"
                      ? "bg-slate-700/50 text-slate-200 shadow-sm border border-slate-600"
                      : "text-slate-500 hover:text-white"
                  }`}
                >
                  Build Assessment
                </button>
              </div>
            </div>

            {mode === "session" && (
              <div className="flex flex-col flex-1">
                <div className="text-center mb-5">
                  <h2 className="text-2xl sm:text-3xl font-bold text-white mb-2 tracking-tight">
                    Assess What Candidates Actually Understand
                  </h2>
                  <p className="text-slate-500 max-w-md mx-auto text-sm leading-relaxed">
                    Conversational assessments that probe reasoning — not memorized answers. Get competency reports, not pass/fail scores.
                  </p>
                </div>

                <div className="w-full max-w-lg mx-auto">
                  <ProblemInput 
                    initialTopic={selectedTopic} 
                    theme="slate" 
                    placeholder="Define an assessment topic (e.g., Python OOP, System Design, SQL joins)"
                  />
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
                <PlanModeSelect 
                  theme="slate"
                  title="Build Your Assessment"
                  subtitle="Create a structured assessment covering multiple competency areas."
                  placeholder="What skills should this assessment evaluate? (e.g., Backend Engineering, Data Analysis)"
                  exampleTopics={["Backend Engineering", "Data Analysis", "System Design", "Product Management", "DevOps", "Frontend"]}
                />
              </div>
            )}
          </div>
        </div>
      </div>

      <Footer />
    </main>
  );
}
