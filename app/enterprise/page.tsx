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

const ENTERPRISE_TOPICS = [
  { topic: "Product knowledge: explain our pricing model to a customer", category: "Sales", emoji: "💰" },
  { topic: "Sales objection: handle 'your solution is too expensive'", category: "Sales", emoji: "🤝" },
  { topic: "Compliance training: GDPR key requirements", category: "Compliance", emoji: "📋" },
  { topic: "Technical demo: explain our API to a developer", category: "Technical", emoji: "🔧" },
];

export default function EnterprisePage() {
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
              <RoadmapBadge label="Dashboard Preview" eta="Q2 2026" />
              <div className="bg-slate-700/50 px-5 py-2.5 border-b border-slate-700 flex items-center justify-between">
                <span className="text-sm font-medium text-slate-300">Team Training Dashboard</span>
                <span className="text-xs text-slate-500">Enterprise View</span>
              </div>
              <div className="p-5 flex flex-col">
                <div className="grid grid-cols-3 gap-3 mb-4">
                  <div className="bg-slate-700/50 rounded-xl p-3">
                    <p className="text-[10px] text-slate-400 mb-0.5">Active Users</p>
                    <p className="text-xl font-bold text-white">247</p>
                    <p className="text-[10px] text-emerald-400">+12 this week</p>
                  </div>
                  <div className="bg-slate-700/50 rounded-xl p-3">
                    <p className="text-[10px] text-slate-400 mb-0.5">Sessions</p>
                    <p className="text-xl font-bold text-white">1,842</p>
                    <p className="text-[10px] text-slate-500">Avg 7.4/user</p>
                  </div>
                  <div className="bg-slate-700/50 rounded-xl p-3">
                    <p className="text-[10px] text-slate-400 mb-0.5">Proficiency</p>
                    <p className="text-xl font-bold text-white">78%</p>
                    <p className="text-[10px] text-emerald-400">+5% vs last mo</p>
                  </div>
                </div>
                <div className="bg-slate-700/30 rounded-xl p-4">
                  <p className="text-xs text-slate-400 mb-3">Department Progress</p>
                  <div className="space-y-2.5">
                    {[
                      { dept: "Sales", progress: 85, color: "bg-emerald-500" },
                      { dept: "Engineering", progress: 91, color: "bg-blue-500" },
                      { dept: "Support", progress: 72, color: "bg-amber-500" },
                      { dept: "Marketing", progress: 68, color: "bg-rose-500" },
                    ].map(({ dept, progress, color }) => (
                      <div key={dept} className="flex items-center gap-3">
                        <span className="text-xs text-slate-400 w-20">{dept}</span>
                        <div className="flex-1 h-2 bg-slate-600 rounded-full overflow-hidden">
                          <div className={`h-full ${color} rounded-full`} style={{ width: `${progress}%` }} />
                        </div>
                        <span className="text-xs text-white w-8">{progress}%</span>
                      </div>
                    ))}
                  </div>
                </div>
                <div className="mt-4 pt-4 border-t border-slate-700 flex items-center justify-between">
                  <span className="text-xs text-slate-500">SSO: Active | API: Enabled</span>
                  <button className="text-xs bg-white/10 hover:bg-white/20 text-white px-3 py-1.5 rounded-lg transition-colors">
                    Export Report
                  </button>
                </div>
              </div>
            </div>

            {/* Value Proposition - Updated to bullet format */}
            <div className="space-y-4">
              <h3 className="text-lg font-semibold text-white">The Problem With Sales Training</h3>
              <ul className="space-y-2">
                <li className="flex items-start gap-2 text-sm text-slate-400">
                  <span className="text-red-400 mt-0.5">✗</span>
                  <span>Reps memorize scripts but freeze when prospects go off-script</span>
                </li>
                <li className="flex items-start gap-2 text-sm text-slate-400">
                  <span className="text-red-400 mt-0.5">✗</span>
                  <span>Knowledge tests show memorization, not understanding</span>
                </li>
                <li className="flex items-start gap-2 text-sm text-slate-400">
                  <span className="text-red-400 mt-0.5">✗</span>
                  <span>Managers can't scale 1-on-1 coaching to every rep</span>
                </li>
              </ul>
              
              <h3 className="text-lg font-semibold text-white pt-4">How openLesson Helps</h3>
              <ul className="space-y-2">
                <li className="flex items-start gap-2 text-sm text-slate-400">
                  <span className="text-emerald-400 mt-0.5">✓</span>
                  <span>Reps explain products verbally — AI detects knowledge gaps</span>
                </li>
                <li className="flex items-start gap-2 text-sm text-slate-400">
                  <span className="text-emerald-400 mt-0.5">✓</span>
                  <span>Socratic questions build genuine understanding, not recitation</span>
                </li>
                <li className="flex items-start gap-2 text-sm text-slate-400">
                  <span className="text-emerald-400 mt-0.5">✓</span>
                  <span>Managers see exactly where each rep needs coaching</span>
                </li>
              </ul>
            </div>

            {/* Lead Capture Form */}
            <LeadCapture 
              audience="enterprise"
              title="Get Early Access to Team Features"
              subtitle="Join the waitlist for team dashboards, SSO, and enterprise features."
            />
          </div>
        </div>

        {/* Right Column - Sticky at top (shows on top on mobile) */}
        <div className="order-1 lg:order-2 w-full lg:w-1/2 lg:sticky lg:top-[113px] lg:h-[calc(100vh-113px)] flex items-center justify-center px-4 sm:px-6 py-6 lg:py-4">
          <div className="w-full max-w-xl flex flex-col">
            {/* Label */}
            <div className="flex justify-center mb-3">
              <span className="text-xs font-medium text-slate-500 uppercase tracking-wider">For Sales</span>
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
                  Train Now
                </button>
                <button
                  onClick={() => setMode("plan")}
                  className={`px-5 py-2 text-sm font-medium rounded-lg transition-all ${
                    mode === "plan"
                      ? "bg-slate-700/50 text-slate-200 shadow-sm border border-slate-600"
                      : "text-slate-500 hover:text-white"
                  }`}
                >
                  Build Program
                </button>
              </div>
            </div>

            {mode === "session" && (
              <div className="flex flex-col flex-1">
                <div className="text-center mb-5">
                  <h2 className="text-2xl sm:text-3xl font-bold text-white mb-2 tracking-tight">
                    Turn Product Knowledge Into Sales Confidence
                  </h2>
                  <p className="text-slate-500 max-w-md mx-auto text-sm leading-relaxed">
                    Your reps explain concepts out loud. Our AI finds gaps in their understanding — before customers do.
                  </p>
                </div>

                <div className="w-full max-w-lg mx-auto">
                  <ProblemInput 
                    initialTopic={selectedTopic} 
                    theme="slate" 
                    placeholder="Enter a training topic (e.g., Product demo, Objection handling, Compliance)"
                  />
                </div>

                <div className="mt-6 flex-1 flex flex-col">
                  <p className="text-sm text-slate-500 mb-3 text-center">
                    Popular training modules:
                  </p>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 flex-1">
                    {ENTERPRISE_TOPICS.map(({ topic, category, emoji }) => (
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
                  title="Build Your Training Program"
                  subtitle="Design a multi-week training curriculum for your team."
                  placeholder="What should the training cover? (e.g., Product knowledge, Sales methodology)"
                  exampleTopics={["Product Knowledge", "Sales Objections", "GDPR Compliance", "Technical Demos", "Onboarding", "Leadership"]}
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
