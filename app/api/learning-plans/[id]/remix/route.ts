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

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: planId } = await params;
    const supabase = await createClient();

    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { remixPrompt, title } = await req.json();

    if (!remixPrompt || typeof remixPrompt !== "string") {
      return NextResponse.json(
        { error: "Remix prompt is required" },
        { status: 400 }
      );
    }

    if (!title || typeof title !== "string") {
      return NextResponse.json(
        { error: "Title is required" },
        { status: 400 }
      );
    }

    const { data: sourcePlan, error: planQueryError } = await supabase
      .from("learning_plans")
      .select("*, profiles:author_id(username)")
      .eq("id", planId)
      .single();

    if (planQueryError || !sourcePlan) {
      console.error("Source plan error:", planQueryError);
      return NextResponse.json({ error: "Source plan not found" }, { status: 404 });
    }

    if (!sourcePlan.is_public) {
      return NextResponse.json(
        { error: "Cannot remix a private plan" },
        { status: 403 }
      );
    }

    const { data: sourceNodes, error: nodesError } = await supabase
      .from("plan_nodes")
      .select("*")
      .eq("plan_id", planId);

    if (nodesError) {
      console.error("Nodes error:", nodesError);
      return NextResponse.json({ error: "Could not fetch source nodes" }, { status: 500 });
    }

    const authorUsername = sourcePlan.profiles?.username;

    const prompt = `You are adapting an existing learning plan for a new learner.

ORIGINAL PLAN TOPIC: "${sourcePlan.root_topic}"
${
  authorUsername
    ? `Originally created by: @${authorUsername}`
    : ""
}

CURRENT SESSIONS (preserve these IDs if you want to keep them):
${(sourceNodes || [])
  .map(
    (n: any, i: number) =>
      `${n.id} | ${n.is_start ? "START" : ""} | ${n.title}: ${n.description}`
  )
  .join("\n")}

USER'S REMIX REQUEST: "${remixPrompt}"

Adapt the learning plan according to the user's request. Consider:
- Adjust difficulty level based on their background
- Focus on specific areas they mentioned
- Adapt the pacing or structure as needed
- Keep the core learning path but modify as requested

IMPORTANT: You must preserve the learning goals and structure - the adaptations should make it MORE suitable for the user, not remove content.

Return ONLY valid JSON (no markdown) with this structure:
{
  "nodes": [
    { "id": "a", "title": "Session Title", "description": "Why this matters", "is_start": true/false, "next": ["b"] }
  ]
}

Rules:
- Use single-letter IDs (a, b, c...)
- is_start: true for at least one starting node
- next: array of IDs this node points to
- Keep titles concise (3-8 words)
- Descriptions: 1 sentence explaining the concept
- Include 3-10 nodes total`;

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
        max_tokens: 3000,
        temperature: 0.7,
      }),
    });

    if (!aiResponse.ok) {
      const errorText = await aiResponse.text();
      console.error("OpenRouter error:", aiResponse.status, errorText);
      return NextResponse.json({ error: "Failed to remix plan" }, { status: 500 });
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

    const { data: newPlan, error: planError } = await supabase
      .from("learning_plans")
      .insert({
        user_id: user.id,
        root_topic: title.trim(),
        title: title.trim(),
        status: "active",
        is_public: false,
        author_id: user.id,
        original_plan_id: planId,
      })
      .select()
      .single();

    if (planError) {
      console.error("Plan insert error:", planError);
      throw new Error(`Could not create new plan: ${planError.message}`);
    }

    const nodeIdMap = new Map<string, string>();
    const newNodes = planData.nodes.map((node: NodeData) => {
      const newId = crypto.randomUUID();
      nodeIdMap.set(node.id, newId);
      return {
        plan_id: newPlan.id,
        title: node.title,
        description: node.description,
        is_start: node.is_start || false,
        next_node_ids: (node.next || []).map((id: string) => nodeIdMap.get(id) || id),
        status: "not_started",
      };
    });

    const { error: insertError } = await supabase
      .from("plan_nodes")
      .insert(newNodes);

    if (insertError) {
      console.error("Nodes insert error:", insertError);
      // Rollback: delete the plan we just created
      await supabase.from("learning_plans").delete().eq("id", newPlan.id);
      throw new Error(`Could not create nodes: ${insertError.message}`);
    }

    if (insertError) {
      await supabase.from("learning_plans").delete().eq("id", newPlan.id);
      throw new Error("Could not create nodes");
    }

    await supabase
      .from("learning_plans")
      .update({ remix_count: (sourcePlan.remix_count || 0) + 1 })
      .eq("id", planId);

    return NextResponse.json({
      success: true,
      planId: newPlan.id,
      message: `Plan remixed with ${newNodes.length} adapted sessions!`,
    });
  } catch (error) {
    console.error("Error remixing plan:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to remix plan" },
      { status: 500 }
    );
  }
}
