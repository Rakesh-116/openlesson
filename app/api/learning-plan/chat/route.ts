import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

const OPENROUTER_API_URL = "https://openrouter.ai/api/v1/chat/completions";

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

    const existingCompletedNodes = nodes.filter((n: any) => n.status === "completed");
    const activeNodes = nodes.filter((n: any) => n.status !== "completed");
    
    const orderedActive = getOrderedSessions(activeNodes);

    const model = userModel || "google/gemini-2.5-flash";

    // Build conversation history context - include ALL messages for full context
    let historyContext = "";
    if (conversationHistory && conversationHistory.length > 0) {
      historyContext = `\n\nCONVERSATION HISTORY (full):\n${conversationHistory.map((m: any) => 
        `${m.role === "user" ? "User" : "Assistant"}: ${m.content}`
      ).join("\n")}\n`;
    }

    const prompt = `Current Learning Plan: "${plan.root_topic}"

CURRENT SESSIONS (include the id for any session you want to keep/modify):
${nodes.map((n: any, i: number) => `${n.id} | order:${i+1} | ${n.status === "completed" ? "✓ DONE" : "active"} | ${n.title}: ${n.description || "No description"}`).join("\n")}

CONVERSATION HISTORY:${historyContext}

Current User request: "${userPrompt}"

${plan.description ? `Plan context: ${plan.description}` : ""}

Respond with JSON containing your explanation and the complete updated sessions array.`;

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
        max_tokens: 2000,
        temperature: 0.7,
      }),
    });

    if (!aiResponse.ok) {
      return NextResponse.json({ error: "Failed to get AI response" }, { status: 500 });
    }

    const aiData = await aiResponse.json();
    const content = aiData.choices?.[0]?.message?.content;

    if (!content) {
      return NextResponse.json({ error: "No response from AI" }, { status: 500 });
    }

    const jsonMatch = content.match(/\{[\s\S]*\}/);
    let response: {
      explanation: string;
      planModified?: boolean;
      sessions?: Array<{ id?: string; title: string; description?: string; order?: number }>;
      questions?: string[];
    } = { explanation: "I've updated your plan.", planModified: false, sessions: [], questions: [] };
    
    if (jsonMatch) {
      try {
        const parsed = JSON.parse(jsonMatch[0]);
        response = {
          explanation: parsed.explanation || "I've updated your plan.",
          planModified: parsed.planModified ?? true,
          sessions: parsed.sessions || [],
          questions: parsed.questions || []
        };
      } catch {
        response.explanation = content;
      }
    } else {
      response.explanation = content;
    }

    const llmSessions = response.sessions || [];
    const existingIds = new Set(nodes.map((n: any) => n.id));
    const completedNodes = nodes.filter((n: any) => n.status === "completed");
    const completedIds = new Set(completedNodes.map((n: any) => n.id));
    
    console.log("[Chat] LLM sessions:", llmSessions.length);
    console.log("[Chat] Existing nodes:", nodes.length);

    const idMap = new Map<string, string>();

    for (const session of llmSessions) {
      const cleanId = session.id?.replace(/[^a-zA-Z0-9-]/g, "");
      
      if (cleanId && existingIds.has(cleanId) && !completedIds.has(cleanId)) {
        const existingNode = nodes.find((n: any) => n.id === cleanId);
        await supabase
          .from("plan_nodes")
          .update({
            title: session.title,
            description: session.description || ""
          })
          .eq("id", cleanId);
        if (session.id) idMap.set(session.id, cleanId);
      } else if (!completedIds.has(cleanId)) {
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
      if (!completedIds.has(node.id) && !llmIds.has(node.id)) {
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
    const currentPlanSummary = orderedAll.map((n: any, i: number) => 
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

function calculateForceDirectedLayout(
  nodes: any[],
  edges: { from: string; to: string }[]
): Map<string, { x: number; y: number }> {
  const positions = new Map<string, { x: number; y: number }>();
  
  if (nodes.length === 0) return positions;
  
  const width = 800;
  const height = 600;
  const padding = 100;
  
  nodes.forEach((node, i) => {
    if (node.position_x && node.position_y) {
      positions.set(node.id, { x: node.position_x, y: node.position_y });
      return;
    }
    const angle = (2 * Math.PI * i) / nodes.length - Math.PI / 2;
    const radius = Math.min(width, height) / 3;
    positions.set(node.id, {
      x: width / 2 + Math.cos(angle) * radius,
      y: height / 2 + Math.sin(angle) * radius,
    });
  });
  
  const iterations = 30;
  const repulsion = 4000;
  const attraction = 0.08;
  const damping = 0.85;
  
  const velocities = new Map<string, { x: number; y: number }>();
  nodes.forEach((n) => velocities.set(n.id, { x: 0, y: 0 }));
  
  for (let iter = 0; iter < iterations; iter++) {
    const forces = new Map<string, { x: number; y: number }>();
    nodes.forEach((n) => forces.set(n.id, { x: 0, y: 0 }));
    
    for (let i = 0; i < nodes.length; i++) {
      for (let j = i + 1; j < nodes.length; j++) {
        const posA = positions.get(nodes[i].id)!;
        const posB = positions.get(nodes[j].id)!;
        
        const dx = posB.x - posA.x;
        const dy = posB.y - posA.y;
        const dist = Math.max(Math.sqrt(dx * dx + dy * dy), 1);
        
        const force = repulsion / (dist * dist);
        const fx = (dx / dist) * force;
        const fy = (dy / dist) * force;
        
        const fA = forces.get(nodes[i].id)!;
        const fB = forces.get(nodes[j].id)!;
        fA.x -= fx;
        fA.y -= fy;
        fB.x += fx;
        fB.y += fy;
      }
    }
    
    for (const edge of edges) {
      const posA = positions.get(edge.from);
      const posB = positions.get(edge.to);
      if (!posA || !posB) continue;
      
      const dx = posB.x - posA.x;
      const dy = posB.y - posA.y;
      const dist = Math.sqrt(dx * dx + dy * dy);
      
      const force = (dist - 120) * attraction;
      const fx = (dx / dist) * force;
      const fy = (dy / dist) * force;
      
      const fA = forces.get(edge.from)!;
      const fB = forces.get(edge.to)!;
      fA.x += fx;
      fA.y += fy;
      fB.x -= fx;
      fB.y -= fy;
    }
    
    for (const node of nodes) {
      const pos = positions.get(node.id)!;
      const vel = velocities.get(node.id)!;
      const force = forces.get(node.id)!;
      
      vel.x = (vel.x + force.x) * damping;
      vel.y = (vel.y + force.y) * damping;
      
      pos.x += vel.x;
      pos.y += vel.y;
      
      pos.x = Math.max(padding, Math.min(width - padding, pos.x));
      pos.y = Math.max(padding, Math.min(height - padding, pos.y));
    }
  }
  
  return positions;
}