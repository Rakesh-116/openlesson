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

const SCHOOLS_TOPICS = [
  { topic: "Algebra 1: solving linear equations", category: "Math", emoji: "📐" },
  { topic: "Essay structure: outline a 5-paragraph essay", category: "English", emoji: "📝" },
  { topic: "Biology: cell division (mitosis vs meiosis)", category: "Science", emoji: "🧬" },
  { topic: "Physics: Newton's laws in everyday life", category: "Science", emoji: "⚡" },
];

export default function SchoolsPage() {
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
              <RoadmapBadge label="Classroom Preview" eta="Q2 2026" />
              <div className="bg-slate-700/50 px-5 py-2.5 border-b border-slate-700 flex items-center justify-between">
                <span className="text-sm font-medium text-slate-300">Classroom — Period 3 Algebra</span>
                <div className="flex items-center gap-1.5">
                  <span className="text-[10px] bg-emerald-500/20 text-emerald-400 px-1.5 py-0.5 rounded">12 Active</span>
                  <span className="text-[10px] bg-amber-500/20 text-amber-400 px-1.5 py-0.5 rounded">5 In Progress</span>
                </div>
              </div>
              <div className="p-4 flex flex-col">
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead>
                      <tr className="border-b border-slate-700">
                        <th className="text-left text-[10px] text-slate-400 font-medium pb-2 pr-2">Student</th>
                        <th className="text-left text-[10px] text-slate-400 font-medium pb-2 px-2">Status</th>
                        <th className="text-left text-[10px] text-slate-400 font-medium pb-2 px-2">Last</th>
                        <th className="text-left text-[10px] text-slate-400 font-medium pb-2 pl-2">Gaps</th>
                      </tr>
                    </thead>
                    <tbody>
                      {[
                        { name: "Jordan Smith", status: "Completed", last: "2h ago", gaps: 1 },
                        { name: "Taylor Brown", status: "Completed", last: "3h ago", gaps: 0 },
                        { name: "Casey Davis", status: "In Progress", last: "Now", gaps: 2 },
                        { name: "Morgan Wilson", status: "Not Started", last: "—", gaps: 0 },
                        { name: "Riley Johnson", status: "Completed", last: "1h ago", gaps: 3 },
                      ].map(({ name, status, last, gaps }) => (
                        <tr key={name} className="border-b border-slate-700/50 last:border-0">
                          <td className="py-2 pr-2">
                            <p className="text-sm text-white">{name}</p>
                          </td>
                          <td className="px-2 py-2">
                            <span className={`text-[10px] px-1.5 py-0.5 rounded ${
                              status === "Completed" ? "bg-emerald-500/20 text-emerald-400" :
                              status === "In Progress" ? "bg-amber-500/20 text-amber-400" :
                              "bg-slate-600/30 text-slate-400"
                            }`}>{status}</span>
                          </td>
                          <td className="px-2 py-2">
                            <span className="text-xs text-slate-500">{last}</span>
                          </td>
                          <td className="pl-2 py-2">
                            {gaps > 0 ? (
                              <span className="text-xs bg-rose-500/20 text-rose-400 px-1.5 py-0.5 rounded">{gaps}</span>
                            ) : (
                              <span className="text-xs text-emerald-400">✓</span>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                <div className="mt-4 pt-4 border-t border-slate-700 flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="text-[10px] bg-emerald-500/20 text-emerald-400 px-2 py-0.5 rounded">Google Classroom</span>
                    <span className="text-[10px] bg-emerald-500/20 text-emerald-400 px-2 py-0.5 rounded">Canvas</span>
                  </div>
                  <button className="text-xs bg-slate-600/50 hover:bg-slate-600 text-slate-300 px-3 py-1.5 rounded-lg transition-colors">
                    Create Assignment
                  </button>
                </div>
              </div>
            </div>

            {/* Value Proposition - Updated to bullet format */}
            <div className="space-y-4">
              <h3 className="text-lg font-semibold text-white">The Classroom Challenge</h3>
              <ul className="space-y-2">
                <li className="flex items-start gap-2 text-sm text-slate-400">
                  <span className="text-red-400 mt-0.5">✗</span>
                  <span>Can't give 30 students individual attention</span>
                </li>
                <li className="flex items-start gap-2 text-sm text-slate-400">
                  <span className="text-red-400 mt-0.5">✗</span>
                  <span>Homework shows if they got it right, not if they understand</span>
                </li>
                <li className="flex items-start gap-2 text-sm text-slate-400">
                  <span className="text-red-400 mt-0.5">✗</span>
                  <span>Struggling students don't always ask for help</span>
                </li>
              </ul>
              
              <h3 className="text-lg font-semibold text-white pt-4">How openLesson Helps</h3>
              <ul className="space-y-2">
                <li className="flex items-start gap-2 text-sm text-slate-400">
                  <span className="text-emerald-400 mt-0.5">✓</span>
                  <span>Every student gets patient, 1-on-1 guided tutoring</span>
                </li>
                <li className="flex items-start gap-2 text-sm text-slate-400">
                  <span className="text-emerald-400 mt-0.5">✓</span>
                  <span>AI identifies conceptual gaps, not just wrong answers</span>
                </li>
                <li className="flex items-start gap-2 text-sm text-slate-400">
                  <span className="text-emerald-400 mt-0.5">✓</span>
                  <span>You see class-wide patterns to adjust instruction</span>
                </li>
              </ul>
            </div>

            {/* Lead Capture Form */}
            <LeadCapture 
              audience="schools"
              title="Request a School Pilot"
              subtitle="We're partnering with early-adopter educators to build classroom tools."
            />
          </div>
        </div>

        {/* Right Column - Sticky at top (shows on top on mobile) */}
        <div className="order-1 lg:order-2 w-full lg:w-1/2 lg:sticky lg:top-[113px] lg:h-[calc(100vh-113px)] flex items-center justify-center px-4 sm:px-6 py-6 lg:py-4">
          <div className="w-full max-w-xl flex flex-col">
            {/* Label */}
            <div className="flex justify-center mb-3">
              <span className="text-xs font-medium text-slate-500 uppercase tracking-wider">For Schools</span>
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
                  Assign Topic
                </button>
                <button
                  onClick={() => setMode("plan")}
                  className={`px-5 py-2 text-sm font-medium rounded-lg transition-all ${
                    mode === "plan"
                      ? "bg-slate-700/50 text-slate-200 shadow-sm border border-slate-600"
                      : "text-slate-500 hover:text-white"
                  }`}
                >
                  Build Syllabus
                </button>
              </div>
            </div>

            {mode === "session" && (
              <div className="flex flex-col flex-1">
                <div className="text-center mb-5">
                  <h2 className="text-2xl sm:text-3xl font-bold text-white mb-2 tracking-tight">
                    See What Every Student Misunderstands — Before the Test
                  </h2>
                  <p className="text-slate-500 max-w-md mx-auto text-sm leading-relaxed">
                    Assign topics as homework. AI tutors each student 1-on-1. You get reports showing exactly who needs help with what.
                  </p>
                </div>

                <div className="w-full max-w-lg mx-auto">
                  <ProblemInput 
                    initialTopic={selectedTopic} 
                    theme="slate" 
                    placeholder="Enter a topic to assign (e.g., Quadratic equations, Essay thesis, Cell biology)"
                  />
                </div>

                <div className="mt-6 flex-1 flex flex-col">
                  <p className="text-sm text-slate-500 mb-3 text-center">
                    Common classroom topics:
                  </p>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 flex-1">
                    {SCHOOLS_TOPICS.map(({ topic, category, emoji }) => (
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
                  title="Build Your Syllabus"
                  subtitle="Design a multi-week unit plan for your classroom."
                  placeholder="What unit are you planning? (e.g., Algebra 1 Unit 3, AP Biology Genetics, Essay Writing)"
                  exampleTopics={["Algebra 1", "AP Biology", "US History", "Essay Writing", "Chemistry", "Physics"]}
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
