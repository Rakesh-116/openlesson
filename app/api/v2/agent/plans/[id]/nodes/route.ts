// ============================================
// OpenLesson Agentic API v2 - Plan Nodes
// GET /api/v2/agent/plans/:id/nodes - Get nodes with edges
// ============================================

import { NextRequest, NextResponse } from "next/server";
import { authenticateRequest, errorResponse } from "@/lib/agent-v2/auth";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface RouteContext {
  params: Promise<{ id: string }>;
}

interface PlanNode {
  id: string;
  plan_id: string;
  title: string;
  description: string | null;
  is_start: boolean;
  next_node_ids: string[];
  status: string;
  position_x: number | null;
  position_y: number | null;
  created_at: string;
}

interface Edge {
  source: string;
  target: string;
}

// ---------------------------------------------------------------------------
// GET /api/v2/agent/plans/:id/nodes
// ---------------------------------------------------------------------------

export async function GET(req: NextRequest, context: RouteContext) {
  try {
    const result = await authenticateRequest(req, "plans:read");
    if (result instanceof NextResponse) return result;
    const { auth, supabase } = result;

    const { id: planId } = await context.params;
    if (!planId) {
      return errorResponse(400, "validation_error", "Plan ID is required");
    }

    // Verify plan ownership
    const { data: plan, error: planError } = await supabase
      .from("learning_plans")
      .select("id")
      .eq("id", planId)
      .eq("user_id", auth.user_id)
      .single();

    if (planError || !plan) {
      return errorResponse(404, "plan_not_found", "Plan not found");
    }

    // Fetch all nodes
    const { data: nodes, error: nodesError } = await supabase
      .from("plan_nodes")
      .select("*")
      .eq("plan_id", planId)
      .order("created_at", { ascending: true });

    if (nodesError) {
      console.error("[plans:nodes] Failed to fetch nodes:", nodesError);
      return errorResponse(500, "internal_error", "Failed to fetch plan nodes");
    }

    const allNodes: PlanNode[] = nodes ?? [];

    // Derive edges from next_node_ids
    const edges: Edge[] = [];
    const nodeIdSet = new Set(allNodes.map((n) => n.id));

    for (const node of allNodes) {
      if (node.next_node_ids && Array.isArray(node.next_node_ids)) {
        for (const targetId of node.next_node_ids) {
          // Only include edges where target exists
          if (nodeIdSet.has(targetId)) {
            edges.push({
              source: node.id,
              target: targetId,
            });
          }
        }
      }
    }

    // Compute summary stats
    const startNodes = allNodes.filter((n) => n.is_start).map((n) => n.id);
    const leafNodes = allNodes
      .filter(
        (n) =>
          !n.next_node_ids ||
          n.next_node_ids.length === 0 ||
          n.next_node_ids.every((id) => !nodeIdSet.has(id))
      )
      .map((n) => n.id);

    return NextResponse.json({
      nodes: allNodes.map((n) => ({
        id: n.id,
        plan_id: n.plan_id,
        title: n.title,
        description: n.description,
        is_start: n.is_start,
        next_node_ids: n.next_node_ids ?? [],
        status: n.status,
        position_x: n.position_x,
        position_y: n.position_y,
        created_at: n.created_at,
      })),
      edges,
      graph_info: {
        total_nodes: allNodes.length,
        total_edges: edges.length,
        start_nodes: startNodes,
        leaf_nodes: leafNodes,
      },
    });
  } catch (err) {
    console.error("[plans:nodes] Unexpected error:", err);
    return errorResponse(500, "internal_error", "Internal server error");
  }
}
