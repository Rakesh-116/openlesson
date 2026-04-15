"use client";

import { useState } from "react";
import { Shield, Zap, BookOpen, Brain, BarChart3 } from "lucide-react";
import { useI18n } from "@/lib/i18n";

const V2_ENDPOINT_GROUPS = [
  {
    group: "agenticMode.groupPlans",
    endpoints: [
      {
        name: "agenticMode.v2CreatePlan",
        method: "POST",
        path: "/api/v2/agent/plans",
        description: "agenticMode.v2CreatePlanDesc",
        params: [
          { name: "topic", type: "string", required: true, example: "Machine Learning" },
          { name: "duration_days", type: "number", required: false, example: "30" },
          { name: "difficulty", type: "string", required: false, example: "intermediate" },
        ],
        curl: `curl -X POST https://openlesson.academy/api/v2/agent/plans \\
  -H "Authorization: Bearer sk_YOUR_API_KEY" \\
  -H "Content-Type: application/json" \\
  -d '{"topic": "Machine Learning", "duration_days": 30}'`,
      },
      {
        name: "agenticMode.v2ListPlans",
        method: "GET",
        path: "/api/v2/agent/plans",
        description: "agenticMode.v2ListPlansDesc",
        params: [
          { name: "status", type: "string", required: false, example: "active" },
          { name: "limit", type: "number", required: false, example: "20" },
        ],
        curl: `curl "https://openlesson.academy/api/v2/agent/plans?status=active&limit=20" \\
  -H "Authorization: Bearer sk_YOUR_API_KEY"`,
      },
      {
        name: "agenticMode.v2AdaptPlan",
        method: "POST",
        path: "/api/v2/agent/plans/{id}/adapt",
        description: "agenticMode.v2AdaptPlanDesc",
        params: [
          { name: "instruction", type: "string", required: true, example: "Skip intro, focus on advanced topics" },
          { name: "preserve_completed", type: "boolean", required: false, example: "true" },
        ],
        curl: `curl -X POST https://openlesson.academy/api/v2/agent/plans/PLAN_ID/adapt \\
  -H "Authorization: Bearer sk_YOUR_API_KEY" \\
  -H "Content-Type: application/json" \\
  -d '{"instruction": "Skip intro, focus on advanced topics", "preserve_completed": true}'`,
      },
      {
        name: "agenticMode.v2FromVideo",
        method: "POST",
        path: "/api/v2/agent/plans/from-video",
        description: "agenticMode.v2FromVideoDesc",
        params: [
          { name: "youtube_url", type: "string", required: true, example: "https://youtube.com/watch?v=..." },
        ],
        curl: `curl -X POST https://openlesson.academy/api/v2/agent/plans/from-video \\
  -H "Authorization: Bearer sk_YOUR_API_KEY" \\
  -H "Content-Type: application/json" \\
  -d '{"youtube_url": "https://youtube.com/watch?v=dQw4w9WgXcQ"}'`,
      },
    ],
  },
  {
    group: "agenticMode.groupSessions",
    endpoints: [
      {
        name: "agenticMode.v2StartSession",
        method: "POST",
        path: "/api/v2/agent/sessions",
        description: "agenticMode.v2StartSessionDesc",
        params: [
          { name: "topic", type: "string", required: true, example: "Explain gradient descent" },
          { name: "plan_id", type: "string", required: false, example: "uuid" },
          { name: "plan_node_id", type: "string", required: false, example: "uuid" },
          { name: "tutoring_language", type: "string", required: false, example: "en" },
        ],
        curl: `curl -X POST https://openlesson.academy/api/v2/agent/sessions \\
  -H "Authorization: Bearer sk_YOUR_API_KEY" \\
  -H "Content-Type: application/json" \\
  -d '{"topic": "Explain gradient descent"}'`,
      },
      {
        name: "agenticMode.v2Analyze",
        method: "POST",
        path: "/api/v2/agent/sessions/{id}/analyze",
        description: "agenticMode.v2AnalyzeDesc",
        params: [
          { name: "inputs", type: "array", required: true, example: '[{"type": "audio", "data": "...", "format": "webm"}]' },
          { name: "context", type: "object", required: false, example: '{}' },
        ],
        curl: `curl -X POST https://openlesson.academy/api/v2/agent/sessions/SESSION_ID/analyze \\
  -H "Authorization: Bearer sk_YOUR_API_KEY" \\
  -H "Content-Type: application/json" \\
  -d '{"inputs": [{"type": "audio", "data": "BASE64", "format": "webm"}]}'`,
      },
      {
        name: "agenticMode.v2PauseResume",
        method: "POST",
        path: "/api/v2/agent/sessions/{id}/pause",
        description: "agenticMode.v2PauseResumeDesc",
        params: [
          { name: "reason", type: "string", required: false, example: "Taking a break" },
        ],
        curl: `curl -X POST https://openlesson.academy/api/v2/agent/sessions/SESSION_ID/pause \\
  -H "Authorization: Bearer sk_YOUR_API_KEY" \\
  -H "Content-Type: application/json" \\
  -d '{"reason": "Taking a break"}'`,
      },
      {
        name: "agenticMode.v2EndSession",
        method: "POST",
        path: "/api/v2/agent/sessions/{id}/end",
        description: "agenticMode.v2EndSessionDesc",
        params: [
          { name: "completion_status", type: "string", required: false, example: "completed" },
        ],
        curl: `curl -X POST https://openlesson.academy/api/v2/agent/sessions/SESSION_ID/end \\
  -H "Authorization: Bearer sk_YOUR_API_KEY" \\
  -H "Content-Type: application/json" \\
  -d '{"completion_status": "completed"}'`,
      },
    ],
  },
  {
    group: "agenticMode.groupAssistant",
    endpoints: [
      {
        name: "agenticMode.v2Ask",
        method: "POST",
        path: "/api/v2/agent/sessions/{id}/ask",
        description: "agenticMode.v2AskDesc",
        params: [
          { name: "question", type: "string", required: true, example: "Can you explain phase kickback?" },
          { name: "conversation_id", type: "string", required: false, example: "uuid" },
        ],
        curl: `curl -X POST https://openlesson.academy/api/v2/agent/sessions/SESSION_ID/ask \\
  -H "Authorization: Bearer sk_YOUR_API_KEY" \\
  -H "Content-Type: application/json" \\
  -d '{"question": "Can you explain phase kickback?"}'`,
      },
    ],
  },
  {
    group: "agenticMode.groupProofs",
    endpoints: [
      {
        name: "agenticMode.v2ListProofs",
        method: "GET",
        path: "/api/v2/agent/proofs",
        description: "agenticMode.v2ListProofsDesc",
        params: [
          { name: "session_id", type: "string", required: false, example: "uuid" },
          { name: "type", type: "string", required: false, example: "session_ended" },
        ],
        curl: `curl "https://openlesson.academy/api/v2/agent/proofs?session_id=SESSION_ID" \\
  -H "Authorization: Bearer sk_YOUR_API_KEY"`,
      },
      {
        name: "agenticMode.v2VerifyProof",
        method: "GET",
        path: "/api/v2/agent/proofs/{id}/verify",
        description: "agenticMode.v2VerifyProofDesc",
        params: [],
        curl: `curl "https://openlesson.academy/api/v2/agent/proofs/PROOF_ID/verify" \\
  -H "Authorization: Bearer sk_YOUR_API_KEY"`,
      },
    ],
  },
];

const V2_CURL_EXAMPLE = `# Agentic API v2 - Complete Workflow Example

# Step 1: Create a learning plan
curl -X POST https://openlesson.academy/api/v2/agent/plans \\
  -H "Authorization: Bearer YOUR_API_KEY" \\
  -H "Content-Type: application/json" \\
  -d '{
    "topic": "Quantum Computing Fundamentals",
    "duration_days": 30
  }'

# Step 2: Adapt the plan based on user needs
curl -X POST https://openlesson.academy/api/v2/agent/plans/PLAN_ID/adapt \\
  -H "Authorization: Bearer YOUR_API_KEY" \\
  -H "Content-Type: application/json" \\
  -d '{
    "instruction": "I already understand superposition, skip that",
    "preserve_completed": true
  }'

# Step 3: Start a session (can be standalone or linked to a plan)
curl -X POST https://openlesson.academy/api/v2/agent/sessions \\
  -H "Authorization: Bearer YOUR_API_KEY" \\
  -H "Content-Type: application/json" \\
  -d '{
    "topic": "Quantum Gates and Circuits",
    "plan_id": "PLAN_ID",
    "plan_node_id": "NODE_ID"
  }'

# Step 4: Submit analysis heartbeats (supports audio, text, or images)
curl -X POST https://openlesson.academy/api/v2/agent/sessions/SESSION_ID/analyze \\
  -H "Authorization: Bearer YOUR_API_KEY" \\
  -H "Content-Type: application/json" \\
  -d '{
    "inputs": [
      {"type": "audio", "data": "'$(base64 -w0 audio.webm)'", "format": "webm"}
    ]
  }'

# Step 5: Ask the teaching assistant for help
curl -X POST https://openlesson.academy/api/v2/agent/sessions/SESSION_ID/ask \\
  -H "Authorization: Bearer YOUR_API_KEY" \\
  -H "Content-Type: application/json" \\
  -d '{"question": "Can you explain phase kickback?"}'

# Step 6: End session and get report
curl -X POST https://openlesson.academy/api/v2/agent/sessions/SESSION_ID/end \\
  -H "Authorization: Bearer YOUR_API_KEY" \\
  -H "Content-Type: application/json" \\
  -d '{"completion_status": "completed"}'

# Step 7: Verify cryptographic proof
curl "https://openlesson.academy/api/v2/agent/proofs/PROOF_ID/verify" \\
  -H "Authorization: Bearer YOUR_API_KEY"`;

export function AgenticModeSelect() {
  const { t } = useI18n();
  const [copiedEndpoint, setCopiedEndpoint] = useState<string | null>(null);
  const [copiedCurl, setCopiedCurl] = useState(false);
  const [expandedGroup, setExpandedGroup] = useState<string | null>(null);

  const copyToClipboard = async (text: string, id: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopiedEndpoint(id);
      setTimeout(() => setCopiedEndpoint(null), 2000);
    } catch {
      console.error("Failed to copy");
    }
  };

  const copyCurl = async () => {
    try {
      await navigator.clipboard.writeText(V2_CURL_EXAMPLE);
      setCopiedCurl(true);
      setTimeout(() => setCopiedCurl(false), 2000);
    } catch {
      console.error("Failed to copy");
    }
  };

  const groupIcons: Record<string, typeof Zap> = {
    "agenticMode.groupPlans": BookOpen,
    "agenticMode.groupSessions": Brain,
    "agenticMode.groupAssistant": Zap,
    "agenticMode.groupProofs": Shield,
  };

  return (
    <div className="w-full max-w-4xl">
      <div className="text-center mb-8">
        <h2 className="text-3xl sm:text-4xl font-bold text-white mb-4 tracking-tight">
          {t('agenticMode.title')}
        </h2>
        <p className="text-slate-500 max-w-lg mx-auto text-sm leading-relaxed mb-4">
          {t('agenticMode.subtitle')}
        </p>
        <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-lg bg-green-500/10 border border-green-500/30">
          <span className="text-xs font-medium text-green-400">{t('agenticMode.v2Badge')}</span>
          <span className="text-xs text-green-400/70">— {t('agenticMode.v2BadgeDesc')}</span>
        </div>
      </div>

      {/* Framework Integration Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
        {/* ElizaOS Card */}
        <a
          href="https://github.com/dncolomer/openlesson-elizaos"
          target="_blank"
          rel="noopener noreferrer"
          className="block p-6 bg-slate-900/50 border border-slate-800 rounded-xl hover:border-purple-500/50 transition-all group"
        >
          <div className="aspect-square rounded-lg mb-4 flex items-center justify-center overflow-hidden bg-slate-800/50">
            <img 
              src="https://avatars.githubusercontent.com/u/186240462?s=200&v=4" 
              alt="ElizaOS" 
              className="w-full h-full object-contain"
            />
          </div>
          <h3 className="text-lg font-semibold text-white mb-2 group-hover:text-purple-400 transition-colors">
            ElizaOS
          </h3>
          <p className="text-sm text-slate-400">
            {t('agenticMode.elizaDescription')}
          </p>
          <span className="mt-3 inline-flex items-center gap-1 text-xs text-purple-400">
            {t('agenticMode.viewOnGitHub')} →
          </span>
        </a>

        {/* OpenClaw Card */}
        <a
          href="https://github.com/dncolomer/openlesson-openclaw"
          target="_blank"
          rel="noopener noreferrer"
          className="block p-6 bg-slate-900/50 border border-slate-800 rounded-xl hover:border-blue-500/50 transition-all group"
        >
          <div className="aspect-square rounded-lg mb-4 flex items-center justify-center overflow-hidden bg-slate-800/50">
            <img 
              src="https://avatars.githubusercontent.com/u/252820863?s=200&v=4" 
              alt="OpenClaw" 
              className="w-full h-full object-contain"
            />
          </div>
          <h3 className="text-lg font-semibold text-white mb-2 group-hover:text-blue-400 transition-colors">
            OpenClaw
          </h3>
          <p className="text-sm text-slate-400">
            {t('agenticMode.openclawDescription')}
          </p>
          <span className="mt-3 inline-flex items-center gap-1 text-xs text-blue-400">
            {t('agenticMode.viewOnGitHub')} →
          </span>
        </a>

        {/* Hermes Card */}
        <a
          href="https://github.com/dncolomer/openlesson-hermes"
          target="_blank"
          rel="noopener noreferrer"
          className="block p-6 bg-slate-900/50 border border-slate-800 rounded-xl hover:border-emerald-500/50 transition-all group"
        >
          <div className="aspect-square rounded-lg mb-4 flex items-center justify-center overflow-hidden bg-slate-800/50">
            <img 
              src="https://pbs.twimg.com/profile_images/1816254738234761216/TX7TW-Mp_400x400.jpg" 
              alt="Hermes Agent" 
              className="w-full h-full object-contain"
            />
          </div>
          <h3 className="text-lg font-semibold text-white mb-2 group-hover:text-emerald-400 transition-colors">
            Hermes
          </h3>
          <p className="text-sm text-slate-400">
            {t('agenticMode.hermesDescription')}
          </p>
          <span className="mt-3 inline-flex items-center gap-1 text-xs text-emerald-400">
            {t('agenticMode.viewOnGitHub')} →
          </span>
        </a>
      </div>

      {/* V2 Feature Highlights */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-8">
        {[
          { icon: Brain, label: "agenticMode.v2FeatureMultimodal", desc: "agenticMode.v2FeatureMultimodalDesc" },
          { icon: Shield, label: "agenticMode.v2FeatureProofs", desc: "agenticMode.v2FeatureProofsDesc" },
          { icon: Zap, label: "agenticMode.v2FeatureAssistant", desc: "agenticMode.v2FeatureAssistantDesc" },
          { icon: BarChart3, label: "agenticMode.v2FeatureAnalytics", desc: "agenticMode.v2FeatureAnalyticsDesc" },
        ].map((feature, idx) => (
          <div key={idx} className="p-3 bg-slate-900/30 border border-slate-800/50 rounded-lg text-center">
            <feature.icon className="w-5 h-5 text-slate-400 mx-auto mb-2" />
            <p className="text-xs font-medium text-white">{t(feature.label)}</p>
            <p className="text-[10px] text-slate-500 mt-0.5">{t(feature.desc)}</p>
          </div>
        ))}
      </div>

      {/* V2 API Endpoints - Grouped */}
      <div className="bg-slate-900/50 border border-slate-800 rounded-xl p-6 mb-8">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-semibold text-white">{t('agenticMode.v2ApiEndpoints')}</h3>
          <span className="text-xs text-slate-500 font-mono">v2</span>
        </div>

        <div className="space-y-4">
          {V2_ENDPOINT_GROUPS.map((group, gIdx) => {
            const Icon = groupIcons[group.group] || Zap;
            const isExpanded = expandedGroup === group.group;
            return (
              <div key={gIdx} className="border border-slate-800 rounded-lg overflow-hidden">
                <button
                  onClick={() => setExpandedGroup(isExpanded ? null : group.group)}
                  className="w-full flex items-center gap-3 p-4 hover:bg-slate-800/30 transition-colors text-left"
                >
                  <Icon className="w-4 h-4 text-slate-400 shrink-0" />
                  <span className="text-sm font-medium text-white flex-1">{t(group.group)}</span>
                  <span className="text-xs text-slate-500">{group.endpoints.length} endpoints</span>
                  <span className={`text-slate-500 transition-transform ${isExpanded ? "rotate-180" : ""}`}>
                    &#9660;
                  </span>
                </button>

                {isExpanded && (
                  <div className="border-t border-slate-800 p-4 space-y-4">
                    {group.endpoints.map((endpoint, eIdx) => (
                      <div key={eIdx} className="border border-slate-700/50 rounded-lg p-3">
                        <div className="flex items-center gap-2 mb-2">
                          <span className={`px-2 py-0.5 text-xs font-mono rounded ${
                            endpoint.method === "POST" 
                              ? "bg-blue-500/20 text-blue-400" 
                              : "bg-green-500/20 text-green-400"
                          }`}>
                            {endpoint.method}
                          </span>
                          <span className="text-sm font-mono text-slate-300">{endpoint.path}</span>
                        </div>
                        <p className="text-xs text-slate-400 mb-2">{t(endpoint.description)}</p>
                        
                        <div className="text-xs mb-2">
                          <span className="text-slate-500">{t('agenticMode.parameters')} </span>
                          {endpoint.params.map((p, i) => (
                            <span key={i} className={p.required ? "text-white" : "text-slate-400"}>
                              {p.name}{p.required ? "*" : ""}
                              {i < endpoint.params.length - 1 ? ", " : ""}
                            </span>
                          ))}
                        </div>

                        <div className="bg-black/40 rounded-lg p-3 overflow-x-auto">
                          <pre className="text-xs font-mono text-slate-300 whitespace-pre-wrap break-all">{endpoint.curl}</pre>
                        </div>
                        <button
                          onClick={() => copyToClipboard(endpoint.curl, `curl-${gIdx}-${eIdx}`)}
                          className="mt-2 text-xs text-blue-400 hover:text-blue-300"
                        >
                          {copiedEndpoint === `curl-${gIdx}-${eIdx}` ? t('agenticMode.copiedCurl') : t('agenticMode.copyCurl')}
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* Important Notes */}
      <div className="bg-neutral-900/50 border border-neutral-800 rounded-xl p-6 mb-8">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-semibold text-white">{t('agenticMode.importantNotes')}</h3>
        </div>
        
        <ul className="space-y-3 text-sm text-neutral-400">
          <li className="flex items-start gap-2">
            <span className="text-green-400">•</span>
            <span>{t('agenticMode.v2NoteMultimodal')}</span>
          </li>
          <li className="flex items-start gap-2">
            <span className="text-green-400">•</span>
            <span>{t('agenticMode.v2NoteStandalone')}</span>
          </li>
          <li className="flex items-start gap-2">
            <span className="text-green-400">•</span>
            <span>{t('agenticMode.v2NoteProofs')}</span>
          </li>
          <li className="flex items-start gap-2">
            <span className="text-green-400">•</span>
            <span>{t('agenticMode.v2NoteScopes')}</span>
          </li>
          <li className="flex items-start gap-2">
            <span className="text-green-400">•</span>
            <span>
              {t('agenticMode.authentication')} <code className="text-green-400">Bearer YOUR_KEY</code>
            </span>
          </li>
        </ul>
      </div>

      {/* Complete Workflow */}
      <div className="bg-neutral-900/50 border border-neutral-800 rounded-xl p-6">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-semibold text-white">{t('agenticMode.completeWorkflow')}</h3>
          <button
            onClick={copyCurl}
            className="px-3 py-1.5 text-xs bg-blue-600 hover:bg-blue-500 text-white rounded-lg transition-colors"
          >
            {copiedCurl ? t('agenticMode.copiedCurl') : t('agenticMode.copyCurl')}
          </button>
        </div>
        
        <pre className="text-xs font-mono text-neutral-300 overflow-x-auto p-4 bg-black/30 rounded-lg">
          <code>{V2_CURL_EXAMPLE}</code>
        </pre>
      </div>

      <div className="mt-8 flex flex-col sm:flex-row items-center justify-center gap-4 text-sm text-neutral-500">
        <a href="/docs/AGENTIC_API_V2.md" className="text-blue-400 hover:text-blue-300">
          {t('agenticMode.v2FullDocs')} →
        </a>
        <span className="hidden sm:inline">•</span>
        <a href="/dashboard" className="text-blue-400 hover:text-blue-300">
          {t('agenticMode.getApiKey')}
        </a>
      </div>
    </div>
  );
}
