import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { callOpenRouterJSON, systemMessage, userMessage, DEFAULT_MODEL } from "@/lib/openrouter-client";

const SYSTEM_PROMPT = `You are an AI Learning Planner assistant. Your role is to help users understand and customize their learning plans.

 Guidelines:
  - Be conversational and helpful
  - Explain WHY the learning path is structured the way it is
  - When user requests changes, ALWAYS output the COMPLETE updated plan - include all sessions in order
  - Keep sessions focused and actionable
  - NEVER delete or modify completed sessions - keep them exactly as they are
  - For ordering: use "order" field (1, 2, 3...) to specify sequence

 Response format (JSON):
  {
    "explanation": "Your conversational response to the user",
    "planModified": true/false - true if you're proposing any changes to the plan,
    "questions": ["optional clarification question if needed"],
    "sessions": [
      { "id": "existing-id-if-not-new", "title": "Session Title", "description": "Description", "order": 1 }
    ]
  }

  IMPORTANT: 
  - ALWAYS include the "sessions" array with the FULL plan state after your proposed changes
  - For existing sessions you want to keep, include their id from the current plan
  - For new sessions, omit the id field or use a new identifier
  - Completed sessions must appear in the sessions array unchanged
  - The "order" field determines the sequence (1 = first session, 2 = second, etc.)
  - If no changes requested, just return current sessions unchanged`;

interface ChatResponse {
  explanation: string;
  planModified?: boolean;
  sessions?: Array<{ id?: string; title: string; description?: string; order?: number }>;
  questions?: string[];
}

export async function POST(req: NextRequest) {
  try {
    const supabase = await createClient();
    
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    
    if (authError || !user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { planId, userPrompt, conversationHistory, model: userModel } = await req.json();
    
    if (!planId || !userPrompt) {
      return NextResponse.json({ error: "Plan ID and prompt are required" }, { status: 400 });
    }

    const { data: plan, error: planError } = await supabase
      .from("learning_plans")
      .select("*")
      .eq("id", planId)
      .single();

    if (planError || !plan) {
      return NextResponse.json({ error: "Plan not found" }, { status: 404 });
    }

    if (plan.user_id !== user.id && !plan.is_public) {
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

    const model = userModel || DEFAULT_MODEL;

    // Build conversation history context
    let historyContext = "";
    if (conversationHistory && conversationHistory.length > 0) {
      historyContext = `\n\nCONVERSATION HISTORY (full):\n${conversationHistory.map((m: { role: string; content: string }) => 
        `${m.role === "user" ? "User" : "Assistant"}: ${m.content}`
      ).join("\n")}\n`;
    }

    const prompt = `Current Learning Plan: "${plan.root_topic}"

CURRENT SESSIONS (include the id for any session you want to keep/modify):
${nodes.map((n: { id: string; status: string; title: string; description?: string }, i: number) => `${n.id} | order:${i+1} | ${n.status === "completed" ? "✓ DONE" : "active"} | ${n.title}: ${n.description || "No description"}`).join("\n")}

CONVERSATION HISTORY:${historyContext}

Current User request: "${userPrompt}"

${plan.description ? `Plan context: ${plan.description}` : ""}

Respond with JSON containing your explanation and the complete updated sessions array.`;

    const aiResponse = await callOpenRouterJSON<ChatResponse>(
      [systemMessage(SYSTEM_PROMPT), userMessage(prompt)],
      {
        model,
        maxTokens: 16000,
        temperature: 0.3,
      }
    );

    if (!aiResponse.success || !aiResponse.data) {
      return NextResponse.json({ error: "Failed to get AI response" }, { status: 500 });
    }

    const response = {
      explanation: aiResponse.data.explanation || "I've updated your plan.",
      planModified: aiResponse.data.planModified ?? true,
      sessions: aiResponse.data.sessions || [],
      questions: aiResponse.data.questions || []
    };

    const llmSessions = response.sessions || [];
    const existingIds = new Set(nodes.map((n: { id: string }) => n.id));
    const completedNodes = nodes.filter((n: { status: string }) => n.status === "completed");
    const completedIds = new Set(completedNodes.map((n: { id: string }) => n.id));
    
    console.log("[Chat] LLM sessions:", llmSessions.length);
    console.log("[Chat] Existing nodes:", nodes.length);

    const idMap = new Map<string, string>();

    for (const session of llmSessions) {
      const cleanId = session.id?.replace(/[^a-zA-Z0-9-]/g, "");
      
      if (cleanId && existingIds.has(cleanId) && !completedIds.has(cleanId)) {
        await supabase
          .from("plan_nodes")
          .update({
            title: session.title,
            description: session.description || ""
          })
          .eq("id", cleanId);
        if (session.id) idMap.set(session.id, cleanId);
      } else if (cleanId && !completedIds.has(cleanId)) {
        const { data: newNode, error: insertError } = await supabase
          .from("plan_nodes")
          .insert({
            plan_id: planId,
            title: session.title,
            description: session.description || "",
            is_start: false,
            next_node_ids: [],
            status: "available",
          })
          .select()
          .single();
        
        if (!insertError && newNode && session.id) {
          idMap.set(session.id, newNode.id);
        }
      }
    }

    const llmIds = new Set(llmSessions.map(s => {
      const cleanId = s.id?.replace(/[^a-zA-Z0-9-]/g, "");
      return cleanId && existingIds.has(cleanId) ? cleanId : null;
    }).filter(Boolean));

    for (const node of nodes) {
      if (!completedIds.has(node.id) && !llmIds.has(node.id as string)) {
        await supabase.from("plan_nodes").delete().eq("id", node.id);
      }
    }

    const sortedSessions = [...llmSessions].sort((a, b) => (a.order || 999) - (b.order || 999));
    
    for (let i = 0; i < sortedSessions.length; i++) {
      const session = sortedSessions[i];
      const sessionId = session.id || "";
      const mappedId = idMap.get(sessionId) || (session.id ? idMap.get(session.id.replace(/[^a-zA-Z0-9-]/g, "")) : undefined);
      
      if (mappedId && existingIds.has(mappedId)) {
        const nextSession = sortedSessions[i + 1];
        const nextNodeId = nextSession?.id ? idMap.get(nextSession.id) : null;
        await supabase
          .from("plan_nodes")
          .update({
            next_node_ids: nextNodeId ? [nextNodeId] : [],
            is_start: i === 0
          })
          .eq("id", mappedId);
      }
    }

    const { data: updatedNodes } = await supabase
      .from("plan_nodes")
      .select("*")
      .eq("plan_id", planId);

    // Build a summary of the current plan structure
    const orderedAll = getOrderedSessions(updatedNodes || []);
    const currentPlanSummary = orderedAll.map((n: { title: string; status?: string }, i: number) => 
      `${i + 1}. ${n.title}${n.status === "completed" ? " ✓" : ""}`
    ).join("\n");

    return NextResponse.json({ 
      explanation: response.explanation || "Done!",
      currentPlan: currentPlanSummary,
      questions: response.questions || [],
      planModified: response.planModified ?? false,
      updatedNodes: updatedNodes || []
    });

  } catch (error) {
    console.error("Chat plan error:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Internal error" },
      { status: 500 }
    );
  }
}

interface PlanNode {
  id: string;
  title: string;
  status?: string;
  is_start?: boolean;
  next_node_ids?: string[];
}

function getOrderedSessions(nodes: PlanNode[]): PlanNode[] {
  if (nodes.length === 0) return [];
  
  const visited = new Set<string>();
  const ordered: typeof nodes = [];
  
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
