import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

const OPENROUTER_API_URL = "https://openrouter.ai/api/v1/chat/completions";

const SYSTEM_PROMPT = `You are an AI Learning Plan Descriptor. Your job is to explain a learning plan to users in a clear, helpful way.

 Guidelines:
 - Explain the overall structure and why topics are ordered that way
 - Mention prerequisites and how topics build on each other
 - Provide estimated time or difficulty context if relevant
 - Be encouraging and clear
 - If there are multiple paths, explain the main recommended path

 Response format (JSON):
 {
   "title": "Short descriptive title for this plan",
   "overview": "2-3 sentences explaining the plan structure and learning approach",
   "highlights": ["Key point 1", "Key point 2", "Key point 3"],
   "suggestions": "Optional: suggestions for how to approach this plan"
 }`;

export async function POST(req: NextRequest) {
  try {
    const supabase = await createClient();
    
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    
    if (authError || !user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { planId, model: userModel } = await req.json();
    
    if (!planId) {
      return NextResponse.json({ error: "Plan ID is required" }, { status: 400 });
    }

    const { data: plan, error: planError } = await supabase
      .from("learning_plans")
      .select("*")
      .eq("id", planId)
      .single();

    if (planError || !plan) {
      return NextResponse.json({ error: "Plan not found" }, { status: 404 });
    }

    if (plan.user_id !== user.id) {
      return NextResponse.json({ error: "Access denied" }, { status: 403 });
    }

    const { data: nodes, error: nodesError } = await supabase
      .from("plan_nodes")
      .select("*")
      .eq("plan_id", planId)
      .order("created_at", { ascending: true });

    if (nodesError || !nodes) {
      return NextResponse.json({ error: "Failed to fetch nodes" }, { status: 500 });
    }

    const completedNodes = nodes.filter((n: any) => n.status === "completed");
    const activeNodes = nodes.filter((n: any) => n.status !== "completed");
    
    const orderedActive = getOrderedSessions(activeNodes);
    const orderedCompleted = getOrderedSessions(completedNodes);

    const model = userModel || "google/gemini-2.5-flash";

    const prompt = `Generate a description for this learning plan.

Plan Topic: "${plan.root_topic}"

ACTIVE SESSIONS:
${orderedActive.map((n: any, i: number) => `${i + 1}. ${n.title}: ${n.description || "No description"}`).join("\n")}

COMPLETED SESSIONS:
${orderedCompleted.map((n: any) => `✓ ${n.title}`).join("\n")}

Total sessions: ${nodes.length} (${completedNodes.length} completed)

Respond with JSON only.`;

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
        model,
        messages: [
          { role: "system", content: SYSTEM_PROMPT },
          { role: "user", content: prompt }
        ],
        max_tokens: 1000,
        temperature: 0.7,
      }),
    });

    if (!aiResponse.ok) {
      return NextResponse.json({ error: "Failed to generate description" }, { status: 500 });
    }

    const aiData = await aiResponse.json();
    const content = aiData.choices?.[0]?.message?.content;

    if (!content) {
      return NextResponse.json({ error: "No response from AI" }, { status: 500 });
    }

    const jsonMatch = content.match(/\{[\s\S]*\}/);
    let description = "";
    
    if (jsonMatch) {
      try {
        const parsed = JSON.parse(jsonMatch[0]);
        description = `${parsed.overview || ""}\n\n${(parsed.highlights || []).map((h: string) => `• ${h}`).join("\n")}`;
        if (parsed.suggestions) {
          description += `\n\n💡 ${parsed.suggestions}`;
        }
      } catch {
        description = content;
      }
    } else {
      description = content;
    }

    await supabase
      .from("learning_plans")
      .update({ description: description })
      .eq("id", planId);

    return NextResponse.json({ 
      description,
      overview: description.split("\n\n")[0],
      highlights: description.match(/• .+/g)?.map(s => s.replace("• ", "")) || []
    });

  } catch (error) {
    console.error("Describe plan error:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Internal error" },
      { status: 500 }
    );
  }
}

function getOrderedSessions(nodes: any[]): any[] {
  if (nodes.length === 0) return [];
  
  const visited = new Set<string>();
  const ordered: any[] = [];
  
  const startNodes = nodes.filter(n => n.is_start);
  const queue = [...startNodes];
  
  while (queue.length > 0) {
    const node = queue.shift()!;
    if (visited.has(node.id)) continue;
    
    visited.add(node.id);
    ordered.push(node);
    
    const children = nodes.filter(n => 
      node.next_node_ids?.includes(n.id)
    );
    
    for (const child of children) {
      if (!visited.has(child.id)) {
        queue.push(child);
      }
    }
  }
  
  for (const node of nodes) {
    if (!visited.has(node.id)) {
      ordered.push(node);
    }
  }
  
  return ordered;
}