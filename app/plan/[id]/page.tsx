"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { createBrowserClient } from "@supabase/ssr";
import Link from "next/link";
import { PlanChat } from "@/components/PlanChat";
import { Navbar } from "@/components/Navbar";

interface PlanNode {
  id: string;
  title: string;
  description: string;
  is_start: boolean;
  next_node_ids: string[];
  status: string;
}

interface LearningPlan {
  id: string;
  title: string;
  root_topic: string;
  status: string;
  description?: string;
  is_public?: boolean;
  author_username?: string;
  original_plan_id?: string;
  remix_count?: number;
}

function createSupabaseClient() {
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );
}

export default function PlanPage() {
  const params = useParams();
  const router = useRouter();
  const planId = params.id as string;
  
  const [plan, setPlan] = useState<LearningPlan | null>(null);
  const [nodes, setNodes] = useState<PlanNode[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [refreshKey, setRefreshKey] = useState(0);
  
  const supabase = createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );

  const refreshNodes = () => {
    console.log("[PlanPage] Refreshing nodes, current key:", refreshKey);
    setRefreshKey(k => k + 1);
  };

  useEffect(() => {
    async function loadPlan() {
      const { data: { user } } = await supabase.auth.getUser();
      
      if (!user) {
        router.push("/login?redirect=/plan/" + planId);
        return;
      }

      const { data: planData, error: planError } = await supabase
        .from("learning_plans")
        .select("*, profiles:author_id(username)")
        .eq("id", planId)
        .eq("user_id", user.id)
        .single();

      if (planData?.profiles) {
        planData.author_username = planData.profiles.username;
      }

      if (planError || !planData) {
        setError("Plan not found");
        setLoading(false);
        return;
      }

      setPlan(planData);

      const { data: nodesData, error: nodesError } = await supabase
        .from("plan_nodes")
        .select("*")
        .eq("plan_id", planId);

      if (nodesError) {
        setError("Failed to load nodes");
      } else {
        console.log("[PlanPage] Loaded nodes:", nodesData?.length, "current nodes:", nodes.length);
        setNodes(nodesData || []);
      }

      setLoading(false);
    }

    loadPlan();
  }, [planId, supabase, router, refreshKey]);

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

      <div className="px-4 pt-4">
        <div className={`rounded-xl border p-4 ${
          plan.is_public 
            ? "bg-green-950/20 border-green-800/50" 
            : "bg-neutral-900/30 border-neutral-800"
        }`}>
          <div className="flex items-start justify-between gap-4">
            <div className="flex-1">
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
        </div>
      </div>

      <main className="flex-1 p-4 overflow-hidden">
        <PlanChat 
          plan={plan} 
          nodes={nodes} 
          supabase={supabase}
          planId={planId}
          onRefresh={refreshNodes} 
        />
      </main>
    </div>
  );
}
