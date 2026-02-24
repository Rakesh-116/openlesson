"use client";

import { useState } from "react";
import { createBrowserClient } from "@supabase/ssr";

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
  },
  {
    name: "Start Session",
    method: "POST",
    path: "/api/agent/session/start",
    description: "Start a new Socratic session",
    params: [
      { name: "problem", type: "string", required: true, example: "Explain how backpropagation works" },
      { name: "plan_node_id", type: "string", required: false, example: "uuid" },
    ],
    response: {
      sessionId: "uuid",
      problem: "string",
      status: "active",
    },
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
  },
];

const CURL_EXAMPLE = `# Agentic Mode - Complete Workflow Example
# This demonstrates how to use the openLesson Agent API

# Step 1: Generate a learning plan
# Use 'days' to specify plan duration (7, 14, 30, 60, 90, 180)
curl -X POST https://openlesson.academy/api/agent/plan \\
  -H "Authorization: Bearer YOUR_API_KEY" \\
  -H "Content-Type: application/json" \\
  -d '{
    "topic": "Machine Learning Fundamentals",
    "days": 30
  }'
# Returns 402 if payment required - see payment flow below

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

# === x402 Payment Flow ===
# If request returns 402, get payment requirements and pay:

# 1. Get payment requirements:
curl https://openlesson.academy/api/agent/payment-requirements

# 2. Server returns 402 with paymentRequirements:
# {"paymentRequirements": {"scheme": "exact", "network": "base-sepolia", ...}}

# 3. Use x402 client to create payment, then retry with header:
curl -X POST https://openlesson.academy/api/agent/plan \\
  -H "Authorization: Bearer YOUR_API_KEY" \\
  -H "x402-payment: <base64-encoded-payment>" \\
  -H "Content-Type: application/json" \\
  -d '{"topic": "Machine Learning"}'`;

export function AgenticModeSelect() {
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
          Agentic Mode
        </h2>
        <p className="text-neutral-500 max-w-lg mx-auto text-sm leading-relaxed">
          Let your own personal assistant teach you using our tools. Programmatic access to 
          openLesson for AI agents and autonomous apps.
        </p>
      </div>

      {/* Framework Integration Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
        {/* ElizaOS Card */}
        <a
          href="/skill-elizaos.md"
          className="block p-6 bg-neutral-900/50 border border-neutral-800 rounded-xl hover:border-purple-500/50 transition-all group"
        >
          <div className="aspect-square rounded-lg mb-4 flex items-center justify-center overflow-hidden bg-neutral-800/50">
            <img 
              src="https://avatars.githubusercontent.com/u/186240462?s=200&v=4" 
              alt="ElizaOS" 
              className="w-full h-full object-contain"
            />
          </div>
          <h3 className="text-lg font-semibold text-white mb-2 group-hover:text-purple-400 transition-colors">
            ElizaOS
          </h3>
          <p className="text-sm text-neutral-400">
            Turn your ElizaOS agent into an openLesson-powered personal tutor.
          </p>
        </a>

        {/* OpenClaw Card */}
        <a
          href="/skill-openclaw.md"
          className="block p-6 bg-neutral-900/50 border border-neutral-800 rounded-xl hover:border-blue-500/50 transition-all group"
        >
          <div className="aspect-square rounded-lg mb-4 flex items-center justify-center overflow-hidden bg-neutral-800/50">
            <img 
              src="https://avatars.githubusercontent.com/u/252820863?s=200&v=4" 
              alt="OpenClaw" 
              className="w-full h-full object-contain"
            />
          </div>
          <h3 className="text-lg font-semibold text-white mb-2 group-hover:text-blue-400 transition-colors">
            OpenClaw
          </h3>
          <p className="text-sm text-neutral-400">
            Turn your OpenClaw agent into an openLesson-powered personal tutor.
          </p>
        </a>

        {/* Any Agent Card */}
        <a
          href="/skill.md"
          className="block p-6 bg-neutral-900/50 border border-neutral-800 rounded-xl hover:border-green-500/50 transition-all group"
        >
          <div className="aspect-square rounded-lg mb-4 flex items-center justify-center bg-neutral-800/50">
            <svg className="w-16 h-16 text-neutral-600" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 18a6 6 0 100-12 6 6 0 000 12z" />
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 14a2 2 0 100-4 2 2 0 000 4z" />
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 2v2M12 20v2M2 12h2M20 12h2" />
              <path strokeLinecap="round" strokeLinejoin="round" d="M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M4.93 19.07l1.41-1.41M17.66 6.34l1.41-1.41" />
            </svg>
          </div>
          <h3 className="text-lg font-semibold text-white mb-2 group-hover:text-green-400 transition-colors">
            Any Agent
          </h3>
          <p className="text-sm text-neutral-400">
            Turn any AI agent into an openLesson-powered personal tutor.
          </p>
        </a>
      </div>

      <div className="bg-neutral-900/50 border border-neutral-800 rounded-xl p-6 mb-8">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-semibold text-white">API Endpoints</h3>
        </div>

        <div className="space-y-6">
          {ENDPOINTS.map((endpoint, idx) => (
            <div key={idx} className="border border-neutral-800 rounded-lg p-4">
              <div className="flex items-start justify-between mb-3">
                <div>
                  <div className="flex items-center gap-2">
                    <span className="px-2 py-0.5 text-xs font-mono bg-blue-500/20 text-blue-400 rounded">
                      {endpoint.method}
                    </span>
                    <span className="text-sm font-mono text-neutral-300">
                      {endpoint.path}
                    </span>
                  </div>
                  <p className="text-sm text-neutral-400 mt-1">{endpoint.description}</p>
                </div>
              </div>

              <div className="text-xs">
                <span className="text-neutral-500">Parameters: </span>
                {endpoint.params.map((p, i) => (
                  <span key={i} className={p.required ? "text-white" : "text-neutral-400"}>
                    {p.name}
                    {p.required ? "*" : ""}
                    {i < endpoint.params.length - 1 ? ", " : ""}
                  </span>
                ))}
              </div>

              <button
                onClick={() => copyToClipboard(endpoint.path, `endpoint-${idx}`)}
                className="mt-2 text-xs text-blue-400 hover:text-blue-300 flex items-center gap-1"
              >
                {copiedEndpoint === `endpoint-${idx}` ? "✓ Copied" : "Copy path"}
              </button>
            </div>
          ))}
        </div>
      </div>

      <div className="bg-neutral-900/50 border border-neutral-800 rounded-xl p-6 mb-8">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-semibold text-white">Important Notes</h3>
        </div>
        
        <ul className="space-y-3 text-sm text-neutral-400">
          <li className="flex items-start gap-2">
            <span className="text-yellow-400">•</span>
            <span>
              <span className="text-white font-medium">Audio-only:</span> The analyze endpoint accepts ONLY audio (base64 encoded). 
              Do not send text - the system will reject it.
            </span>
          </li>
          <li className="flex items-start gap-2">
            <span className="text-yellow-400">•</span>
            <span>
              <span className="text-white font-medium">Supported formats:</span> webm, mp4, ogg (Opus codec preferred)
            </span>
          </li>
          <li className="flex items-start gap-2">
            <span className="text-yellow-400">•</span>
            <span>
              <span className="text-white font-medium">Days:</span> Use numeric days (7, 14, 30, 60, 90, 180) to constrain plan size. 
              Default: 30 days.
            </span>
          </li>
          <li className="flex items-start gap-2">
            <span className="text-yellow-400">•</span>
            <span>
              <span className="text-white font-medium">Payment:</span> x402 protocol (USDC on Base). 
              Requests return 402 if not paid. Include <code className="text-green-400">x402-payment</code> header with payment.
            </span>
          </li>
          <li className="flex items-start gap-2">
            <span className="text-yellow-400">•</span>
            <span>
              <span className="text-white font-medium">Authentication:</span> Include your API key in the 
              Authorization header: <code className="text-green-400">Bearer YOUR_KEY</code>
            </span>
          </li>
        </ul>
      </div>

      <div className="bg-neutral-900/50 border border-neutral-800 rounded-xl p-6">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-semibold text-white">Complete Workflow Example</h3>
          <button
            onClick={copyCurl}
            className="px-3 py-1.5 text-xs bg-blue-600 hover:bg-blue-500 text-white rounded-lg transition-colors"
          >
            {copiedCurl ? "✓ Copied" : "Copy curl"}
          </button>
        </div>
        
        <pre className="text-xs font-mono text-neutral-300 overflow-x-auto p-4 bg-black/30 rounded-lg">
          <code>{CURL_EXAMPLE}</code>
        </pre>
      </div>

      <div className="mt-8 flex flex-col sm:flex-row items-center justify-center gap-4 text-sm text-neutral-500">
        <a href="/skill.md" className="text-blue-400 hover:text-blue-300">
          Full API Documentation →
        </a>
        <span className="hidden sm:inline">•</span>
        <a href="/dashboard" className="text-blue-400 hover:text-blue-300">
          Get API Key
        </a>
      </div>
    </div>
  );
}
