import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

const OPENROUTER_API_URL = "https://openrouter.ai/api/v1/chat/completions";
const MODEL = "google/gemini-2.5-flash";

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

export async function POST(req: NextRequest) {
  try {
    const supabase = await createClient();
    
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    
    if (authError || !user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { topic, days } = await req.json();
    
    if (!topic || typeof topic !== "string") {
      return NextResponse.json({ error: "Topic is required" }, { status: 400 });
    }

    const daysNum = typeof days === "number" ? days : 30;
    
    const DAYS_TO_NODES: Record<number, { min: number; max: number }> = {
      7: { min: 3, max: 5 },
      14: { min: 4, max: 7 },
      30: { min: 5, max: 10 },
      60: { min: 8, max: 14 },
      90: { min: 10, max: 18 },
      180: { min: 15, max: 25 },
    };
    
    const nodeConstraints = DAYS_TO_NODES[daysNum] || DAYS_TO_NODES[30];

    const prompt = `Generate a learning plan for "${topic}" as a directed graph where each node is a session.

Return ONLY valid JSON (no markdown) with this structure:
{
  "nodes": [
    { "id": "a", "title": "Node Title", "description": "Why this matters", "is_start": true/false, "next": ["b", "c"] }
  ]
}

IMPORTANT: The plan should span approximately "${daysNum} days".
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

    const apiKey = process.env.OPENROUTER_API_KEY;
    
    if (!apiKey) {
      return NextResponse.json({ error: "AI service not configured" }, { status: 500 });
    }

    const aiResponse = await fetch(OPENROUTER_API_URL, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
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
      return NextResponse.json({ error: "Failed to generate plan" }, { status: 500 });
    }

    const aiData = await aiResponse.json();
    const content = aiData.choices?.[0]?.message?.content;

    if (!content) {
      return NextResponse.json({ error: "No response from AI" }, { status: 500 });
    }

    const jsonMatch = content.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      return NextResponse.json({ error: "Invalid AI response" }, { status: 500 });
    }

    const planData: PlanData = JSON.parse(jsonMatch[0]);

    if (!planData.nodes || !Array.isArray(planData.nodes)) {
      return NextResponse.json({ error: "Invalid plan data format" }, { status: 500 });
    }

    // Create the learning plan
    const { data: plan, error: planError } = await supabase
      .from("learning_plans")
      .insert({
        user_id: user.id,
        title: `Learning ${topic}`,
        root_topic: topic,
        status: "active",
      })
      .select()
      .single();

    if (planError || !plan) {
      console.error("Failed to create plan:", planError);
      return NextResponse.json({ error: "Failed to create plan" }, { status: 500 });
    }

    // Create a map to track node IDs
    const nodeIdMap = new Map<string, string>();
    const nodeRefs = planData.nodes;

    // First pass: create all nodes
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

    // Second pass: update next_node_ids with actual UUIDs
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

    return NextResponse.json({ planId: plan.id });

  } catch (error) {
    console.error("Generate plan error:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Internal error" },
      { status: 500 }
    );
  }
}
