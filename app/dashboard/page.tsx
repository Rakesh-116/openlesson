"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Navbar } from "@/components/Navbar";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import { getSessions, deleteSession, getLearningPlans, type Session, type LearningPlan } from "@/lib/storage";
import { DEFAULT_PROMPTS, PROMPT_META, type PromptKey, type UserPrompts } from "@/lib/openrouter";

type Tab = "sessions" | "plans" | "agentic" | "config";

interface OpenRouterModel {
  id: string;
  label: string;
  description: string;
}

interface AgentApiKey {
  id: string;
  key_prefix: string;
  label: string | null;
  rate_limit: number;
  is_active: boolean;
  created_at: string;
  last_used_at: string | null;
  usage_count: number;
}

export default function DashboardPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<Tab>("sessions");

  // User state
  const [user, setUser] = useState<{
    email?: string;
    username?: string;
    plan?: string;
    isAdmin?: boolean;
    extraLessons?: number;
  } | null>(null);

  // Sessions tab
  const [sessions, setSessions] = useState<Session[]>([]);
  const [sessionSearch, setSessionSearch] = useState("");
  const [sessionStatusFilter, setSessionStatusFilter] = useState<string>("all");
  const [sessionPage, setSessionPage] = useState(1);
  const sessionPageSize = 10;

  // Plans tab
  const [learningPlans, setLearningPlans] = useState<LearningPlan[]>([]);
  const [planSearch, setPlanSearch] = useState("");
  const [planStatusFilter, setPlanStatusFilter] = useState<string>("all");
  const [planPage, setPlanPage] = useState(1);
  const planPageSize = 10;

  // Agentic tab
  const [apiKeys, setApiKeys] = useState<AgentApiKey[]>([]);
  const [creatingKey, setCreatingKey] = useState(false);
  const [newKeyValue, setNewKeyValue] = useState<string | null>(null);
  const [newKeyName, setNewKeyName] = useState("");
  const [keyCopied, setKeyCopied] = useState(false);

  // Config tab
  const [availableModels, setAvailableModels] = useState<OpenRouterModel[]>([]);
  const [tutorModel, setTutorModel] = useState<string>("");
  const [askModel, setAskModel] = useState<string>("");
  const [plannerModel, setPlannerModel] = useState<string>("");
  const [modelsLoading, setModelsLoading] = useState(true);
  const [modelSaving, setModelSaving] = useState(false);
  const [modelSaved, setModelSaved] = useState(false);

  const [userPrompts, setUserPrompts] = useState<UserPrompts>({});
  const [promptsSaving, setPromptsSaving] = useState(false);
  const [promptsSaved, setPromptsSaved] = useState(false);

  const supabase = createClient();

  useEffect(() => {
    loadData();
  }, []);

  // Reset page when search or filter changes
  useEffect(() => {
    setSessionPage(1);
  }, [sessionSearch, sessionStatusFilter]);

  useEffect(() => {
    setPlanPage(1);
  }, [planSearch, planStatusFilter]);

  const loadData = async () => {
    try {
      const { data: { user: authUser } } = await supabase.auth.getUser();

      if (!authUser) {
        router.push("/login");
        return;
      }

      setUser({ email: authUser.email });

      // Fetch profile
      const { data: profile } = await supabase
        .from("profiles")
        .select("username, metadata, plan, is_admin, extra_lessons")
        .eq("id", authUser.id)
        .single();

      if (profile) {
        setUser({
          email: authUser.email,
          username: profile.username || undefined,
          plan: profile.plan || "free",
          isAdmin: profile.is_admin || false,
          extraLessons: profile.extra_lessons || 0,
        });

        if (profile.metadata?.prompts) {
          setUserPrompts(profile.metadata.prompts as UserPrompts);
        }
        if (profile.metadata?.tutor_model) {
          setTutorModel(profile.metadata.tutor_model as string);
        }
        if (profile.metadata?.ask_model) {
          setAskModel(profile.metadata.ask_model as string);
        }
        if (profile.metadata?.planner_model) {
          setPlannerModel(profile.metadata.planner_model as string);
        }
      }

      // Load sessions
      const loadedSessions = await getSessions();
      setSessions(loadedSessions);

      // Load learning plans
      const plans = await getLearningPlans();
      setLearningPlans(plans);

      // Load API keys
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { data: keys } = await supabase
        .from("agent_api_keys")
        .select(`
          id,
          key_prefix,
          label,
          rate_limit,
          is_active,
          created_at,
          last_used_at
        `)
        .eq("user_id", authUser.id)
        .order("created_at", { ascending: false });

      if (keys) {
        const keysWithUsage = await Promise.all(
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          keys.map(async (key: any) => {
            const { count } = await supabase
              .from("sessions")
              .select("*", { count: "exact", head: true })
              .eq("agent_api_key_id", key.id);

            return {
              ...key,
              usage_count: count || 0,
            } as AgentApiKey;
          })
        );
        setApiKeys(keysWithUsage);
      }

      // Load available models
      try {
        const modelsRes = await fetch("/api/openrouter/models");
        const modelsData = await modelsRes.json();
        if (modelsData.models) {
          setAvailableModels(modelsData.models);
          setModelsLoading(false);
          if (!profile?.metadata?.tutor_model && modelsData.models.length > 0) {
            setTutorModel(modelsData.models[0].id);
          }
          if (!profile?.metadata?.ask_model && modelsData.models.length > 0) {
            setAskModel(modelsData.models[0].id);
          }
        }
      } catch (e) {
        console.error("Failed to load models:", e);
        setModelsLoading(false);
      }
    } catch (err) {
      console.error("Dashboard load error:", err);
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteSession = async (id: string) => {
    if (!confirm("Delete this session? This cannot be undone.")) return;
    await deleteSession(id);
    setSessions((prev) => prev.filter((s) => s.id !== id));
  };

  const handleSaveModels = async () => {
    setModelSaving(true);
    try {
      const { data: { user: authUser } } = await supabase.auth.getUser();
      if (!authUser) return;

      const { data: profile } = await supabase
        .from("profiles")
        .select("metadata")
        .eq("id", authUser.id)
        .single();

      const currentMetadata = profile?.metadata || {};

      await supabase
        .from("profiles")
        .update({
          metadata: {
            ...currentMetadata,
            tutor_model: tutorModel,
            ask_model: askModel,
            planner_model: plannerModel,
          },
        })
        .eq("id", authUser.id);

      setModelSaved(true);
      setTimeout(() => setModelSaved(false), 2000);
    } catch (err) {
      console.error("Failed to save models:", err);
    } finally {
      setModelSaving(false);
    }
  };

  const handleSavePrompts = async () => {
    setPromptsSaving(true);
    try {
      const { data: { user: authUser } } = await supabase.auth.getUser();
      if (!authUser) return;

      const { data: profile } = await supabase
        .from("profiles")
        .select("metadata")
        .eq("id", authUser.id)
        .single();

      const currentMetadata = profile?.metadata || {};

      await supabase
        .from("profiles")
        .update({
          metadata: {
            ...currentMetadata,
            prompts: userPrompts,
          },
        })
        .eq("id", authUser.id);

      setPromptsSaved(true);
      setTimeout(() => setPromptsSaved(false), 2000);
    } catch (err) {
      console.error("Failed to save prompts:", err);
    } finally {
      setPromptsSaving(false);
    }
  };

  const handleResetPrompt = (key: PromptKey) => {
    setUserPrompts((prev) => {
      const next = { ...prev };
      delete next[key];
      return next;
    });
  };

  const handleResetAllPrompts = () => {
    setUserPrompts({});
  };

  const handleCreateApiKey = async () => {
    // Check if user is Pro or admin
    if (user?.plan !== "pro" && !user?.isAdmin) {
      alert("API Keys are only available on the Pro plan. Upgrade to Pro to create API keys.");
      return;
    }
    if (!newKeyName.trim()) return;
    setCreatingKey(true);
    try {
      const res = await fetch("/api/agent/keys", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ label: newKeyName.trim() }),
      });
      const data = await res.json();
      if (data.key) {
        setApiKeys((prev) => [
          {
            id: data.key.id,
            key_prefix: data.key.key_prefix,
            label: data.key.label,
            rate_limit: data.key.rate_limit,
            is_active: data.key.is_active,
            created_at: data.key.created_at,
            last_used_at: null,
            usage_count: 0,
          },
          ...prev,
        ]);
        setNewKeyValue(data.key.key);
        setTimeout(() => setNewKeyValue(null), 30000);
      }
    } catch (err) {
      console.error("Failed to create key:", err);
    } finally {
      setCreatingKey(false);
    }
  };

  const handleDeleteApiKey = async (id: string) => {
    if (!confirm("Delete this API key? This cannot be undone.")) return;
    try {
      await fetch(`/api/agent/keys/${id}`, { method: "DELETE" });
      setApiKeys((prev) => prev.filter((k) => k.id !== id));
    } catch (err) {
      console.error("Failed to delete key:", err);
    }
  };

  const formatDuration = (ms: number) => {
    const mins = Math.floor(ms / 60000);
    const secs = Math.floor((ms % 60000) / 1000);
    return mins > 0 ? `${mins}m ${secs}s` : `${secs}s`;
  };

  const formatDate = (dateStr: string) => {
    return new Date(dateStr).toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
    });
  };

  // Filter and paginate sessions
  const filteredSessions = sessions.filter((s) => {
    const matchesSearch = sessionSearch === "" || 
      s.problem.toLowerCase().includes(sessionSearch.toLowerCase());
    const matchesStatus = sessionStatusFilter === "all" || s.status === sessionStatusFilter;
    return matchesSearch && matchesStatus;
  });

  const totalSessionPages = Math.ceil(filteredSessions.length / sessionPageSize);
  const paginatedSessions = filteredSessions.slice(
    (sessionPage - 1) * sessionPageSize,
    sessionPage * sessionPageSize
  );

  // Filter and paginate plans
  const filteredPlans = learningPlans.filter((p) => {
    const matchesSearch = planSearch === "" || 
      p.root_topic.toLowerCase().includes(planSearch.toLowerCase());
    const matchesStatus = planStatusFilter === "all" || p.status === planStatusFilter;
    return matchesSearch && matchesStatus;
  });

  const totalPlanPages = Math.ceil(filteredPlans.length / planPageSize);
  const paginatedPlans = filteredPlans.slice(
    (planPage - 1) * planPageSize,
    planPage * planPageSize
  );

  if (loading) {
    return (
      <div className="min-h-screen bg-[#0a0a0a] flex items-center justify-center">
        <div className="text-neutral-400">Loading...</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#0a0a0a] text-white">
      <Navbar />

      {/* Tabs */}
      <div className="border-b border-neutral-800/60">
        <div className="max-w-5xl mx-auto flex gap-1 px-4 sm:px-6">
          {[
            { id: "sessions", label: "Sessions" },
            { id: "plans", label: "Plans" },
            { id: "agentic", label: "Agentic Usage" },
            { id: "config", label: "Configuration" },
          ].map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id as Tab)}
              className={`px-4 py-3 text-sm font-medium transition-colors relative ${
                activeTab === tab.id
                  ? "text-white"
                  : "text-neutral-500 hover:text-neutral-300"
              }`}
            >
              {tab.label}
              {activeTab === tab.id && (
                <span className="absolute bottom-0 left-0 right-0 h-0.5 bg-white" />
              )}
            </button>
          ))}
        </div>
      </div>

      {/* Content */}
      <main className="max-w-5xl mx-auto p-4 sm:px-6 py-8">
        {/* Sessions Tab */}
        {activeTab === "sessions" && (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-semibold">Session History</h2>
              <Link
                href="/"
                className="text-sm text-blue-400 hover:text-blue-300 transition-colors"
              >
                Start new session
              </Link>
            </div>

            {/* Search and Filter */}
            <div className="flex flex-col sm:flex-row gap-3">
              <div className="flex-1">
                <input
                  type="text"
                  placeholder="Search sessions..."
                  value={sessionSearch}
                  onChange={(e) => setSessionSearch(e.target.value)}
                  className="w-full bg-neutral-900 border border-neutral-800 rounded-lg px-3 py-2 text-sm text-neutral-200 placeholder:text-neutral-600 focus:outline-none focus:border-neutral-600"
                />
              </div>
              <select
                value={sessionStatusFilter}
                onChange={(e) => setSessionStatusFilter(e.target.value)}
                className="bg-neutral-900 border border-neutral-800 rounded-lg px-3 py-2 text-sm text-neutral-200 focus:outline-none focus:border-neutral-600"
              >
                <option value="all">All Status</option>
                <option value="active">Active</option>
                <option value="completed">Completed</option>
                <option value="ended_by_tutor">Ended by Tutor</option>
              </select>
            </div>

            {filteredSessions.length === 0 ? (
              <div className="text-center py-12 text-neutral-500">
                <p>No sessions yet.</p>
                <Link href="/" className="text-blue-400 hover:underline mt-2 inline-block">
                  Start your first session
                </Link>
              </div>
            ) : (
              <div className="space-y-2">
                {paginatedSessions.map((session) => {
                  const isCompleted = session.status === "completed" || session.status === "ended_by_tutor";
                  const isPaused = session.status === "paused";
                  return (
                  <Link
                    key={session.id}
                    href={isCompleted ? `/results?id=${session.id}` : `/session?id=${session.id}`}
                    className="block rounded-lg border border-neutral-800 bg-neutral-900/50 overflow-hidden hover:bg-neutral-800/30 transition-colors"
                  >
                    <div className="flex items-center justify-between p-4">
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-neutral-200 truncate">
                          {session.problem}
                        </p>
                        <p className="text-xs text-neutral-500 mt-1">
                          {formatDate(session.startedAt)} · {formatDuration(session.durationMs)} ·{" "}
                          <span
                            className={`inline-flex px-1.5 py-0.5 rounded text-[10px] ${
                              session.status === "completed" || session.status === "ended_by_tutor"
                                ? "bg-green-900/30 text-green-400"
                                : session.status === "paused"
                                ? "bg-yellow-900/30 text-yellow-400"
                                : "bg-neutral-700 text-neutral-400"
                            }`}
                          >
                            {session.status === "ready" ? "Ready" : session.status === "paused" ? "Paused" : session.status}
                          </span>
                          {session.planTitle && (
                            <span className="ml-2 inline-flex px-1.5 py-0.5 rounded text-[10px] bg-purple-900/30 text-purple-400">
                              {session.planTitle}
                            </span>
                          )}
                        </p>
                      </div>
                      <button
                        onClick={(e) => {
                          e.preventDefault();
                          e.stopPropagation();
                          handleDeleteSession(session.id);
                        }}
                        className="p-1.5 text-neutral-600 hover:text-red-400 transition-colors ml-4"
                      >
                        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                        </svg>
                      </button>
                    </div>
                  </Link>
                  );
                })}
              </div>
            )}

            {/* Pagination */}
            {totalSessionPages > 1 && (
              <div className="flex items-center justify-between pt-4 border-t border-neutral-800/60">
                <p className="text-xs text-neutral-500">
                  Showing {(sessionPage - 1) * sessionPageSize + 1}-{Math.min(sessionPage * sessionPageSize, filteredSessions.length)} of {filteredSessions.length}
                </p>
                <div className="flex gap-2">
                  <button
                    onClick={() => setSessionPage((p) => Math.max(1, p - 1))}
                    disabled={sessionPage === 1}
                    className="px-3 py-1 text-xs text-neutral-400 hover:text-white disabled:opacity-50 disabled:cursor-not-allowed border border-neutral-700 rounded transition-colors"
                  >
                    Previous
                  </button>
                  <button
                    onClick={() => setSessionPage((p) => Math.min(totalSessionPages, p + 1))}
                    disabled={sessionPage === totalSessionPages}
                    className="px-3 py-1 text-xs text-neutral-400 hover:text-white disabled:opacity-50 disabled:cursor-not-allowed border border-neutral-700 rounded transition-colors"
                  >
                    Next
                  </button>
                </div>
              </div>
            )}
          </div>
        )}

        {/* Plans Tab */}
        {activeTab === "plans" && (
          <div className="space-y-8">
            {/* Learning Plans List */}
            <div>
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-lg font-semibold">Learning Plans</h2>
                <Link
                  href="/"
                  className="text-sm text-blue-400 hover:text-blue-300 transition-colors"
                >
                  Create new plan
                </Link>
              </div>

              {/* Search and Filter */}
              <div className="flex flex-col sm:flex-row gap-3 mb-4">
                <div className="flex-1">
                  <input
                    type="text"
                    placeholder="Search plans..."
                    value={planSearch}
                    onChange={(e) => setPlanSearch(e.target.value)}
                    className="w-full bg-neutral-900 border border-neutral-800 rounded-lg px-3 py-2 text-sm text-neutral-200 placeholder:text-neutral-600 focus:outline-none focus:border-neutral-600"
                  />
                </div>
                <select
                  value={planStatusFilter}
                  onChange={(e) => setPlanStatusFilter(e.target.value)}
                  className="bg-neutral-900 border border-neutral-800 rounded-lg px-3 py-2 text-sm text-neutral-200 focus:outline-none focus:border-neutral-600"
                >
                  <option value="all">All Status</option>
                  <option value="active">Active</option>
                  <option value="completed">Completed</option>
                  <option value="paused">Paused</option>
                </select>
              </div>

              {filteredPlans.length === 0 ? (
                <div className="text-center py-12 text-neutral-500">
                  <p>No learning plans yet.</p>
                  <Link href="/" className="text-blue-400 hover:underline mt-2 inline-block">
                    Create your first plan
                  </Link>
                </div>
              ) : (
                <div className="space-y-2">
                  {paginatedPlans.map((plan) => (
                    <div
                      key={plan.id}
                      className="flex items-center justify-between p-4 rounded-lg border border-neutral-800 bg-neutral-900/50 hover:bg-neutral-800/30 transition-colors"
                    >
                      <Link href={`/plan/${plan.id}`} className="flex-1">
                        <p className="text-sm font-medium text-neutral-200">{plan.root_topic}</p>
                        <p className="text-xs text-neutral-500 mt-0.5">
                          Created {formatDate(plan.created_at)}
                        </p>
                      </Link>
                      <div className="flex items-center gap-2">
                        <button
                          onClick={async () => {
                            try {
                              const isPublic = (plan as any).is_public ?? false;
                              const res = await fetch(`/api/learning-plans/${plan.id}/visibility`, {
                                method: "PUT",
                                headers: { "Content-Type": "application/json" },
                                body: JSON.stringify({ is_public: !isPublic }),
                              });
                              const data = await res.json();
                              if (data.success) {
                                setLearningPlans((plans) =>
                                  plans.map((p) =>
                                    p.id === plan.id ? { ...p, is_public: !isPublic } : p
                                  )
                                );
                              } else {
                                alert(data.error || "Failed to update visibility");
                              }
                            } catch (err) {
                              console.error("Error toggling visibility:", err);
                              alert("Failed to update visibility");
                            }
                          }}
                          className={`text-xs px-2 py-1 rounded border transition-colors ${
                            (plan as any).is_public
                              ? "bg-green-900/30 border-green-800 text-green-400 hover:bg-green-900/50"
                              : "bg-neutral-800 border-neutral-700 text-neutral-500 hover:text-neutral-400"
                          }`}
                        >
                          {(plan as any).is_public ? "Public" : "Private"}
                        </button>
                        <span
                          className={`text-xs px-2 py-1 rounded ${
                            plan.status === "active"
                              ? "bg-blue-900/30 text-blue-400"
                              : plan.status === "completed"
                              ? "bg-green-900/30 text-green-400"
                              : "bg-neutral-700 text-neutral-400"
                          }`}
                        >
                          {plan.status}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {/* Pagination */}
              {totalPlanPages > 1 && (
                <div className="flex items-center justify-between pt-4 border-t border-neutral-800/60">
                  <p className="text-xs text-neutral-500">
                    Showing {(planPage - 1) * planPageSize + 1}-{Math.min(planPage * planPageSize, filteredPlans.length)} of {filteredPlans.length}
                  </p>
                  <div className="flex gap-2">
                    <button
                      onClick={() => setPlanPage((p) => Math.max(1, p - 1))}
                      disabled={planPage === 1}
                      className="px-3 py-1 text-xs text-neutral-400 hover:text-white disabled:opacity-50 disabled:cursor-not-allowed border border-neutral-700 rounded transition-colors"
                    >
                      Previous
                    </button>
                    <button
                      onClick={() => setPlanPage((p) => Math.min(totalPlanPages, p + 1))}
                      disabled={planPage === totalPlanPages}
                      className="px-3 py-1 text-xs text-neutral-400 hover:text-white disabled:opacity-50 disabled:cursor-not-allowed border border-neutral-700 rounded transition-colors"
                    >
                      Next
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Agentic Usage Tab */}
        {activeTab === "agentic" && (
          <div className="space-y-8">
            {/* API Keys Section */}
            <div>
              {user?.plan !== "pro" && !user?.isAdmin && (
                <div className="mb-4 p-4 rounded-lg border border-yellow-500/30 bg-yellow-500/5">
                  <p className="text-sm text-yellow-400">
                    API Keys are available on the Pro plan.{" "}
                    <button
                      onClick={() => window.location.href = "/pricing"}
                      className="underline hover:text-yellow-300"
                    >
                      Upgrade to Pro
                    </button>{" "}
                    to create API keys.
                  </p>
                </div>
              )}
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-lg font-semibold">API Keys</h2>
              </div>
              <div className="flex gap-2 mb-4">
                <input
                  type="text"
                  value={newKeyName}
                  onChange={(e) => setNewKeyName(e.target.value)}
                  placeholder="Enter key name"
                  className="flex-1 px-3 py-1.5 text-sm bg-neutral-900 border border-neutral-700 rounded-lg focus:outline-none focus:border-blue-600"
                />
                <button
                  onClick={handleCreateApiKey}
                  disabled={creatingKey}
                  className="px-3 py-1.5 text-sm bg-blue-600 hover:bg-blue-500 disabled:opacity-50 rounded-lg transition-colors"
                >
                  {creatingKey ? "Creating..." : "Create New Key"}
                </button>
              </div>

              {/* New Key Display */}
              {newKeyValue && (
                <div className="mb-4 p-4 rounded-lg border border-green-500/30 bg-green-500/5">
                  <div className="flex items-center justify-between mb-2">
                    <p className="text-sm text-green-400">
                      Your new API key (copy now - won't be shown again):
                    </p>
                    <button
                      onClick={() => {
                        navigator.clipboard.writeText(newKeyValue);
                        setKeyCopied(true);
                        setTimeout(() => setKeyCopied(false), 2000);
                      }}
                      className="text-xs px-2 py-1 bg-green-600 hover:bg-green-500 rounded transition-colors"
                    >
                      {keyCopied ? "Copied!" : "Copy"}
                    </button>
                  </div>
                  <code className="block text-xs text-neutral-300 bg-neutral-900 p-2 rounded font-mono break-all">
                    {newKeyValue}
                  </code>
                </div>
              )}

              {apiKeys.length === 0 ? (
                <div className="text-center py-12 text-neutral-500 border border-neutral-800 rounded-lg">
                  <p>No API keys yet.</p>
                </div>
              ) : (
                <div className="space-y-2">
                  {apiKeys.map((key) => (
                    <div
                      key={key.id}
                      className="flex items-center justify-between p-4 rounded-lg border border-neutral-800 bg-neutral-900/50"
                    >
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-neutral-200">
                          {key.label || "Unnamed Key"}
                        </p>
                        <p className="text-xs text-neutral-500 mt-0.5 font-mono">
                          sk_{key.key_prefix}...
                        </p>
                        <p className="text-xs text-neutral-600 mt-1">
                          {key.usage_count} requests · Created {formatDate(key.created_at)}
                        </p>
                      </div>
                      <button
                        onClick={() => handleDeleteApiKey(key.id)}
                        className="p-2 text-neutral-600 hover:text-red-400 transition-colors"
                      >
                        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                        </svg>
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* API Usage Info */}
            <div>
              <h2 className="text-lg font-semibold mb-4">API Usage</h2>
              <div className="p-4 rounded-lg border border-neutral-800 bg-neutral-900/50">
                <p className="text-sm text-neutral-400 mb-3">
                  Use your API key to access Socratic tutoring programmatically.
                </p>
                <div className="bg-neutral-950 rounded-lg p-4 font-mono text-xs text-neutral-300 overflow-x-auto">
                  <p className="text-neutral-500 mb-2">// Example request</p>
                  <p>curl -X POST https://socrates.example.com/api/agent/session/analyze \</p>
                  <p className="pl-4">-H "Authorization: Bearer YOUR_API_KEY" \</p>
                  <p className="pl-4">-H "Content-Type: application/json" \</p>
                  <p className="pl-4">-d '{`{"problem": "your problem", "audio": "base64..."}`}'</p>
                </div>
                <p className="text-xs text-neutral-600 mt-3">
                  Each API key is rate-limited to 100 requests per minute.
                </p>
              </div>
            </div>
          </div>
        )}

        {/* Configuration Tab */}
        {activeTab === "config" && (
          <div className="space-y-8">
            {/* Model Selection */}
            <div>
              <h2 className="text-lg font-semibold mb-4">Model Selection</h2>
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="p-4 rounded-lg border border-neutral-800 bg-neutral-900/50">
                  <label className="block text-sm font-medium text-neutral-300 mb-1">
                    Tutor Model
                  </label>
                  <p className="text-xs text-neutral-500 mb-3">
                    The model that observes and guides your lesson
                  </p>
                  <select
                    value={tutorModel}
                    onChange={(e) => setTutorModel(e.target.value)}
                    disabled={modelsLoading}
                    className="w-full bg-neutral-950 border border-neutral-700 rounded-lg px-3 py-2 text-sm text-neutral-200 focus:outline-none focus:border-neutral-500"
                  >
                    {modelsLoading ? (
                      <option>Loading models...</option>
                    ) : (
                      availableModels.map((model) => (
                        <option key={model.id} value={model.id}>
                          {model.label}
                        </option>
                      ))
                    )}
                  </select>
                </div>

                <div className="p-4 rounded-lg border border-neutral-800 bg-neutral-900/50">
                  <label className="block text-sm font-medium text-neutral-300 mb-1">
                    Asking Model
                  </label>
                  <p className="text-xs text-neutral-500 mb-3">
                    The model that answers direct questions from you
                  </p>
                  <select
                    value={askModel}
                    onChange={(e) => setAskModel(e.target.value)}
                    disabled={modelsLoading}
                    className="w-full bg-neutral-950 border border-neutral-700 rounded-lg px-3 py-2 text-sm text-neutral-200 focus:outline-none focus:border-neutral-500"
                  >
                    {modelsLoading ? (
                      <option>Loading models...</option>
                    ) : (
                      availableModels.map((model) => (
                        <option key={model.id} value={model.id}>
                          {model.label}
                        </option>
                      ))
                    )}
                  </select>
                </div>

                <div className="p-4 rounded-lg border border-neutral-800 bg-neutral-900/50">
                  <label className="block text-sm font-medium text-neutral-300 mb-1">
                    Planner Model
                  </label>
                  <p className="text-xs text-neutral-500 mb-3">
                    The model that helps plan and organize your learning sessions
                  </p>
                  <select
                    value={plannerModel}
                    onChange={(e) => setPlannerModel(e.target.value)}
                    disabled={modelsLoading}
                    className="w-full bg-neutral-950 border border-neutral-700 rounded-lg px-3 py-2 text-sm text-neutral-200 focus:outline-none focus:border-neutral-500"
                  >
                    {modelsLoading ? (
                      <option>Loading models...</option>
                    ) : (
                      availableModels.map((model) => (
                        <option key={model.id} value={model.id}>
                          {model.label}
                        </option>
                      ))
                    )}
                  </select>
                </div>
              </div>

              <div className="mt-4 flex justify-end">
                <button
                  onClick={handleSaveModels}
                  disabled={modelSaving}
                  className="px-4 py-2 text-sm bg-white/10 hover:bg-white/15 disabled:opacity-50 rounded-lg transition-colors"
                >
                  {modelSaving ? "Saving..." : modelSaved ? "Saved!" : "Save Models"}
                </button>
              </div>
            </div>

            {/* Prompt Customization */}
            <div>
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-lg font-semibold">Prompt Modifications</h2>
                <div className="flex gap-2">
                  <button
                    onClick={handleResetAllPrompts}
                    className="px-3 py-1.5 text-xs text-neutral-500 hover:text-white border border-neutral-700 hover:border-neutral-600 rounded-lg transition-colors"
                  >
                    Reset all
                  </button>
                  <button
                    onClick={handleSavePrompts}
                    disabled={promptsSaving}
                    className="px-3.5 py-1.5 text-xs bg-white/10 hover:bg-white/15 disabled:opacity-50 text-white rounded-lg transition-colors"
                  >
                    {promptsSaving ? "Saving..." : promptsSaved ? "Saved!" : "Save changes"}
                  </button>
                </div>
              </div>

              <div className="space-y-4">
                {(Object.keys(DEFAULT_PROMPTS) as PromptKey[]).map((key) => {
                  const meta = PROMPT_META[key];
                  const isCustomized = key in userPrompts && userPrompts[key] !== undefined;
                  return (
                    <div
                      key={key}
                      className="rounded-xl border border-neutral-800 bg-neutral-900/50 p-4"
                    >
                      <div className="flex items-start justify-between mb-2.5">
                        <div>
                          <div className="flex items-center gap-2">
                            <h4 className="text-sm text-neutral-200 font-medium">{meta.label}</h4>
                            {isCustomized && (
                              <span className="px-1.5 py-0.5 text-[10px] rounded bg-blue-500/10 text-blue-400 border border-blue-500/20">
                                customized
                              </span>
                            )}
                          </div>
                          <p className="text-[11px] text-neutral-600 mt-0.5">{meta.description}</p>
                        </div>
                        {isCustomized && (
                          <button
                            onClick={() => handleResetPrompt(key)}
                            className="text-[11px] text-neutral-600 hover:text-white transition-colors whitespace-nowrap"
                          >
                            Reset
                          </button>
                        )}
                      </div>
                      <textarea
                        value={userPrompts[key] ?? DEFAULT_PROMPTS[key]}
                        onChange={(e) =>
                          setUserPrompts((prev) => ({
                            ...prev,
                            [key]: e.target.value === DEFAULT_PROMPTS[key] ? undefined : e.target.value,
                          }))
                        }
                        rows={8}
                        spellCheck={false}
                        className="w-full bg-[#0a0a0a] border border-neutral-800 rounded-lg p-3 text-xs text-neutral-300 font-mono leading-relaxed resize-y focus:outline-none focus:border-neutral-600 placeholder:text-neutral-700"
                      />
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
