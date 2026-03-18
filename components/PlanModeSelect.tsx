"use client";

import { useState, useEffect } from "react";
import { createBrowserClient } from "@supabase/ssr";
import { useRouter } from "next/navigation";
import { isValidYouTubeUrl, EXAMPLE_YOUTUBE_VIDEOS, getYouTubeThumbnail } from "@/lib/youtube";
import { useI18n } from "@/lib/i18n";

const WEEKS_OPTIONS = [
  { value: 1, label: "planMode.week1" },
  { value: 2, label: "planMode.week2" },
  { value: 4, label: "planMode.month1" },
  { value: 8, label: "planMode.month2" },
  { value: 12, label: "planMode.month3" },
  { value: 26, label: "planMode.month6" },
];

const DEFAULT_EXAMPLE_TOPICS = [
  "planMode.exampleMachineLearning",
  "planMode.examplePhilosophy",
  "planMode.exampleQuantumPhysics",
  "planMode.exampleWorldHistory",
  "planMode.exampleCreativeWriting",
  "planMode.examplePersonalFinance",
];

type ThemeColor = "neutral" | "teal" | "slate" | "blue" | "amber" | "violet";
type InputTab = "topic" | "youtube";

const themeStyles: Record<ThemeColor, {
  textarea: string;
  button: string;
  buttonDisabled: string;
  weekActive: string;
  weekInactive: string;
  topicPill: string;
  label: string;
  description: string;
  tabActive: string;
  tabInactive: string;
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
    tabActive: "bg-white/10 text-white border-b-2 border-white",
    tabInactive: "text-neutral-500 hover:text-neutral-300 border-b-2 border-transparent",
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
    tabActive: "bg-teal-500/20 text-teal-300 border-b-2 border-teal-400",
    tabInactive: "text-teal-500/60 hover:text-teal-400 border-b-2 border-transparent",
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
    tabActive: "bg-slate-700/50 text-white border-b-2 border-slate-400",
    tabInactive: "text-slate-500 hover:text-slate-300 border-b-2 border-transparent",
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
    tabActive: "bg-blue-500/20 text-blue-300 border-b-2 border-blue-400",
    tabInactive: "text-blue-500/60 hover:text-blue-400 border-b-2 border-transparent",
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
    tabActive: "bg-amber-500/20 text-amber-300 border-b-2 border-amber-400",
    tabInactive: "text-amber-500/60 hover:text-amber-400 border-b-2 border-transparent",
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
    tabActive: "bg-violet-500/20 text-violet-300 border-b-2 border-violet-400",
    tabInactive: "text-violet-500/60 hover:text-violet-400 border-b-2 border-transparent",
  },
};

interface PlanModeSelectProps {
  theme?: ThemeColor;
  title?: string;
  subtitle?: string;
  placeholder?: string;
  exampleTopics?: string[];
  showYouTubeTab?: boolean;
}

export function PlanModeSelect({ 
  theme = "neutral",
  title,
  subtitle,
  placeholder,
  exampleTopics,
  showYouTubeTab = true,
}: PlanModeSelectProps) {
  const { t } = useI18n();
  const defaultTitle = t('planMode.buildYourLearningPath');
  const defaultPlaceholder = placeholder ?? t('problemInput.placeholder');
  const defaultExampleTopics = exampleTopics?.map(key => t(key)) ?? DEFAULT_EXAMPLE_TOPICS.map(key => t(key));
  
  const displayTitle = title ?? defaultTitle;
  const displayPlaceholder = placeholder ?? defaultPlaceholder;
  
  const defaultSubtitle = showYouTubeTab 
    ? t('planMode.subtitleWithYoutube')
    : t('planMode.subtitleWithoutYoutube');
  const displaySubtitle = subtitle ?? defaultSubtitle;
  const [activeTab, setActiveTab] = useState<InputTab>("topic");
  const [topic, setTopic] = useState("");
  const [youtubeUrl, setYoutubeUrl] = useState("");
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
    if (activeTab === "topic" && !topic.trim()) {
      setError(t('planMode.enterTopic'));
      return;
    }
    if (activeTab === "youtube") {
      if (!youtubeUrl.trim()) {
        setError(t('planMode.enterYoutubeUrl'));
        return;
      }
      if (!isValidYouTubeUrl(youtubeUrl.trim())) {
        setError(t('planMode.validYoutubeUrl'));
        return;
      }
    }

    setIsGenerating(true);
    setError("");

    try {
      const { data: { user } } = await supabase.auth.getUser();
      
      if (!user) {
        router.push("/login?redirect=plan");
        return;
      }

      // Different API endpoints based on tab
      const endpoint = activeTab === "youtube" 
        ? "/api/learning-plan/generate-from-video"
        : "/api/learning-plan/generate";
      
      const body = activeTab === "youtube"
        ? { youtubeUrl: youtubeUrl.trim(), days: weeks * 7 }
        : { topic: topic.trim(), days: weeks * 7 };

      const response = await fetch(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });

      if (!response.ok) {
        const err = await response.json();
        throw new Error(err.error || "Failed to generate plan");
      }

      const data = await response.json();
      router.push(`/plan/${data.planId}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : t('planMode.somethingWrong'));
    } finally {
      setIsGenerating(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleGeneratePlan();
    }
  };

  // Get current input value and placeholder based on tab
  const currentValue = activeTab === "youtube" ? youtubeUrl : topic;
  const youtubePlaceholder = t('planMode.youtubePlaceholder');
  const currentPlaceholder = activeTab === "youtube" 
    ? youtubePlaceholder
    : displayPlaceholder;
  const currentOnChange = activeTab === "youtube" 
    ? (e: React.ChangeEvent<HTMLTextAreaElement>) => setYoutubeUrl(e.target.value)
    : (e: React.ChangeEvent<HTMLTextAreaElement>) => setTopic(e.target.value);

  // Check if generate button should be disabled
  const isGenerateDisabled = activeTab === "youtube" 
    ? !youtubeUrl.trim() || isGenerating
    : !topic.trim() || isGenerating;

  return (
    <div className="w-full max-w-2xl p-6">
      <div className="text-center mb-10">
        <h2 className="text-3xl sm:text-4xl font-bold text-white mb-4 tracking-tight">
          {displayTitle}
        </h2>
        <p className={`max-w-lg mx-auto text-sm leading-relaxed ${styles.description}`}>
          {displaySubtitle}
        </p>
      </div>

      {/* Tab Selector - only show if YouTube tab is enabled */}
      {showYouTubeTab && (
        <div className="flex mb-4 border-b border-neutral-800">
          <button
            onClick={() => { setActiveTab("topic"); setError(""); }}
            className={`flex-1 py-3 px-4 text-sm font-medium transition-colors ${
              activeTab === "topic" ? styles.tabActive : styles.tabInactive
            }`}
          >
            <span className="flex items-center justify-center gap-2">
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
              </svg>
              {t('planMode.topicTab')}
            </span>
          </button>
          <button
            onClick={() => { setActiveTab("youtube"); setError(""); }}
            className={`flex-1 py-3 px-4 text-sm font-medium transition-colors ${
              activeTab === "youtube" ? styles.tabActive : styles.tabInactive
            }`}
          >
            <span className="flex items-center justify-center gap-2">
              <svg className="w-4 h-4" viewBox="0 0 24 24" fill="currentColor">
                <path d="M23.498 6.186a3.016 3.016 0 0 0-2.122-2.136C19.505 3.545 12 3.545 12 3.545s-7.505 0-9.377.505A3.017 3.017 0 0 0 .502 6.186C0 8.07 0 12 0 12s0 3.93.502 5.814a3.016 3.016 0 0 0 2.122 2.136c1.871.505 9.376.505 9.376.505s7.505 0 9.377-.505a3.015 3.015 0 0 0 2.122-2.136C24 15.93 24 12 24 12s0-3.93-.502-5.814zM9.545 15.568V8.432L15.818 12l-6.273 3.568z"/>
              </svg>
              {t('planMode.youtubeTab')}
            </span>
          </button>
        </div>
      )}

      {/* Input Area */}
      <div className="mb-8">
        <div className="relative">
          <textarea
            value={currentValue}
            onChange={currentOnChange}
            onKeyDown={handleKeyDown}
            placeholder={currentPlaceholder}
            rows={3}
            className={`w-full h-28 px-4 pt-3.5 pb-14 pr-32 border rounded-2xl text-white text-[15px] focus:outline-none resize-none transition-colors ${styles.textarea}`}
            disabled={isGenerating}
          />
          <button
            onClick={handleGeneratePlan}
            disabled={isGenerateDisabled}
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
            {isGenerating ? t('planMode.analyzing') : t('planMode.generate')}
          </button>
        </div>
        {error && (
          <p className="mt-3 text-sm text-red-400">{error}</p>
        )}
      </div>

      {/* Weeks Selector */}
      <div className="mb-6">
        <label className={`block text-sm mb-3 ${styles.label}`}>
          {t('planMode.howLongPlan')}
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
              {t(option.label)}
            </button>
          ))}
        </div>
      </div>

      {/* Example Pills - Different for each tab */}
      {activeTab === "topic" || !showYouTubeTab ? (
        <div className="flex flex-wrap gap-2">
          {defaultExampleTopics.map((topicItem) => (
            <button
              key={topicItem}
              onClick={() => setTopic(topicItem)}
              disabled={isGenerating}
              className={`px-3 py-1.5 text-xs border rounded-full transition-colors ${styles.topicPill}`}
            >
              {topicItem}
            </button>
          ))}
        </div>
      ) : (
        <div>
          <label className={`block text-sm mb-3 ${styles.label}`}>
            {t('planMode.tryVideos')}
          </label>
          <div className="grid grid-cols-3 gap-3">
            {EXAMPLE_YOUTUBE_VIDEOS.map((video) => (
              <button
                key={video.url}
                onClick={() => setYoutubeUrl(video.url)}
                disabled={isGenerating}
                className="group relative aspect-video rounded-xl overflow-hidden border border-neutral-800 hover:border-neutral-600 transition-all hover:scale-[1.02] disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {/* Thumbnail */}
                <img
                  src={getYouTubeThumbnail(video.url, "medium") || ""}
                  alt={video.title}
                  className="w-full h-full object-cover"
                />
                {/* Overlay gradient */}
                <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-transparent" />
                {/* Play icon */}
                <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                  <div className="w-10 h-10 rounded-full bg-red-600 flex items-center justify-center">
                    <svg className="w-5 h-5 text-white ml-0.5" viewBox="0 0 24 24" fill="currentColor">
                      <path d="M8 5v14l11-7z" />
                    </svg>
                  </div>
                </div>
                {/* Text overlay */}
                <div className="absolute bottom-0 left-0 right-0 p-2">
                  <p className="text-white text-xs font-medium truncate">{video.title}</p>
                  <p className="text-neutral-400 text-[10px] truncate">{video.channel}</p>
                </div>
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
