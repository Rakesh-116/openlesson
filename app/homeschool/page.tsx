"use client";

import { useState } from "react";
import { ProblemInput } from "@/components/ProblemInput";
import { PlanModeSelect } from "@/components/PlanModeSelect";
import { Footer } from "@/components/Footer";
import { Navbar } from "@/components/Navbar";
import { RoadmapBadge } from "@/components/FeatureStatus";
import { DemoBanner } from "@/components/DemoBanner";

type Mode = "session" | "plan";

const HOMESCHOOL_TOPICS = [
  { topic: "Multiplication: why 7 × 8 = 56", category: "Math", emoji: "✖️" },
  { topic: "World War II: causes and key events", category: "History", emoji: "🌍" },
  { topic: "Photosynthesis: how plants make food", category: "Science", emoji: "🌱" },
  { topic: "Fractions: adding unlike denominators", category: "Math", emoji: "½" },
];

export default function HomeschoolPage() {
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
              <RoadmapBadge label="Family Dashboard Preview" eta="Q2 2026" />
              <div className="bg-slate-700/50 px-5 py-2.5 border-b border-slate-700 flex items-center justify-between">
                <span className="text-sm font-medium text-slate-300">Family Dashboard</span>
                <span className="text-xs text-slate-500">Parent View</span>
              </div>
              <div className="p-5 flex flex-col">
                <div className="grid grid-cols-2 gap-3 mb-4">
                  <div className="bg-slate-700/50 rounded-xl p-3 flex items-center gap-3">
                    <div className="w-10 h-10 rounded-full bg-slate-600 flex items-center justify-center text-lg">
                      👧
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-white">Emma</p>
                      <p className="text-[10px] text-slate-500">Grade 4</p>
                    </div>
                    <div className="text-right">
                      <p className="text-lg font-bold text-emerald-400">85%</p>
                      <p className="text-[10px] text-slate-500">Math</p>
                    </div>
                  </div>
                  <div className="bg-slate-700/50 rounded-xl p-3 flex items-center gap-3">
                    <div className="w-10 h-10 rounded-full bg-slate-600 flex items-center justify-center text-lg">
                      👦
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-white">Lucas</p>
                      <p className="text-[10px] text-slate-500">Grade 7</p>
                    </div>
                    <div className="text-right">
                      <p className="text-lg font-bold text-amber-400">72%</p>
                      <p className="text-[10px] text-slate-500">Science</p>
                    </div>
                  </div>
                </div>
                <div className="bg-slate-700/30 rounded-xl p-4">
                  <p className="text-xs text-slate-400 mb-2">Recent Sessions</p>
                  <div className="space-y-2">
                    {[
                      { child: "Emma", topic: "Photosynthesis", result: "Strong", time: "2h ago" },
                      { child: "Lucas", topic: "World War II", result: "Gaps", time: "Yesterday" },
                      { child: "Emma", topic: "Multiplication", result: "Review", time: "2 days ago" },
                    ].map(({ child, topic, result, time }) => (
                      <div key={`${child}-${topic}`} className="flex items-center justify-between py-1.5 border-b border-slate-700 last:border-0">
                        <div className="flex items-center gap-2">
                          <span className="text-xs text-white">{child}</span>
                          <span className="text-xs text-slate-600">•</span>
                          <span className="text-xs text-slate-400">{topic}</span>
                        </div>
                        <div className="flex items-center gap-2">
                          <span className={`text-[10px] px-2 py-0.5 rounded ${
                            result === "Strong" ? "bg-emerald-500/20 text-emerald-400" :
                            result === "Gaps" ? "bg-amber-500/20 text-amber-400" :
                            "bg-rose-500/20 text-rose-400"
                          }`}>{result}</span>
                          <span className="text-[10px] text-slate-600">{time}</span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
                <div className="mt-4 pt-4 border-t border-slate-700 flex items-center justify-between">
                  <span className="text-xs text-slate-500">Curriculum: State Standards ✓</span>
                  <button className="text-xs bg-slate-600/50 hover:bg-slate-600 text-slate-300 px-3 py-1.5 rounded-lg transition-colors">
                    Add Child
                  </button>
                </div>
              </div>
            </div>

            {/* Value Proposition - Updated to bullet format */}
            <div className="space-y-4">
              <h3 className="text-lg font-semibold text-white">The Homeschool Challenge</h3>
              <ul className="space-y-2">
                <li className="flex items-start gap-2 text-sm text-slate-400">
                  <span className="text-red-400 mt-0.5">✗</span>
                  <span>You can't be an expert in every subject</span>
                </li>
                <li className="flex items-start gap-2 text-sm text-slate-400">
                  <span className="text-red-400 mt-0.5">✗</span>
                  <span>Hard to know if they truly understand or just memorized</span>
                </li>
                <li className="flex items-start gap-2 text-sm text-slate-400">
                  <span className="text-red-400 mt-0.5">✗</span>
                  <span>One-on-one tutoring is expensive</span>
                </li>
              </ul>
              
              <h3 className="text-lg font-semibold text-white pt-4">How openLesson Helps</h3>
              <ul className="space-y-2">
                <li className="flex items-start gap-2 text-sm text-slate-400">
                  <span className="text-emerald-400 mt-0.5">✓</span>
                  <span>Patient AI tutor available anytime, any subject</span>
                </li>
                <li className="flex items-start gap-2 text-sm text-slate-400">
                  <span className="text-emerald-400 mt-0.5">✓</span>
                  <span>Your child explains concepts back — gaps become visible</span>
                </li>
                <li className="flex items-start gap-2 text-sm text-slate-400">
                  <span className="text-emerald-400 mt-0.5">✓</span>
                  <span>You see reports showing what they actually understand</span>
                </li>
              </ul>
            </div>

            {/* Affordability Message */}
            <div className="rounded-xl border border-emerald-500/20 bg-emerald-500/5 p-4">
              <p className="text-sm text-emerald-400 font-medium mb-1">
                Unlimited learning for less than a single tutoring session
              </p>
              <p className="text-xs text-slate-400">
                Pro plan: $14.99/month vs. $50-100/hour for human tutors
              </p>
            </div>
          </div>
        </div>

        {/* Right Column - Sticky at top (shows on top on mobile) */}
        <div className="order-1 lg:order-2 w-full lg:w-1/2 lg:sticky lg:top-[113px] lg:h-[calc(100vh-113px)] flex items-center justify-center px-4 sm:px-6 py-6 lg:py-4">
          <div className="w-full max-w-xl flex flex-col">
            {/* Solution Label */}
            <div className="flex justify-center mb-4">
              <span className="text-xs text-slate-500 uppercase tracking-widest">For Families</span>
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
                  Start Lesson
                </button>
                <button
                  onClick={() => setMode("plan")}
                  className={`px-5 py-2 text-sm font-medium rounded-lg transition-all ${
                    mode === "plan"
                      ? "bg-slate-700/50 text-slate-200 shadow-sm border border-slate-600"
                      : "text-slate-500 hover:text-white"
                  }`}
                >
                  Build Curriculum
                </button>
              </div>
            </div>

            {mode === "session" && (
              <div className="flex flex-col flex-1">
                <div className="text-center mb-5">
                  <h2 className="text-2xl sm:text-3xl font-bold text-white mb-2 tracking-tight">
                    Be Your Child's Learning Partner, Not Their Expert
                  </h2>
                  <p className="text-slate-500 max-w-md mx-auto text-sm leading-relaxed">
                    When they get stuck on topics you don't know, openLesson steps in with patient, Socratic tutoring.
                  </p>
                </div>

                <div className="w-full max-w-lg mx-auto">
                  <ProblemInput 
                    initialTopic={selectedTopic} 
                    theme="slate" 
                    placeholder="What should your child learn today? (e.g., Fractions, Photosynthesis, WWII)"
                  />
                </div>

                <div className="mt-6 flex-1 flex flex-col">
                  <p className="text-sm text-slate-500 mb-3 text-center">
                    Popular topics for homeschool:
                  </p>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 flex-1">
                    {HOMESCHOOL_TOPICS.map(({ topic, category, emoji }) => (
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
                  title="Build Your Curriculum"
                  subtitle="Create a structured learning plan aligned with your child's grade level."
                  placeholder="What subject or unit should we plan? (e.g., 4th Grade Math, US History, Biology)"
                  exampleTopics={["4th Grade Math", "US History", "Life Science", "Grammar & Writing", "World Geography", "Chemistry"]}
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
