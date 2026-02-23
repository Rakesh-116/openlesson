import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

const OPENROUTER_API_URL = "https://openrouter.ai/api/v1/chat/completions";
const MODEL = "google/gemini-2.5-flash";

export async function POST(req: NextRequest) {
  try {
    const supabase = await createClient();
    
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    
    if (authError || !user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { nodeId } = await req.json();
    
    if (!nodeId) {
      return NextResponse.json({ error: "Node ID is required" }, { status: 400 });
    }

    // Get the node to expand
    const { data: node, error: nodeError } = await supabase
      .from("plan_nodes")
      .select("*")
      .eq("id", nodeId)
      .single();

    if (nodeError || !node) {
      return NextResponse.json({ error: "Node not found" }, { status: 404 });
    }

    // Verify ownership
    const { data: plan } = await supabase
      .from("learning_plans")
      .select("user_id")
      .eq("id", node.plan_id)
      .single();

    if (!plan || plan.user_id !== user.id) {
      return NextResponse.json({ error: "Access denied" }, { status: 403 });
    }

    // Check if node is completed
    if (node.status !== "completed") {
      return NextResponse.json({ error: "Node must be completed first" }, { status: 400 });
    }

    const prompt = `Expand the topic "${node.title}" with 2-4 follow-up learning sessions as a directed graph.

Return ONLY valid JSON:
{
  "nodes": [
    { "id": "a", "title": "Session Title", "description": "Why this matters", "next": ["b"] }
  ]
}

Rules:
- 2-4 new nodes
- Each is a distinct learning session building on "${node.title}"
- Use simple IDs (a, b, c...) for referencing
- next: array of IDs this node points to (can create chains or branches)
- Keep titles concise (3-8 words)
- Descriptions: 1 sentence`;

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
        "X-Title": "openLesson",
      },
      body: JSON.stringify({
        model: MODEL,
        messages: [{ role: "user", content: prompt }],
        max_tokens: 1000,
        temperature: 0.7,
      }),
    });

    if (!aiResponse.ok) {
      return NextResponse.json({ error: "Failed to expand plan" }, { status: 500 });
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

    const planData = JSON.parse(jsonMatch[0]);
    const newNodes = planData.nodes || [];

    if (newNodes.length === 0) {
      return NextResponse.json({ error: "No nodes to expand" }, { status: 400 });
    }

    // Create new nodes first
    const nodeIdMap = new Map<string, string>();

    for (const nodeData of newNodes) {
      const { data: newNode, error: insertError } = await supabase
        .from("plan_nodes")
        .insert({
          plan_id: node.plan_id,
          title: nodeData.title,
          description: nodeData.description || "",
          is_start: false,
          next_node_ids: [],
          status: "available",
        })
        .select()
        .single();

      if (insertError || !newNode) {
        console.error("Failed to create node:", insertError);
        continue;
      }

      nodeIdMap.set(nodeData.id, newNode.id);
    }

    // Update next_node_ids with actual UUIDs
    for (const nodeData of newNodes) {
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

    // Connect the expanded node to the first new node
    const newNodeIds = Array.from(nodeIdMap.values());
    if (newNodeIds.length > 0) {
      const currentNextIds = node.next_node_ids || [];
      await supabase
        .from("plan_nodes")
        .update({ next_node_ids: [...currentNextIds, ...newNodeIds] })
        .eq("id", nodeId);
    }

    return NextResponse.json({ success: true, newCount: newNodeIds.length });

  } catch (error) {
    console.error("Expand plan error:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Internal error" },
      { status: 500 }
    );
  }
}
