"use client";

import { useState, useEffect } from "react";
import { createBrowserClient } from "@supabase/ssr";
import { useRouter } from "next/navigation";

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

type ThemeColor = "neutral" | "teal" | "slate" | "blue" | "amber" | "violet";

const themeStyles: Record<ThemeColor, {
  textarea: string;
  button: string;
  buttonDisabled: string;
  weekActive: string;
  weekInactive: string;
  topicPill: string;
  label: string;
  description: string;
}> = {
  neutral: {
    textarea: "bg-neutral-900/80 border-neutral-800 focus:border-neutral-600 placeholder-neutral-600",
    button: "bg-white hover:bg-neutral-200 text-black",
    buttonDisabled: "disabled:bg-neutral-800 disabled:text-neutral-600",
    weekActive: "bg-white/15 text-white border-neutral-600",
    weekInactive: "bg-neutral-900/30 border-neutral-800 text-neutral-400 hover:border-neutral-700 hover:text-neutral-300",
    topicPill: "text-neutral-500 hover:text-white bg-neutral-900/50 hover:bg-neutral-800 border-neutral-800 hover:border-neutral-700",
    label: "text-neutral-400",
    description: "text-neutral-500",
  },
  teal: {
    textarea: "bg-teal-950/50 border-teal-900/50 focus:border-teal-700 placeholder-teal-600/50",
    button: "bg-teal-500 hover:bg-teal-400 text-white",
    buttonDisabled: "disabled:bg-teal-900/50 disabled:text-teal-700",
    weekActive: "bg-teal-500/20 text-teal-400 border-teal-500/50",
    weekInactive: "bg-teal-950/30 border-teal-900/50 text-teal-400/60 hover:border-teal-700 hover:text-teal-300",
    topicPill: "text-teal-400/60 hover:text-teal-300 bg-teal-950/30 hover:bg-teal-900/40 border-teal-900/50 hover:border-teal-700",
    label: "text-teal-400/70",
    description: "text-teal-400/60",
  },
  slate: {
    textarea: "bg-slate-900/50 border-slate-800 focus:border-slate-600 placeholder-slate-600",
    button: "bg-slate-200 hover:bg-white text-slate-900",
    buttonDisabled: "disabled:bg-slate-800 disabled:text-slate-600",
    weekActive: "bg-slate-700/50 text-slate-200 border-slate-600",
    weekInactive: "bg-slate-900/30 border-slate-800 text-slate-400 hover:border-slate-700 hover:text-slate-300",
    topicPill: "text-slate-400 hover:text-white bg-slate-900/50 hover:bg-slate-800 border-slate-800 hover:border-slate-700",
    label: "text-slate-400",
    description: "text-slate-500",
  },
  blue: {
    textarea: "bg-blue-950/50 border-blue-900/50 focus:border-blue-700 placeholder-blue-600/50",
    button: "bg-blue-500 hover:bg-blue-400 text-white",
    buttonDisabled: "disabled:bg-blue-900/50 disabled:text-blue-700",
    weekActive: "bg-blue-500/20 text-blue-400 border-blue-500/50",
    weekInactive: "bg-blue-950/30 border-blue-900/50 text-blue-400/60 hover:border-blue-700 hover:text-blue-300",
    topicPill: "text-blue-400/60 hover:text-blue-300 bg-blue-950/30 hover:bg-blue-900/40 border-blue-900/50 hover:border-blue-700",
    label: "text-blue-400/70",
    description: "text-blue-300/60",
  },
  amber: {
    textarea: "bg-amber-950/50 border-amber-900/50 focus:border-amber-700 placeholder-amber-600/50",
    button: "bg-amber-500 hover:bg-amber-400 text-black",
    buttonDisabled: "disabled:bg-amber-900/50 disabled:text-amber-700",
    weekActive: "bg-amber-500/20 text-amber-400 border-amber-500/50",
    weekInactive: "bg-amber-950/30 border-amber-900/50 text-amber-400/60 hover:border-amber-700 hover:text-amber-300",
    topicPill: "text-amber-400/60 hover:text-amber-300 bg-amber-950/30 hover:bg-amber-900/40 border-amber-900/50 hover:border-amber-700",
    label: "text-amber-400/70",
    description: "text-amber-400/60",
  },
  violet: {
    textarea: "bg-violet-950/50 border-violet-900/50 focus:border-violet-700 placeholder-violet-600/50",
    button: "bg-violet-500 hover:bg-violet-400 text-white",
    buttonDisabled: "disabled:bg-violet-900/50 disabled:text-violet-700",
    weekActive: "bg-violet-500/20 text-violet-400 border-violet-500/50",
    weekInactive: "bg-violet-950/30 border-violet-900/50 text-violet-400/60 hover:border-violet-700 hover:text-violet-300",
    topicPill: "text-violet-400/60 hover:text-violet-300 bg-violet-950/30 hover:bg-violet-900/40 border-violet-900/50 hover:border-violet-700",
    label: "text-violet-400/70",
    description: "text-violet-400/60",
  },
};

interface PlanModeSelectProps {
  theme?: ThemeColor;
}

export function PlanModeSelect({ theme = "neutral" }: PlanModeSelectProps) {
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

  const styles = themeStyles[theme];

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
        <p className={`max-w-lg mx-auto text-sm leading-relaxed ${styles.description}`}>
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
            className={`w-full h-28 px-4 pt-3.5 pb-14 pr-32 border rounded-2xl text-white text-[15px] focus:outline-none resize-none transition-colors ${styles.textarea}`}
            disabled={isGenerating}
          />
          <button
            onClick={handleGeneratePlan}
            disabled={!topic.trim() || isGenerating}
            className={`absolute right-4 bottom-4 px-4 py-2 text-sm font-medium rounded-xl transition-colors flex items-center gap-2 ${styles.button} ${styles.buttonDisabled}`}
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
        <label className={`block text-sm mb-3 ${styles.label}`}>
          How long should the learning plan be?
        </label>
        <div className="flex flex-wrap gap-2">
          {WEEKS_OPTIONS.map((option) => (
            <button
              key={option.value}
              onClick={() => setWeeks(option.value)}
              className={`px-3 py-1.5 text-xs rounded-md border transition-colors ${
                weeks === option.value
                  ? styles.weekActive
                  : styles.weekInactive
              }`}
            >
              {option.label}
            </button>
          ))}
        </div>
      </div>

      <div className="flex flex-wrap gap-2">
        {EXAMPLE_TOPICS.map((t) => (
          <button
            key={t}
            onClick={() => setTopic(t)}
            disabled={isGenerating}
            className={`px-3 py-1.5 text-xs border rounded-full transition-colors ${styles.topicPill}`}
          >
            {t}
          </button>
        ))}
      </div>
    </div>
  );
}
