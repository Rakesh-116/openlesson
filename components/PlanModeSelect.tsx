"use client";

import { useState } from "react";
import { createBrowserClient } from "@supabase/ssr";
import { useRouter } from "next/navigation";

const PRESET_TOPICS = [
  "Machine Learning Fundamentals",
  "Philosophy: Ancient Greek",
  "Linear Algebra",
  "Cognitive Science",
  "Physics: Quantum Mechanics",
  "Economics: Microeconomics",
  "Computer Science: Algorithms",
  "Psychology: Behavioral",
];

const WEEKS_OPTIONS = [
  { value: 1, label: "1 week" },
  { value: 2, label: "2 weeks" },
  { value: 4, label: "1 month" },
  { value: 8, label: "2 months" },
  { value: 12, label: "3 months" },
  { value: 26, label: "6 months" },
];

export function PlanModeSelect() {
  const [topic, setTopic] = useState("");
  const [weeks, setWeeks] = useState(4);
  const [isGenerating, setIsGenerating] = useState(false);
  const [error, setError] = useState("");
  const router = useRouter();
  const supabase = createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );

  const handleGeneratePlan = async () => {
    if (!topic.trim()) {
      setError("Please enter a topic");
      return;
    }

    setIsGenerating(true);
    setError("");

    try {
      // Check if user is logged in
      const { data: { user } } = await supabase.auth.getUser();
      
      if (!user) {
        router.push("/login?redirect=plan");
        return;
      }

      // Call the API to generate a learning plan
      const response = await fetch("/api/learning-plan/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ topic: topic.trim(), days: weeks * 7 }),
      });

      if (!response.ok) {
        const err = await response.json();
        throw new Error(err.error || "Failed to generate plan");
      }

      const data = await response.json();
      
      // Navigate to the plan view
      router.push(`/plan/${data.planId}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setIsGenerating(false);
    }
  };

  return (
    <div className="w-full max-w-2xl">
      <div className="text-center mb-8">
        <h2 className="text-3xl sm:text-4xl font-bold text-white mb-4 tracking-tight">
          Build Your Learning Path
        </h2>
        <p className="text-neutral-500 max-w-lg mx-auto text-sm leading-relaxed">
          Enter a topic and we'll create a structured learning plan. 
          Explore concepts in a structured way, one session at a time.
        </p>
      </div>

      {/* Topic Input */}
      <div className="mb-6">
        <label className="block text-sm text-neutral-400 mb-2">
          What do you want to learn?
        </label>
        <input
          type="text"
          value={topic}
          onChange={(e) => setTopic(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && handleGeneratePlan()}
          placeholder="e.g., Machine Learning, Philosophy, Quantum Physics..."
          className="w-full px-4 py-3 bg-neutral-900/50 border border-neutral-800 rounded-xl text-white placeholder-neutral-600 focus:outline-none focus:ring-2 focus:ring-blue-500/50 focus:border-blue-500/50 transition-colors"
        />
        {error && (
          <p className="mt-2 text-sm text-red-400">{error}</p>
        )}
      </div>

      {/* Weeks Selector */}
      <div className="mb-8">
        <label className="block text-sm text-neutral-400 mb-2">
          How long should the learning plan be?
        </label>
        <div className="flex flex-wrap gap-2">
          {WEEKS_OPTIONS.map((option) => (
            <button
              key={option.value}
              onClick={() => setWeeks(option.value)}
              className={`px-4 py-2 text-sm rounded-lg border transition-colors ${
                weeks === option.value
                  ? "bg-blue-500/20 border-blue-500/40 text-blue-400"
                  : "bg-neutral-900/30 border-neutral-800 text-neutral-400 hover:border-neutral-700 hover:text-neutral-300"
              }`}
            >
              {option.label}
            </button>
          ))}
        </div>
      </div>

      {/* Preset Topics */}
      <div className="mb-8">
        <p className="text-sm text-neutral-500 mb-3">Or choose from presets:</p>
        <div className="flex flex-wrap gap-2">
          {PRESET_TOPICS.map((preset) => (
            <button
              key={preset}
              onClick={() => setTopic(preset)}
              className={`px-3 py-1.5 text-xs rounded-lg border transition-colors ${
                topic === preset
                  ? "bg-blue-500/20 border-blue-500/40 text-blue-400"
                  : "bg-neutral-900/30 border-neutral-800 text-neutral-400 hover:border-neutral-700 hover:text-neutral-300"
              }`}
            >
              {preset}
            </button>
          ))}
        </div>
      </div>

      {/* Generate Button */}
      <div className="flex justify-center">
        <button
          onClick={handleGeneratePlan}
          disabled={isGenerating || !topic.trim()}
          className="px-8 py-3 bg-blue-600 hover:bg-blue-500 disabled:opacity-50 disabled:cursor-not-allowed text-white font-medium rounded-xl transition-colors flex items-center gap-2"
        >
          {isGenerating ? (
            <>
              <svg className="w-4 h-4 animate-spin" viewBox="0 0 24 24" fill="none">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
              </svg>
              Generating your learning plan...
            </>
          ) : (
            <>
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M13 10V3L4 14h7v7l9-11h-7z" />
              </svg>
              Generate Learning Plan
            </>
          )}
        </button>
      </div>
    </div>
  );
}
