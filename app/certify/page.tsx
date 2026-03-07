"use client";

import { useState } from "react";
import { ProblemInput } from "@/components/ProblemInput";
import { PlanModeSelect } from "@/components/PlanModeSelect";
import { Footer } from "@/components/Footer";
import { Navbar } from "@/components/Navbar";

type Mode = "session" | "plan";

const CERTIFY_TOPICS = [
  { topic: "AWS Solutions Architect: design a multi-region architecture", category: "Cloud", emoji: "☁️" },
  { topic: "CompTIA A+: troubleshoot a network connectivity issue", category: "Hardware", emoji: "🔧" },
  { topic: "PMP: estimate project duration using PERT", category: "Management", emoji: "📋" },
  { topic: "Google Cloud: design a scalable data pipeline", category: "Cloud", emoji: "📊" },
];

export default function CertifyPage() {
  const [selectedTopic, setSelectedTopic] = useState("");
  const [mode, setMode] = useState<Mode>("session");

  return (
    <main className="min-h-screen flex flex-col bg-[#0a0a0a]">
      <Navbar />

      <div className="flex-1 flex">
        {/* Left Column - Scrollable with lighter background */}
        <div className="hidden lg:flex lg:w-1/2 bg-slate-900/40 border-r border-slate-800 overflow-y-auto">
          <div className="w-full max-w-xl ml-auto p-8 flex flex-col gap-8">
            {/* Mockup */}
            <div className="rounded-2xl border border-slate-700 bg-slate-800/30 overflow-hidden flex flex-col">
              <div className="bg-slate-700/50 px-5 py-2.5 border-b border-slate-700 flex items-center justify-between">
                <span className="text-sm font-medium text-slate-300">Certification Roadmap</span>
                <span className="text-xs text-slate-500">AWS Solutions Architect</span>
              </div>
              <div className="p-5 flex flex-col">
                <div className="flex items-center justify-between mb-4">
                  <div className="flex items-center gap-3">
                    <div className="w-14 h-14 rounded-full border-4 border-slate-500 flex items-center justify-center">
                      <span className="text-lg font-bold text-slate-300">45%</span>
                    </div>
                    <div>
                      <p className="text-base font-medium text-white">In Progress</p>
                      <p className="text-xs text-slate-500">Target: June 2026</p>
                    </div>
                  </div>
                  <div className="flex gap-2">
                    <button className="text-xs bg-slate-600/50 hover:bg-slate-600 text-slate-300 px-3 py-1.5 rounded-lg transition-colors">
                      Blueprint
                    </button>
                    <button className="text-xs bg-white/10 hover:bg-white/20 text-white px-3 py-1.5 rounded-lg transition-colors">
                      Schedule
                    </button>
                  </div>
                </div>
                
                <div className="relative my-4">
                  <div className="absolute top-4 left-0 right-0 h-0.5 bg-slate-700" />
                  <div className="absolute top-4 left-0 h-0.5 bg-slate-500" style={{ width: "45%" }} />
                  <div className="relative flex justify-between">
                    {[
                      { label: "Cloud Basics", status: "complete", icon: "✓" },
                      { label: "IAM & S3", status: "complete", icon: "✓" },
                      { label: "EC2", status: "current", icon: "●" },
                      { label: "Databases", status: "upcoming", icon: "○" },
                      { label: "Networking", status: "upcoming", icon: "○" },
                      { label: "Security", status: "upcoming", icon: "○" },
                    ].map(({ label, status, icon }) => (
                      <div key={label} className="flex flex-col items-center">
                        <div className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-medium mb-1.5 ${
                          status === "complete" ? "bg-slate-600 text-white" :
                          status === "current" ? "bg-slate-700 text-slate-300 border-2 border-slate-500" :
                          "bg-slate-800 text-slate-600 border border-slate-700"
                        }`}>
                          {icon}
                        </div>
                        <span className={`text-[9px] text-center ${
                          status === "complete" ? "text-slate-400" :
                          status === "current" ? "text-slate-300" :
                          "text-slate-600"
                        }`}>{label}</span>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="grid grid-cols-3 gap-3 mt-4 pt-4 border-t border-slate-700">
                  <div>
                    <p className="text-[10px] text-slate-500 uppercase mb-0.5">Practice Score</p>
                    <p className="text-lg font-bold text-white">72%</p>
                    <p className="text-[10px] text-emerald-400">↑ 8% this week</p>
                  </div>
                  <div>
                    <p className="text-[10px] text-slate-500 uppercase mb-0.5">Weak Areas</p>
                    <p className="text-lg font-bold text-white">3</p>
                    <p className="text-[10px] text-rose-400">Multi-AZ</p>
                  </div>
                  <div>
                    <p className="text-[10px] text-slate-500 uppercase mb-0.5">Streak</p>
                    <p className="text-lg font-bold text-white">12 days</p>
                    <p className="text-[10px] text-slate-500">Keep it up!</p>
                  </div>
                </div>
              </div>
            </div>

            {/* Value Proposition */}
            <div className="space-y-4">
              <h3 className="text-lg font-semibold text-white">Why openLesson for Certifications?</h3>
              <p className="text-sm text-slate-400 leading-relaxed">
                Most certification prep relies on memorizing dumps and practice tests — you pass the exam but forget everything a week later. 
                openLesson builds genuine understanding through Socratic dialogue. When you explain concepts back, our AI identifies exactly 
                where your reasoning breaks down. You'll walk into your exam confident because you actually understand the material, not 
                because you've seen similar questions before.
              </p>
              <div className="flex flex-wrap gap-2 pt-2">
                <span className="text-xs px-2.5 py-1 rounded-full bg-slate-700/50 text-slate-300">Deep understanding</span>
                <span className="text-xs px-2.5 py-1 rounded-full bg-slate-700/50 text-slate-300">Gap identification</span>
                <span className="text-xs px-2.5 py-1 rounded-full bg-slate-700/50 text-slate-300">Progress tracking</span>
              </div>
            </div>
          </div>
        </div>

        {/* Right Column - Fixed, no scroll */}
        <div className="w-full lg:w-1/2 flex items-center justify-center px-4 sm:px-6 py-6 lg:py-4 overflow-hidden">
          <div className="w-full max-w-xl flex flex-col">
            {/* Solution Label */}
            <div className="flex justify-center mb-4">
              <span className="text-xs text-slate-500 uppercase tracking-widest">For Careers</span>
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
                  Practice Now
                </button>
                <button
                  onClick={() => setMode("plan")}
                  className={`px-5 py-2 text-sm font-medium rounded-lg transition-all ${
                    mode === "plan"
                      ? "bg-slate-700/50 text-slate-200 shadow-sm border border-slate-600"
                      : "text-slate-500 hover:text-white"
                  }`}
                >
                  Build Roadmap
                </button>
              </div>
            </div>

            {mode === "session" && (
              <div className="flex flex-col flex-1">
                <div className="text-center mb-5">
                  <h2 className="text-2xl sm:text-3xl font-bold text-white mb-2 tracking-tight">
                    Prepare for certifications by truly understanding
                  </h2>
                  <p className="text-slate-500 max-w-md mx-auto text-sm leading-relaxed">
                    Don't memorize — reason through problems. Track progress with AI that identifies gaps.
                  </p>
                </div>

                <div className="w-full max-w-lg mx-auto">
                  <ProblemInput initialTopic={selectedTopic} theme="slate" />
                </div>

                <div className="mt-6 flex-1 flex flex-col">
                  <p className="text-sm text-slate-500 mb-3 text-center">
                    Popular certification topics:
                  </p>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 flex-1">
                    {CERTIFY_TOPICS.map(({ topic, category, emoji }) => (
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
