"use client";

import { useState } from "react";
import { createBrowserClient } from "@supabase/ssr";
import { Bot } from "lucide-react";
import { useI18n } from "@/lib/i18n";

const ENDPOINTS = [
  {
    name: "Generate Plan",
    method: "POST",
    path: "/api/agent/plan",
    description: "Generate a learning plan for a given topic",
    params: [
      { name: "topic", type: "string", required: true, example: "Machine Learning" },
      { name: "days", type: "number", required: false, example: "30" },
    ],
    daysOptions: [7, 14, 30, 60, 90, 180],
    response: {
      planId: "uuid",
      topic: "string",
      days: "number",
      nodes: "array",
    },
    curl: `curl -X POST https://openlesson.academy/api/agent/plan \\
  -H "Authorization: Bearer sk_YOUR_API_KEY" \\
  -H "Content-Type: application/json" \\
  -d '{"topic": "Machine Learning", "days": 30}'`,
  },
  {
    name: "Start Session",
    method: "POST",
    path: "/api/agent/session/start",
    description: "Start a new tutoring session",
    params: [
      { name: "problem", type: "string", required: true, example: "Explain how backpropagation works" },
      { name: "plan_node_id", type: "string", required: false, example: "uuid" },
    ],
    response: {
      sessionId: "uuid",
      problem: "string",
      status: "active",
    },
    curl: `curl -X POST https://openlesson.academy/api/agent/session/start \\
  -H "Authorization: Bearer sk_YOUR_API_KEY" \\
  -H "Content-Type: application/json" \\
  -d '{"problem": "Explain how backpropagation works", "plan_node_id": "uuid-from-plan"}'`,
  },
  {
    name: "Analyze Audio",
    method: "POST",
    path: "/api/agent/session/analyze",
    description: "Submit audio chunk for analysis (audio-only)",
    params: [
      { name: "session_id", type: "string", required: true, example: "uuid" },
      { name: "audio_base64", type: "string", required: true, example: "base64-encoded-audio" },
      { name: "audio_format", type: "string", required: true, example: "webm" },
    ],
    response: {
      sessionId: "uuid",
      gapScore: "number (0-1)",
      signals: "string[]",
      followUpQuestion: "string",
      requiresFollowUp: "boolean",
    },
    curl: `curl -X POST https://openlesson.academy/api/agent/session/analyze \\
  -H "Authorization: Bearer sk_YOUR_API_KEY" \\
  -H "Content-Type: application/json" \\
  -d '{"session_id": "uuid", "audio_base64": "BASE64_AUDIO", "audio_format": "webm"}'`,
  },
  {
    name: "End Session",
    method: "POST",
    path: "/api/agent/session/end",
    description: "End a session and generate a summary report",
    params: [
      { name: "session_id", type: "string", required: true, example: "uuid" },
    ],
    response: {
      success: "boolean",
      sessionId: "uuid",
      message: "string",
      chunkCount: "number",
      wordCount: "number",
    },
    curl: `curl -X POST https://openlesson.academy/api/agent/session/end \\
  -H "Authorization: Bearer sk_YOUR_API_KEY" \\
  -H "Content-Type: application/json" \\
  -d '{"session_id": "uuid"}'`,
  },
  {
    name: "Get Report",
    method: "GET",
    path: "/api/agent/session/summary?session_id=xxx",
    description: "Retrieve the summary report of a completed session",
    params: [
      { name: "session_id", type: "string", required: true, example: "uuid" },
    ],
    response: {
      ready: "boolean",
      sessionId: "uuid",
      report: "string (markdown)",
      createdAt: "timestamp",
      status: "string",
    },
    curl: `curl "https://openlesson.academy/api/agent/session/summary?session_id=uuid" \\
  -H "Authorization: Bearer sk_YOUR_API_KEY"`,
  },
];

const CURL_EXAMPLE = `# Agentic Mode - Complete Workflow Example
# This demonstrates how to use the openLesson Agent API

# Step 1: Generate a learning plan
# Use 'days' to specify plan duration (7, 14, 30, 60, 90, 180)
curl -X POST https://openlesson.academy/api/agent/plan \
  -H "Authorization: Bearer YOUR_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "topic": "Machine Learning Fundamentals",
    "days": 30
  }'

# Step 2: Start a session for a specific node
curl -X POST https://openlesson.academy/api/agent/session/start \\
  -H "Authorization: Bearer YOUR_API_KEY" \\
  -H "Content-Type: application/json" \\
  -d '{
    "problem": "Explain gradient descent",
    "plan_node_id": "node-uuid-from-plan"
  }'

# Step 3: Submit audio chunks for analysis (audio-only!)
curl -X POST https://openlesson.academy/api/agent/session/analyze \\
  -H "Authorization: Bearer YOUR_API_KEY" \\
  -H "Content-Type: application/json" \\
  -d '{
    "session_id": "session-uuid",
    "audio_base64": "$(base64 -w0 audio.webm)",
    "audio_format": "webm"
  }'

# Step 4: End session and generate report
curl -X POST https://openlesson.academy/api/agent/session/end \\
  -H "Authorization: Bearer YOUR_API_KEY" \\
  -H "Content-Type: application/json" \\
  -d '{"session_id": "session-uuid"}'

# Step 5: Get the session report
curl "https://openlesson.academy/api/agent/session/summary?session_id=session-uuid" \
  -H "Authorization: Bearer YOUR_API_KEY"`;

export function AgenticModeSelect() {
  const { t } = useI18n();
  const [copiedEndpoint, setCopiedEndpoint] = useState<string | null>(null);
  const [copiedCurl, setCopiedCurl] = useState(false);

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
      await navigator.clipboard.writeText(CURL_EXAMPLE);
      setCopiedCurl(true);
      setTimeout(() => setCopiedCurl(false), 2000);
    } catch {
      console.error("Failed to copy");
    }
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
        <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-lg bg-amber-500/10 border border-amber-500/30">
          <span className="text-xs font-medium text-amber-400">{t('agenticMode.experimental')}</span>
          <span className="text-xs text-amber-400/70">— {t('agenticMode.experimentalDesc')}</span>
        </div>
      </div>

      {/* Framework Integration Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
        {/* ElizaOS Card */}
        <a
          href="/skill-elizaos.md"
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
          <button
            type="button"
            className="mt-3 inline-flex items-center gap-1 text-xs text-purple-400 hover:text-purple-300"
            onClick={(e) => {
              e.stopPropagation();
              window.location.href = "/elizaos/open_lessons.zip";
            }}
          >
            {t('agenticMode.downloadPlugin')} ↓
          </button>
        </a>

        {/* OpenClaw Card */}
        <a
          href="/skill-openclaw.md"
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
          <span 
            className="mt-3 inline-flex items-center gap-1 text-xs text-blue-400 hover:text-blue-300 cursor-pointer"
            onClick={(e) => {
              e.stopPropagation();
              window.open('https://clawhub.ai/dncolomer/open-lesson', '_blank', 'noopener,noreferrer');
            }}
          >
            {t('agenticMode.viewOnClawHub')} →
          </span>
          <span 
            className="ml-3 inline-flex items-center gap-1 text-xs text-blue-400 hover:text-blue-300 cursor-pointer"
            onClick={(e) => {
              e.stopPropagation();
              const link = document.createElement('a');
              link.href = '/openclaw/open-lesson.zip';
              link.download = '';
              link.click();
            }}
          >
            {t('agenticMode.downloadPlugin')} ↓
          </span>
        </a>

        {/* Any Agent Card */}
        <a
          href="/skill.md"
          className="block p-6 bg-slate-900/50 border border-slate-800 rounded-xl hover:border-green-500/50 transition-all group"
        >
          <div className="aspect-square rounded-lg mb-4 flex items-center justify-center bg-slate-800/50">
            <Bot className="w-16 h-16 text-slate-600" strokeWidth={1.5} />
          </div>
          <h3 className="text-lg font-semibold text-white mb-2 group-hover:text-green-400 transition-colors">
            Any Agent
          </h3>
          <p className="text-sm text-slate-400">
            {t('agenticMode.anyAgentDescription')}
          </p>
        </a>
      </div>

      <div className="bg-slate-900/50 border border-slate-800 rounded-xl p-6 mb-8">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-semibold text-white">{t('agenticMode.apiEndpoints')}</h3>
        </div>

        <div className="space-y-6">
          {ENDPOINTS.map((endpoint, idx) => (
            <div key={idx} className="border border-slate-800 rounded-lg p-4">
              <div className="flex items-start justify-between mb-3">
                <div>
                  <div className="flex items-center gap-2">
                    <span className="px-2 py-0.5 text-xs font-mono bg-blue-500/20 text-blue-400 rounded">
                      {endpoint.method}
                    </span>
                    <span className="text-sm font-mono text-slate-300">
                      {endpoint.path}
                    </span>
                  </div>
                  <p className="text-sm text-slate-400 mt-1">{endpoint.description}</p>
                </div>
              </div>

              <div className="text-xs mb-3">
                <span className="text-slate-500">Parameters: </span>
                {endpoint.params.map((p, i) => (
                  <span key={i} className={p.required ? "text-white" : "text-slate-400"}>
                    {p.name}
                    {p.required ? "*" : ""}
                    {i < endpoint.params.length - 1 ? ", " : ""}
                  </span>
                ))}
              </div>

              <div className="bg-black/40 rounded-lg p-3 overflow-x-auto">
                <pre className="text-xs font-mono text-slate-300 whitespace-pre-wrap break-all">{endpoint.curl}</pre>
              </div>
              
              <button
                onClick={() => copyToClipboard(endpoint.curl, `curl-${idx}`)}
                className="mt-2 text-xs text-blue-400 hover:text-blue-300 flex items-center gap-1"
              >
                {copiedEndpoint === `curl-${idx}` ? t('agenticMode.copiedCurl') : t('agenticMode.copyCurl')}
              </button>
            </div>
          ))}
        </div>
      </div>

      <div className="bg-neutral-900/50 border border-neutral-800 rounded-xl p-6 mb-8">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-semibold text-white">{t('agenticMode.importantNotes')}</h3>
        </div>
        
        <ul className="space-y-3 text-sm text-neutral-400">
          <li className="flex items-start gap-2">
            <span className="text-yellow-400">•</span>
            <span>
              <span className="text-white font-medium">{t('agenticMode.audioOnly').split(':')[0]}:</span> {t('agenticMode.audioOnly').split(':').slice(1).join(':')}
            </span>
          </li>
          <li className="flex items-start gap-2">
            <span className="text-yellow-400">•</span>
            <span>
              <span className="text-white font-medium">{t('agenticMode.supportedFormats').split(':')[0]}:</span> {t('agenticMode.supportedFormats').split(':').slice(1).join(':')}
            </span>
          </li>
          <li className="flex items-start gap-2">
            <span className="text-yellow-400">•</span>
            <span>
              {t('agenticMode.daysParam')}
            </span>
          </li>
          <li className="flex items-start gap-2">
            <span className="text-yellow-400">•</span>
            <span>
              {t('agenticMode.authentication')} <code className="text-green-400">Bearer YOUR_KEY</code>
            </span>
          </li>
        </ul>
      </div>

      <div className="bg-neutral-900/50 border border-neutral-800 rounded-xl p-6">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-semibold text-white">{t('agenticMode.completeWorkflow')}</h3>
          <button
            onClick={copyCurl}
            className="px-3 py-1.5 text-xs bg-blue-600 hover:bg-blue-500 text-white rounded-lg transition-colors"
          >
            {copiedCurl ? "✓ Copied" : t('agenticMode.copyCurl')}
          </button>
        </div>
        
        <pre className="text-xs font-mono text-neutral-300 overflow-x-auto p-4 bg-black/30 rounded-lg">
          <code>{CURL_EXAMPLE}</code>
        </pre>
      </div>

      <div className="mt-8 flex flex-col sm:flex-row items-center justify-center gap-4 text-sm text-neutral-500">
        <a href="/skill.md" className="text-blue-400 hover:text-blue-300">
          {t('agenticMode.fullApiDocs')} →
        </a>
        <span className="hidden sm:inline">•</span>
        <a href="/dashboard" className="text-blue-400 hover:text-blue-300">
          {t('agenticMode.getApiKey')}
        </a>
      </div>
    </div>
  );
}
