"use client";

import { useState, useEffect } from "react";
import { createBrowserClient } from "@supabase/ssr";
import { useRouter } from "next/navigation";
import Link from "next/link";

const WEEKS_OPTIONS = [
  { value: 1, label: "1 week" },
  { value: 2, label: "2 weeks" },
  { value: 4, label: "1 month" },
  { value: 8, label: "2 months" },
  { value: 12, label: "3 months" },
  { value: 26, label: "6 months" },
];

const EXAMPLE_TOPICS = [
  "Machine Learning",
  "Philosophy",
  "Quantum Physics",
  "World History",
  "Creative Writing",
  "Personal Finance",
];

export function PlanModeSelect() {
  const [topic, setTopic] = useState("");
  const [weeks, setWeeks] = useState(4);
  const [isGenerating, setIsGenerating] = useState(false);
  const [error, setError] = useState("");
  const [user, setUser] = useState<{ id: string } | null>(null);
  const router = useRouter();
  const supabase = createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => {
      setUser(data.user);
    });
  }, []);

  const handleGeneratePlan = async () => {
    if (!topic.trim()) {
      setError("Please enter a topic");
      return;
    }

    setIsGenerating(true);
    setError("");

    try {
      const { data: { user } } = await supabase.auth.getUser();
      
      if (!user) {
        router.push("/login?redirect=plan");
        return;
      }

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
      router.push(`/plan/${data.planId}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setIsGenerating(false);
    }
  };

  return (
    <div className="w-full max-w-2xl p-6">
      <div className="text-center mb-10">
        <h2 className="text-3xl sm:text-4xl font-bold text-white mb-4 tracking-tight">
          Build Your Learning Path
        </h2>
        <p className="text-neutral-500 max-w-lg mx-auto text-sm leading-relaxed">
          Enter a topic and we'll create a structured learning plan. 
          Explore concepts in a structured way, one session at a time.
        </p>
      </div>

      {/* Topic Input with Button */}
      <div className="mb-8">
        <div className="relative">
          <textarea
            value={topic}
            onChange={(e) => setTopic(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && !e.shiftKey && handleGeneratePlan()}
            placeholder="What do you want to learn? (e.g., Machine Learning, Philosophy)"
            rows={3}
            className="w-full h-28 px-4 pt-3.5 pb-14 pr-32 bg-neutral-900/80 border border-neutral-800 rounded-2xl text-white text-[15px] placeholder-neutral-600 focus:outline-none focus:border-neutral-600 resize-none transition-colors"
            disabled={isGenerating}
          />
          <button
            onClick={handleGeneratePlan}
            disabled={!topic.trim() || isGenerating}
            className="absolute right-4 bottom-4 px-4 py-2 bg-white hover:bg-neutral-200 disabled:bg-neutral-800 disabled:text-neutral-600 text-black text-sm font-medium rounded-xl transition-colors flex items-center gap-2"
          >
            {isGenerating ? (
              <svg className="w-5 h-5 animate-spin" viewBox="0 0 24 24" fill="none">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
              </svg>
            ) : (
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
              </svg>
            )}
            {isGenerating ? "Generating..." : "Generate"}
          </button>
        </div>
        {error && (
          <p className="mt-3 text-sm text-red-400">{error}</p>
        )}
      </div>

      {/* Weeks Selector */}
      <div className="mb-6">
        <label className="block text-sm text-neutral-400 mb-3">
          How long should the learning plan be?
        </label>
        <div className="flex flex-wrap gap-2">
          {WEEKS_OPTIONS.map((option) => (
            <button
              key={option.value}
              onClick={() => setWeeks(option.value)}
              className={`px-3 py-1.5 text-xs rounded-md border transition-colors ${
                weeks === option.value
                  ? "bg-white/15 text-white border-neutral-600"
                  : "bg-neutral-900/30 border-neutral-800 text-neutral-400 hover:border-neutral-700 hover:text-neutral-300"
              }`}
            >
              {option.label}
            </button>
          ))}
        </div>
      </div>

      <div className="flex flex-wrap gap-2">
        {EXAMPLE_TOPICS.map((topic) => (
          <button
            key={topic}
            onClick={() => setTopic(topic)}
            disabled={isGenerating}
            className="px-3 py-1.5 text-xs text-neutral-500 hover:text-white bg-neutral-900/50 hover:bg-neutral-800 border border-neutral-800 hover:border-neutral-700 rounded-full transition-colors"
          >
            {topic}
          </button>
        ))}
      </div>

      <div className="text-center mt-8 pt-6 border-t border-neutral-800">
        <Link href="/community" className="text-sm text-neutral-500 hover:text-white transition-colors">
          Explore community plans →
        </Link>
      </div>

    </div>
  );
}
