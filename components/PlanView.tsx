"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { createBrowserClient } from "@supabase/ssr";
import Link from "next/link";
import { PlanChat } from "@/components/PlanChat";
import { Navbar } from "@/components/Navbar";
import { RemixModal } from "@/components/RemixModal";

export interface PlanNode {
  id: string;
  title: string;
  description: string;
  is_start: boolean;
  next_node_ids: string[];
  status: string;
  planning_prompt?: string;
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
}

interface PlanViewProps {
  initialPlan?: LearningPlan;
  initialNodes?: PlanNode[];
}

export function PlanView({ initialPlan, initialNodes }: PlanViewProps) {
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
        setNodes(nodesData || []);
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

  if (loading) {
    return (
      <div className="min-h-screen bg-[#0a0a0a] flex items-center justify-center">
        <div className="text-neutral-400">Loading plan...</div>
      </div>
    );
  }

  if (error || !plan) {
    return (
      <div className="min-h-screen bg-[#0a0a0a] flex flex-col items-center justify-center gap-4">
        <div className="text-red-400">{error || "Plan not found"}</div>
        <Link href="/" className="text-blue-400 hover:underline">
          Go back home
        </Link>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#0a0a0a] text-white">
      <Navbar />

      <div className="px-3 pt-3 sm:pt-4">
        <div className={`rounded-xl border p-3 sm:p-4 ${
          plan.is_public 
            ? "bg-green-950/20 border-green-800/50" 
            : "bg-neutral-900/30 border-neutral-800"
        }`}>
          <div className="flex items-start justify-between gap-4">
            <div className="flex-1">
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
                <div className="flex items-center gap-2 mb-1">
                  <h2 className="text-lg font-semibold text-white">{plan.root_topic}</h2>
                  {currentUserId && plan.user_id === currentUserId && (
                    <button
                      onClick={() => setIsEditingTitle(true)}
                      className="text-neutral-500 hover:text-white transition-colors"
                    >
                      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
                      </svg>
                    </button>
                  )}
                </div>
              )}
              <div className="flex items-center gap-2 mb-1 flex-wrap">
                {plan.is_public ? (
                  <span className="text-green-400 text-sm font-medium">Public</span>
                ) : (
                  <span className="text-neutral-400 text-sm font-medium">Private</span>
                )}
                {plan.is_public && (
                  <span className="text-neutral-500 text-xs">
                    · {(plan.remix_count || 0)} {(plan.remix_count || 0) === 1 ? "fork/remix" : "forks/remixes"}
                  </span>
                )}
                {plan.is_public && plan.author_username && (
                  <span className="text-neutral-500 text-sm">by @{plan.author_username}</span>
                )}
                {plan.original_plan_id && (
                  <span className="text-neutral-500 text-sm">· Remixed plan</span>
                )}
              </div>
              {!plan.is_public && (
                <p className="text-xs text-neutral-500">
                  Make your plan public to let others fork or remix it for their own learning journey.
                </p>
              )}
              {plan.is_public && (
                <p className="text-xs text-neutral-500">
                  Others can fork or remix this plan to create their own copy.
                </p>
              )}
            </div>
            {currentUserId && plan.user_id === currentUserId ? (
              <div className="flex gap-2">
                {plan.is_public && (
                  <button
                    onClick={handleShare}
                    className="text-xs px-3 py-1.5 rounded-lg border border-neutral-700 text-neutral-400 hover:text-white hover:bg-neutral-800 transition-colors whitespace-nowrap"
                  >
                    {copied ? "Copied!" : "Share"}
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
                  {plan.is_public ? "Make Private" : "Make Public"}
                </button>
              </div>
            ) : !currentUserId ? (
              <div className="flex gap-2">
                {plan.is_public && (
                  <button
                    onClick={handleShare}
                    className="text-xs px-3 py-1.5 rounded-lg border border-neutral-700 text-neutral-400 hover:text-white hover:bg-neutral-800 transition-colors whitespace-nowrap"
                  >
                    {copied ? "Copied!" : "Share"}
                  </button>
                )}
                <Link
                  href="/register"
                  className="text-xs px-3 py-1.5 rounded-lg border border-blue-500/50 text-blue-400 hover:bg-blue-500/10 transition-colors whitespace-nowrap"
                >
                  Fork / Remix
                </Link>
              </div>
            ) : (
              <div className="flex gap-2">
                {plan.is_public && (
                  <button
                    onClick={handleShare}
                    className="text-xs px-3 py-1.5 rounded-lg border border-neutral-700 text-neutral-400 hover:text-white hover:bg-neutral-800 transition-colors whitespace-nowrap"
                  >
                    {copied ? "Copied!" : "Share"}
                  </button>
                )}
                <button
                  onClick={() => setShowRemixModal(true)}
                  className="text-xs px-3 py-1.5 rounded-lg border border-blue-500/50 text-blue-400 hover:bg-blue-500/10 transition-colors whitespace-nowrap"
                >
                  Fork / Remix
                </button>
              </div>
            )}
          </div>
        </div>
      </div>

      <main className="flex-1 p-3 sm:p-4 pb-[calc(1rem+env(safe-area-inset-bottom))] sm:pb-4 overflow-hidden">
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
