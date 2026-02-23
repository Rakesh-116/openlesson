import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import type { SupabaseClient } from "@supabase/supabase-js";
import {
  X402_PRICES,
  hashApiKey,
  verifyApiKey,
  getX402Price,
  getX402Description,
} from "@/lib/x402";
import { create402Response, checkX402Payment } from "@/lib/x402-server";

const OPENROUTER_API_URL = "https://openrouter.ai/api/v1/chat/completions";
const MODEL = "google/gemini-2.5-flash";

const DAYS_TO_NODES: Record<number, { min: number; max: number }> = {
  7: { min: 3, max: 5 },
  14: { min: 4, max: 7 },
  30: { min: 5, max: 10 },
  60: { min: 8, max: 14 },
  90: { min: 10, max: 18 },
  180: { min: 15, max: 25 },
};

const DEFAULT_DAYS = 30;

interface NodeData {
  id: string;
  title: string;
  description: string;
  is_start: boolean;
  next?: string[];
}

interface PlanData {
  nodes: NodeData[];
}

async function authenticateRequest(
  apiKey: string,
  supabase: SupabaseClient
) {
  const keyHash = await hashApiKey(apiKey);

  const { data: keyData, error } = await supabase
    .from("agent_api_keys")
    .select("id, user_id, is_active, rate_limit, last_used_at")
    .eq("key_hash", keyHash)
    .eq("is_active", true)
    .single();

  if (error || !keyData) {
    return null;
  }

  await supabase
    .from("agent_api_keys")
    .update({ last_used_at: new Date().toISOString() })
    .eq("id", keyData.id);

  return keyData;
}

export async function POST(req: NextRequest) {
  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      return NextResponse.json(
        { error: "Missing or invalid Authorization header" },
        { status: 401 }
      );
    }

    const apiKey = authHeader.substring(7);
    const supabase = await createClient();

    const auth = await authenticateRequest(apiKey, supabase as SupabaseClient);
    if (!auth) {
      return NextResponse.json(
        { error: "Invalid or inactive API key" },
        { status: 401 }
      );
    }

    const body = await req.json();
    const { topic, days } = body;

    if (!topic || typeof topic !== "string") {
      return NextResponse.json(
        { error: "Topic is required" },
        { status: 400 }
      );
    }

    const planGenerationPrice = getX402Price("plan_generation");
    const sessionPrice = getX402Price("session_start");

    const daysNum = typeof days === "number" ? days : DEFAULT_DAYS;
    const nodeConstraints = DAYS_TO_NODES[daysNum] || DAYS_TO_NODES[DEFAULT_DAYS];

    const payment = checkX402Payment(req.headers);
    if (!payment.valid) {
      const response = create402Response("plan_generation");
      if (response) {
        return response;
      }
    }

    const prompt = `Generate a learning plan for "${topic}" as a directed graph where each node is a session.

Return ONLY valid JSON (no markdown) with this structure:
{
  "nodes": [
    { "id": "a", "title": "Node Title", "description": "Why this matters", "is_start": true/false, "next": ["b", "c"] }
  ]
}

IMPORTANT CONSTRAINT: The plan should span approximately "${daysNum} days".
- Include ${nodeConstraints.min} to ${nodeConstraints.max} nodes total
- Each node represents one learning session
- Create a realistic learning path that fits within this timeframe

Rules:
- Each node is a distinct learning session
- Use single-letter or short IDs for referencing
- is_start: true for nodes that can begin a learning path
- next: array of node IDs that follow this node (can be empty or have 1-3 entries)
- Create branching paths (1 to many connections allowed)
- Keep titles concise (3-8 words)
- Descriptions: 1 sentence explaining the concept`;

    const apiKey2 = process.env.OPENROUTER_API_KEY;

    if (!apiKey2) {
      return NextResponse.json(
        { error: "AI service not configured" },
        { status: 500 }
      );
    }

    const aiResponse = await fetch(OPENROUTER_API_URL, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey2}`,
        "Content-Type": "application/json",
        "HTTP-Referer": process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000",
        "X-Title": "Socrates",
      },
      body: JSON.stringify({
        model: MODEL,
        messages: [{ role: "user", content: prompt }],
        max_tokens: 2000,
        temperature: 0.7,
      }),
    });

    if (!aiResponse.ok) {
      const errorText = await aiResponse.text();
      console.error("OpenRouter error:", aiResponse.status, errorText);
      return NextResponse.json(
        { error: "Failed to generate plan" },
        { status: 500 }
      );
    }

    const aiData = await aiResponse.json();
    const content = aiData.choices?.[0]?.message?.content;

    if (!content) {
      return NextResponse.json(
        { error: "No response from AI" },
        { status: 500 }
      );
    }

    const jsonMatch = content.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      return NextResponse.json(
        { error: "Invalid AI response" },
        { status: 500 }
      );
    }

    const planData: PlanData = JSON.parse(jsonMatch[0]);

    if (!planData.nodes || !Array.isArray(planData.nodes)) {
      return NextResponse.json(
        { error: "Invalid plan data format" },
        { status: 500 }
      );
    }

    const { data: plan, error: planError } = await supabase
      .from("learning_plans")
      .insert({
        user_id: auth.user_id,
        title: `Learning ${topic}`,
        root_topic: topic,
        status: "active",
        is_agent_session: true,
        payment_status: "paid",
      })
      .select()
      .single();

    if (planError || !plan) {
      console.error("Failed to create plan:", planError);
      return NextResponse.json(
        { error: "Failed to create plan" },
        { status: 500 }
      );
    }

    const nodeIdMap = new Map<string, string>();
    const nodeRefs = planData.nodes;

    for (const nodeData of nodeRefs) {
      const { data: node, error: nodeError } = await supabase
        .from("plan_nodes")
        .insert({
          plan_id: plan.id,
          title: nodeData.title,
          description: nodeData.description || "",
          is_start: nodeData.is_start || false,
          next_node_ids: [],
          status: "available",
        })
        .select()
        .single();

      if (nodeError || !node) {
        console.error("Failed to create node:", nodeError);
        continue;
      }

      nodeIdMap.set(nodeData.id, node.id);
    }

    for (const nodeData of nodeRefs) {
      const currentNodeId = nodeIdMap.get(nodeData.id);
      if (!currentNodeId) continue;

      const nextIds: string[] = [];
      if (nodeData.next && Array.isArray(nodeData.next)) {
        for (const nextId of nodeData.next) {
          const targetId = nodeIdMap.get(nextId);
          if (targetId) {
            nextIds.push(targetId);
          }
        }
      }

      await supabase
        .from("plan_nodes")
        .update({ next_node_ids: nextIds })
        .eq("id", currentNodeId);
    }

    const { data: nodes } = await supabase
      .from("plan_nodes")
      .select("id, title, description, is_start, next_node_ids, status")
      .eq("plan_id", plan.id);

    const nodeCount = nodes?.length || 0;
    const expectedSessionCost = nodeCount * sessionPrice;
    const totalExpectedCost = planGenerationPrice + expectedSessionCost;

    return NextResponse.json({
      planId: plan.id,
      topic,
      days: daysNum,
      nodes: nodes || [],
      pricing: {
        planGeneration: planGenerationPrice,
        perSession: sessionPrice,
        estimatedSessions: nodeCount,
        estimatedSessionCost: expectedSessionCost,
        totalEstimatedCost: totalExpectedCost,
        currency: "usd",
      },
    });
  } catch (error) {
    console.error("Agent plan error:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Internal error" },
      { status: 500 }
    );
  }
}

export async function GET(req: NextRequest) {
  const planPrice = getX402Price("plan_generation");
  const sessionPrice = getX402Price("session_start");

  return NextResponse.json({
    endpoint: "plan_generation",
    description: getX402Description("plan_generation"),
    price: planPrice,
    currency: "usd",
    required_params: ["topic"],
    optional_params: ["days", "x402_payment_id"],
    days_options: Object.keys(DAYS_TO_NODES).map(Number),
    default_days: DEFAULT_DAYS,
    pricing: {
      planGeneration: planPrice,
      perSession: sessionPrice,
      note: "Total cost = plan generation + (estimated sessions × session price)",
    },
    audio_required: false,
    usage: "Generate a learning plan for a given topic. Returns a directed graph of learning sessions with estimated cost.",
  });
}
