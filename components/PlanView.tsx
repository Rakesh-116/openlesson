"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { createBrowserClient } from "@supabase/ssr";
import Link from "next/link";
import { PlanChat } from "@/components/PlanChat";
import { Navbar } from "@/components/Navbar";
import { RemixModal } from "@/components/RemixModal";
import { getYouTubeThumbnail } from "@/lib/youtube";
import { useI18n } from "../lib/i18n";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { PlanAnalytics } from "@/components/PlanAnalytics";

export interface PlanNode {
  id: string;
  title: string;
  description: string;
  is_start: boolean;
  next_node_ids: string[];
  status: string;
  planning_prompt?: string;
  session_id?: string;
}

export interface LearningPlan {
  id: string;
  title: string;
  root_topic: string;
  status: string;
  user_id?: string;
  description?: string;
  is_public?: boolean;
  author_username?: string;
  original_plan_id?: string;
  remix_count?: number;
  // YouTube/source fields
  source_type?: "topic" | "youtube";
  source_url?: string;
  source_summary?: string;
  notes?: string;
}

interface PlanViewProps {
  initialPlan?: LearningPlan;
  initialNodes?: PlanNode[];
}

export function PlanView({ initialPlan, initialNodes }: PlanViewProps) {
  const { t } = useI18n();
  const params = useParams();
  const router = useRouter();
  const planId = params.id as string;
  
  const [plan, setPlan] = useState<LearningPlan | null>(initialPlan || null);
  const [nodes, setNodes] = useState<PlanNode[]>(initialNodes || []);
  const [loading, setLoading] = useState(!initialPlan);
  const [error, setError] = useState("");
  const [refreshKey, setRefreshKey] = useState(0);
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const [showRemixModal, setShowRemixModal] = useState(false);
  const [isEditingTitle, setIsEditingTitle] = useState(false);
  const [editTitle, setEditTitle] = useState("");
  const [copied, setCopied] = useState(false);
  const [isEditingDescription, setIsEditingDescription] = useState(false);
  const [editDescription, setEditDescription] = useState("");
  const [savingDescription, setSavingDescription] = useState(false);
  const [activeTab, setActiveTab] = useState<"graph" | "notes" | "analytics">("graph");
  const [notesContent, setNotesContent] = useState(initialPlan?.notes || "");
  const [isEditingNotes, setIsEditingNotes] = useState(false);
  const [savingNotes, setSavingNotes] = useState(false);
  
  const supabase = createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );

  const refreshNodes = () => {
    setRefreshKey(k => k + 1);
  };

  const handleNodesUpdate = (newNodes: PlanNode[]) => {
    setNodes(newNodes);
  };

  const handleShare = () => {
    const slug = encodeURIComponent(plan!.root_topic.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, ""));
    const url = `${window.location.origin}/p/${plan!.id}/${slug}`;
    navigator.clipboard.writeText(url);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  useEffect(() => {
    async function loadPlan() {
      const { data: { user } } = await supabase.auth.getUser();
      setCurrentUserId(user?.id || null);

      const { data: planData, error: planError } = await supabase
        .from("learning_plans")
        .select("*, profiles:author_id(username)")
        .eq("id", planId)
        .single();

      if (planError || !planData) {
        setError("Plan not found");
        setLoading(false);
        return;
      }

      if (!planData.is_public) {
        if (!user) {
          router.push("/login?redirect=/plan/" + planId);
          return;
        }
        if (planData.user_id !== user.id) {
          setError("Plan not found");
          setLoading(false);
          return;
        }
      }

      if (planData.profiles) {
        planData.author_username = planData.profiles.username;
      }

      setPlan(planData);

      const { data: nodesData, error: nodesError } = await supabase
        .from("plan_nodes")
        .select("*")
        .eq("plan_id", planId);

      if (nodesError) {
        setError("Failed to load nodes");
      } else {
        let finalNodes = nodesData || [];

        // Derive completion status from linked sessions
        const sessionIds = finalNodes
          .map((n: PlanNode) => n.session_id)
          .filter(Boolean) as string[];

        if (sessionIds.length > 0) {
          const { data: sessions } = await supabase
            .from("sessions")
            .select("id, status")
            .in("id", sessionIds);

          if (sessions) {
            const completedSessionIds = new Set(
              sessions
                .filter((s: { id: string; status: string }) => s.status === "completed" || s.status === "ended_by_tutor")
                .map((s: { id: string }) => s.id)
            );

            finalNodes = finalNodes.map((n: PlanNode) => {
              if (n.session_id && completedSessionIds.has(n.session_id) && n.status !== "completed") {
                return { ...n, status: "completed" };
              }
              return n;
            });
          }
        }

        setNodes(finalNodes);
      }

      setLoading(false);
    }

    loadPlan();
  }, [planId, supabase, router, refreshKey]);

  useEffect(() => {
    if (plan?.root_topic) {
      setEditTitle(plan.root_topic);
    }
  }, [plan?.root_topic]);

  useEffect(() => {
    if (plan?.description !== undefined) {
      setEditDescription(plan.description || "");
    }
  }, [plan?.description]);

  useEffect(() => {
    if (plan?.notes !== undefined) {
      setNotesContent(plan.notes || "");
    }
  }, [plan?.notes]);

  const saveNotes = async () => {
    if (!plan) return;
    setSavingNotes(true);
    try {
      const res = await fetch("/api/learning-plan/notes", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ planId: plan.id, notes: notesContent }),
      });
      const data = await res.json();
      if (data.success) {
        setPlan({ ...plan, notes: notesContent });
        setIsEditingNotes(false);
      } else {
        alert(data.error || "Failed to save notes");
      }
    } catch (err) {
      console.error("Error saving notes:", err);
      alert("Failed to save notes");
    } finally {
      setSavingNotes(false);
    }
  };

  const saveDescription = async () => {
    if (!plan) return;
    setSavingDescription(true);
    try {
      const res = await fetch(`/api/learning-plans/${planId}/visibility`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ description: editDescription }),
      });
      const data = await res.json();
      if (data.success) {
        setPlan({ ...plan, description: editDescription || undefined });
        setIsEditingDescription(false);
      } else {
        alert(data.error || "Failed to update description");
      }
    } catch (err) {
      console.error("Error updating description:", err);
      alert("Failed to update description");
    } finally {
      setSavingDescription(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-[#0a0a0a] flex items-center justify-center">
        <div className="text-neutral-400">{t('planView.loading')}</div>
      </div>
    );
  }

  if (error || !plan) {
    return (
      <div className="min-h-screen bg-[#0a0a0a] flex flex-col items-center justify-center gap-4">
        <div className="text-red-400">{error || t('planView.planNotFound')}</div>
        <Link href="/" className="text-blue-400 hover:underline">
          {t('planView.goBackHome')}
        </Link>
      </div>
    );
  }

  return (
    <div className="h-screen bg-[#0a0a0a] text-white flex flex-col overflow-hidden">
      <Navbar />

      <div className="px-3 pt-2 sm:px-4 sm:pt-3 flex-shrink-0">
        <div className={`rounded-lg border p-3 ${
          plan.is_public 
            ? "bg-green-950/20 border-green-800/50" 
            : "bg-neutral-900/30 border-neutral-800"
        }`}>
          <div className="flex items-start justify-between gap-4">
            {/* YouTube Thumbnail */}
            {plan.source_type === "youtube" && plan.source_url && (
              <a
                href={plan.source_url}
                target="_blank"
                rel="noopener noreferrer"
                className="relative flex-shrink-0 w-20 sm:w-28 aspect-video rounded-md overflow-hidden group"
              >
                <img
                  src={getYouTubeThumbnail(plan.source_url, "medium") || ""}
                  alt="Source video thumbnail"
                  className="w-full h-full object-cover"
                />
                {/* Play button overlay */}
                <div className="absolute inset-0 bg-black/30 group-hover:bg-black/50 transition-colors flex items-center justify-center">
                  <div className="w-10 h-10 rounded-full bg-red-600 flex items-center justify-center group-hover:scale-110 transition-transform">
                    <svg className="w-5 h-5 text-white ml-0.5" viewBox="0 0 24 24" fill="currentColor">
                      <path d="M8 5v14l11-7z" />
                    </svg>
                  </div>
                </div>
              </a>
            )}
            <div className="flex-1 min-w-0">
              {isEditingTitle ? (
                <div className="flex items-center gap-2 mb-2">
                  <input
                    type="text"
                    value={editTitle}
                    onChange={(e) => setEditTitle(e.target.value)}
                    className="flex-1 px-3 py-2 bg-neutral-800 border border-neutral-700 rounded-lg text-white text-sm focus:outline-none focus:border-blue-500"
                    autoFocus
                  />
                  <button
                    onClick={async () => {
                      if (!editTitle.trim()) return;
                      try {
                        const res = await fetch(`/api/learning-plans/${planId}/visibility`, {
                          method: "PUT",
                          headers: { "Content-Type": "application/json" },
                          body: JSON.stringify({ title: editTitle.trim() }),
                        });
                        const data = await res.json();
                        if (data.success) {
                          setPlan({ ...plan, root_topic: editTitle.trim(), title: editTitle.trim() });
                          setIsEditingTitle(false);
                        } else {
                          alert(data.error || "Failed to update title");
                        }
                      } catch (err) {
                        console.error("Error updating title:", err);
                        alert("Failed to update title");
                      }
                    }}
                    className="px-3 py-2 bg-blue-600 hover:bg-blue-500 text-white text-sm rounded-lg transition-colors"
                  >
                    Save
                  </button>
                  <button
                    onClick={() => {
                      setEditTitle(plan.root_topic);
                      setIsEditingTitle(false);
                    }}
                    className="px-3 py-2 bg-neutral-700 hover:bg-neutral-600 text-white text-sm rounded-lg transition-colors"
                  >
                    Cancel
                  </button>
                </div>
              ) : (
                <div className="flex items-center gap-2 mb-0.5">
                  <h2 className="text-base font-semibold text-white truncate">{plan.root_topic}</h2>
                  {currentUserId && plan.user_id === currentUserId && (
                    <button
                      onClick={() => setIsEditingTitle(true)}
                      className="text-neutral-500 hover:text-white transition-colors flex-shrink-0"
                    >
                      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
                      </svg>
                    </button>
                  )}
                </div>
              )}
              <div className="flex items-center gap-1.5 flex-wrap text-xs">
                {plan.source_type === "youtube" && (
                  <span className="inline-flex items-center gap-1 text-red-400 font-medium">
                    <svg className="w-3 h-3" viewBox="0 0 24 24" fill="currentColor">
                      <path d="M23.498 6.186a3.016 3.016 0 0 0-2.122-2.136C19.505 3.545 12 3.545 12 3.545s-7.505 0-9.377.505A3.017 3.017 0 0 0 .502 6.186C0 8.07 0 12 0 12s0 3.93.502 5.814a3.016 3.016 0 0 0 2.122 2.136c1.871.505 9.376.505 9.376.505s7.505 0 9.377-.505a3.015 3.015 0 0 0 2.122-2.136C24 15.93 24 12 24 12s0-3.93-.502-5.814zM9.545 15.568V8.432L15.818 12l-6.273 3.568z"/>
                    </svg>
                    {t('planView.youtube')}
                  </span>
                )}
                {plan.is_public ? (
                  <span className="text-green-400 font-medium">{t('planView.public')}</span>
                ) : (
                  <span className="text-neutral-400 font-medium">{t('planView.private')}</span>
                )}
                {plan.is_public && (
                  <span className="text-neutral-500">
                    · {(plan.remix_count || 0)} {(plan.remix_count || 0) === 1 ? t('planView.fork') : t('planView.forks', { count: plan.remix_count || 0 })}
                  </span>
                )}
                {plan.is_public && plan.author_username && (
                  <span className="text-neutral-500">{t('planView.by')} @{plan.author_username}</span>
                )}
                {plan.original_plan_id && (
                  <span className="text-neutral-500">· {t('planView.remixed')}</span>
                )}
              </div>
              
              {/* Description */}
              {isEditingDescription ? (
                <div className="mt-2">
                  <textarea
                    value={editDescription}
                    onChange={(e) => setEditDescription(e.target.value)}
                    placeholder={t('planView.addDescription')}
                    className="w-full px-3 py-2 bg-neutral-800 border border-neutral-700 rounded-lg text-white text-sm focus:outline-none focus:border-blue-500 resize-none"
                    rows={2}
                    autoFocus
                  />
                  <div className="flex gap-2 mt-2">
                    <button
                      onClick={saveDescription}
                      disabled={savingDescription}
                      className="px-3 py-1.5 bg-blue-600 hover:bg-blue-500 disabled:bg-neutral-700 text-white text-xs rounded-lg transition-colors"
                    >
                      {savingDescription ? t('common.saving') : t('common.save')}
                    </button>
                    <button
                      onClick={() => {
                        setEditDescription(plan.description || "");
                        setIsEditingDescription(false);
                      }}
                      className="px-3 py-1.5 bg-neutral-700 hover:bg-neutral-600 text-white text-xs rounded-lg transition-colors"
                    >
                      Cancel
                    </button>
                  </div>
                </div>
              ) : (
                <div className="mt-2 group/desc">
                  {plan.description ? (
                    <p className="text-sm text-neutral-400 leading-relaxed line-clamp-2">
                      {plan.description}
                      {currentUserId && plan.user_id === currentUserId && (
                        <button
                          onClick={() => setIsEditingDescription(true)}
                          className="ml-2 text-neutral-500 hover:text-white transition-colors opacity-0 group-hover/desc:opacity-100"
                        >
                          <svg className="w-3.5 h-3.5 inline" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
                          </svg>
                        </button>
                      )}
                    </p>
                  ) : currentUserId && plan.user_id === currentUserId ? (
                    <button
                      onClick={() => setIsEditingDescription(true)}
                      className="text-sm text-neutral-500 hover:text-neutral-400 transition-colors"
                    >
                      {t('planView.addDescriptionBtn')}
                    </button>
                  ) : null}
                </div>
              )}
            </div>
            {currentUserId && plan.user_id === currentUserId ? (
              <div className="flex gap-2">
                {plan.is_public && (
                  <button
                    onClick={handleShare}
                    className="text-xs px-3 py-1.5 rounded-lg border border-neutral-700 text-neutral-400 hover:text-white hover:bg-neutral-800 transition-colors whitespace-nowrap"
                  >
                    {copied ? t('planView.copied') : t('planView.share')}
                  </button>
                )}
                <button
                  onClick={async () => {
                    try {
                      const isPublic = plan.is_public ?? false;
                      const res = await fetch(`/api/learning-plans/${planId}/visibility`, {
                        method: "PUT",
                        headers: { "Content-Type": "application/json" },
                        body: JSON.stringify({ is_public: !isPublic }),
                      });
                      const data = await res.json();
                      if (data.success) {
                        setPlan({ ...plan, is_public: !isPublic });
                      } else {
                        alert(data.error || "Failed to update visibility");
                      }
                    } catch (err) {
                      console.error("Error toggling visibility:", err);
                      alert("Failed to update visibility");
                    }
                  }}
                  className={`text-xs px-3 py-1.5 rounded-lg border transition-colors whitespace-nowrap ${
                    plan.is_public
                      ? "bg-neutral-800 border-neutral-700 text-neutral-400 hover:text-white hover:bg-neutral-700"
                      : "bg-green-900/30 border-green-800 text-green-400 hover:bg-green-900/50"
                  }`}
                >
                  {plan.is_public ? t('planView.makePrivate') : t('planView.makePublic')}
                </button>
              </div>
            ) : !currentUserId ? (
              <div className="flex gap-2">
                {plan.is_public && (
                  <button
                    onClick={handleShare}
                    className="text-xs px-3 py-1.5 rounded-lg border border-neutral-700 text-neutral-400 hover:text-white hover:bg-neutral-800 transition-colors whitespace-nowrap"
                  >
                    {copied ? t('planView.copied') : t('planView.share')}
                  </button>
                )}
                <Link
                  href="/register"
                  className="text-xs px-3 py-1.5 rounded-lg border border-blue-500/50 text-blue-400 hover:bg-blue-500/10 transition-colors whitespace-nowrap"
                >
                  {t('planView.forkRemix')}
                </Link>
              </div>
            ) : (
              <div className="flex gap-2">
                {plan.is_public && (
                  <button
                    onClick={handleShare}
                    className="text-xs px-3 py-1.5 rounded-lg border border-neutral-700 text-neutral-400 hover:text-white hover:bg-neutral-800 transition-colors whitespace-nowrap"
                  >
                    {copied ? t('planView.copied') : t('planView.share')}
                  </button>
                )}
                <button
                  onClick={() => setShowRemixModal(true)}
                  className="text-xs px-3 py-1.5 rounded-lg border border-blue-500/50 text-blue-400 hover:bg-blue-500/10 transition-colors whitespace-nowrap"
                >
                  {t('planView.forkRemix')}
                </button>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Tab bar */}
      <div className="px-3 sm:px-4 pt-2 flex-shrink-0">
        <div className="flex gap-1 border-b border-neutral-800">
          {(["graph", "notes", "analytics"] as const).map((tab) => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={`px-4 py-2 text-sm font-medium transition-colors border-b-2 -mb-px ${
                activeTab === tab
                  ? "text-white border-blue-500"
                  : "text-neutral-500 border-transparent hover:text-neutral-300"
              }`}
            >
              {tab === "graph" ? "Plan Builder" : tab === "notes" ? "Notes" : "Analytics"}
            </button>
          ))}
        </div>
      </div>

      <main className="flex-1 p-3 sm:p-4 pb-3 sm:pb-4 min-h-0 overflow-hidden">
        {activeTab === "graph" && (
          <PlanChat 
            plan={plan} 
            nodes={nodes} 
            supabase={supabase}
            planId={planId}
            onRefresh={refreshNodes}
            onNodesUpdate={handleNodesUpdate}
            isOwner={currentUserId ? plan.user_id === currentUserId : false}
            currentUserId={currentUserId}
          />
        )}

        {activeTab === "notes" && (
          <div className="h-full overflow-y-auto">
            <div className="w-full">
              {currentUserId && plan.user_id === currentUserId ? (
                // Owner: editable notes
                isEditingNotes ? (
                  <div className="space-y-3">
                    <textarea
                      value={notesContent}
                      onChange={(e) => setNotesContent(e.target.value)}
                      placeholder="Write notes about this plan... (Markdown supported)"
                      className="w-full h-[60vh] px-4 py-3 bg-neutral-900 border border-neutral-700 rounded-lg text-white text-sm font-mono focus:outline-none focus:border-blue-500 resize-none"
                      autoFocus
                    />
                    <div className="flex gap-2">
                      <button
                        onClick={saveNotes}
                        disabled={savingNotes}
                        className="px-4 py-2 bg-blue-600 hover:bg-blue-500 disabled:bg-neutral-700 text-white text-sm rounded-lg transition-colors"
                      >
                        {savingNotes ? "Saving..." : "Save"}
                      </button>
                      <button
                        onClick={() => {
                          setNotesContent(plan.notes || "");
                          setIsEditingNotes(false);
                        }}
                        className="px-4 py-2 bg-neutral-700 hover:bg-neutral-600 text-white text-sm rounded-lg transition-colors"
                      >
                        Cancel
                      </button>
                    </div>
                  </div>
                ) : (
                  <div>
                    {notesContent ? (
                      <div 
                        className="prose prose-invert prose-sm max-w-none cursor-pointer hover:bg-neutral-900/50 rounded-lg p-4 transition-colors"
                        onClick={() => setIsEditingNotes(true)}
                      >
                        <ReactMarkdown remarkPlugins={[remarkGfm]}>{notesContent}</ReactMarkdown>
                        <p className="text-neutral-600 text-xs mt-4 italic">Click to edit</p>
                      </div>
                    ) : (
                      <button
                        onClick={() => setIsEditingNotes(true)}
                        className="w-full py-12 border-2 border-dashed border-neutral-700 rounded-lg text-neutral-500 hover:text-neutral-400 hover:border-neutral-600 transition-colors"
                      >
                        Add notes to this plan...
                      </button>
                    )}
                  </div>
                )
              ) : (
                // Viewer: read-only notes
                notesContent ? (
                  <div className="prose prose-invert prose-sm max-w-none p-4">
                    <ReactMarkdown remarkPlugins={[remarkGfm]}>{notesContent}</ReactMarkdown>
                  </div>
                ) : (
                  <div className="text-center py-12 text-neutral-500">
                    No notes for this plan yet.
                  </div>
                )
              )}
            </div>
          </div>
        )}

        {activeTab === "analytics" && (
          <PlanAnalytics 
            planId={planId}
            isOwner={currentUserId ? plan.user_id === currentUserId : false}
          />
        )}
      </main>

      {showRemixModal && (
        <RemixModal
          plan={{ id: plan.id, root_topic: plan.root_topic, author_username: plan.author_username || "anonymous", remix_count: plan.remix_count || 0 }}
          onClose={() => setShowRemixModal(false)}
          onComplete={(newPlanId) => {
            setShowRemixModal(false);
            router.push(`/plan/${newPlanId}`);
          }}
        />
      )}
    </div>
  );
}
