import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { callOpenRouterJSON, userMessage, DEFAULT_MODEL } from "@/lib/openrouter-client";

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

const DAYS_TO_NODES: Record<number, { min: number; max: number }> = {
  7: { min: 3, max: 5 },
  14: { min: 4, max: 7 },
  30: { min: 5, max: 10 },
  60: { min: 8, max: 14 },
  90: { min: 10, max: 18 },
  180: { min: 15, max: 25 },
};

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

    const response = await callOpenRouterJSON<PlanData>(
      [userMessage(prompt)],
      {
        model: DEFAULT_MODEL,
        maxTokens: 2000,
        temperature: 0.3,
      }
    );

    if (!response.success || !response.data) {
      console.error("OpenRouter error:", response.error);
      return NextResponse.json({ error: "Failed to generate plan" }, { status: 500 });
    }

    const planData = response.data;

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
