// ============================================
// OpenLesson Agentic API v2 - Single Plan Operations
// GET    /api/v2/agent/plans/:id  - Get plan details
// PATCH  /api/v2/agent/plans/:id  - Update plan
// DELETE /api/v2/agent/plans/:id  - Delete plan
// ============================================

import { NextRequest, NextResponse } from "next/server";
import { authenticateRequest, errorResponse } from "@/lib/agent-v2/auth";
import { createProof, serializeProof } from "@/lib/agent-v2/proofs";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface RouteContext {
  params: Promise<{ id: string }>;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

async function fetchPlanForUser(
  supabase: ReturnType<typeof Object.create>,
  planId: string,
  userId: string
) {
  const { data: plan, error } = await supabase
    .from("learning_plans")
    .select("*")
    .eq("id", planId)
    .eq("user_id", userId)
    .single();

  if (error || !plan) return null;
  return plan;
}

// ---------------------------------------------------------------------------
// GET /api/v2/agent/plans/:id - Get plan with nodes and statistics
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

    const plan = await fetchPlanForUser(supabase, planId, auth.user_id);
    if (!plan) {
      return errorResponse(404, "plan_not_found", "Plan not found");
    }

    // Fetch nodes
    const { data: nodes, error: nodesError } = await supabase
      .from("plan_nodes")
      .select("*")
      .eq("plan_id", planId)
      .order("created_at", { ascending: true });

    if (nodesError) {
      console.error("[plans:get] Failed to fetch nodes:", nodesError);
      return errorResponse(500, "internal_error", "Failed to fetch plan nodes");
    }

    const allNodes = nodes ?? [];

    // Compute statistics
    const totalNodes = allNodes.length;
    const completedNodes = allNodes.filter(
      (n: { status: string }) => n.status === "completed"
    ).length;
    const availableNodes = allNodes.filter(
      (n: { status: string }) => n.status === "available"
    ).length;
    const inProgressNodes = allNodes.filter(
      (n: { status: string }) => n.status === "in_progress"
    ).length;
    const progressPercent =
      totalNodes > 0 ? Math.round((completedNodes / totalNodes) * 100) : 0;

    return NextResponse.json({
      plan: {
        id: plan.id,
        user_id: plan.user_id,
        title: plan.title,
        root_topic: plan.root_topic,
        status: plan.status,
        source_type: plan.source_type,
        source_url: plan.source_url,
        source_summary: plan.source_summary,
        notes: plan.notes,
        cover_image_url: plan.cover_image_url,
        is_agent_session: plan.is_agent_session,
        created_at: plan.created_at,
        updated_at: plan.updated_at,
      },
      nodes: allNodes,
      statistics: {
        total_nodes: totalNodes,
        completed_nodes: completedNodes,
        available_nodes: availableNodes,
        in_progress_nodes: inProgressNodes,
        progress_percent: progressPercent,
      },
    });
  } catch (err) {
    console.error("[plans:get] Unexpected error:", err);
    return errorResponse(500, "internal_error", "Internal server error");
  }
}

// ---------------------------------------------------------------------------
// PATCH /api/v2/agent/plans/:id - Update plan metadata
// ---------------------------------------------------------------------------

export async function PATCH(req: NextRequest, context: RouteContext) {
  try {
    const result = await authenticateRequest(req, "plans:write");
    if (result instanceof NextResponse) return result;
    const { auth, supabase } = result;

    const { id: planId } = await context.params;
    if (!planId) {
      return errorResponse(400, "validation_error", "Plan ID is required");
    }

    const plan = await fetchPlanForUser(supabase, planId, auth.user_id);
    if (!plan) {
      return errorResponse(404, "plan_not_found", "Plan not found");
    }

    // Parse body
    let body: Record<string, unknown>;
    try {
      body = await req.json();
    } catch {
      return errorResponse(400, "validation_error", "Invalid JSON body");
    }

    // Build update fields (only allow specific fields)
    const allowedFields = ["title", "notes", "status"];
    const allowedStatuses = ["active", "paused", "completed", "archived"];
    const updates: Record<string, unknown> = {};
    const changes: Record<string, { from: unknown; to: unknown }> = {};

    for (const field of allowedFields) {
      if (field in body) {
        const value = body[field];

        if (field === "title") {
          if (typeof value !== "string" || value.trim().length === 0) {
            return errorResponse(
              400,
              "validation_error",
              "Field 'title' must be a non-empty string"
            );
          }
          updates.title = value.trim();
          if (plan.title !== updates.title) {
            changes.title = { from: plan.title, to: updates.title };
          }
        }

        if (field === "notes") {
          if (value !== null && typeof value !== "string") {
            return errorResponse(
              400,
              "validation_error",
              "Field 'notes' must be a string or null"
            );
          }
          updates.notes = typeof value === "string" ? value : null;
          if (plan.notes !== updates.notes) {
            changes.notes = { from: plan.notes, to: updates.notes };
          }
        }

        if (field === "status") {
          if (typeof value !== "string" || !allowedStatuses.includes(value)) {
            return errorResponse(
              400,
              "validation_error",
              `Field 'status' must be one of: ${allowedStatuses.join(", ")}`
            );
          }
          updates.status = value;
          if (plan.status !== updates.status) {
            changes.status = { from: plan.status, to: updates.status };
          }
        }
      }
    }

    if (Object.keys(updates).length === 0) {
      return errorResponse(
        400,
        "validation_error",
        "No valid fields to update. Allowed fields: title, notes, status"
      );
    }

    updates.updated_at = new Date().toISOString();

    const { data: updatedPlan, error: updateError } = await supabase
      .from("learning_plans")
      .update(updates)
      .eq("id", planId)
      .select()
      .single();

    if (updateError || !updatedPlan) {
      console.error("[plans:update] Update failed:", updateError);
      return errorResponse(500, "internal_error", "Failed to update plan");
    }

    // Generate proof if there were actual changes
    let proof = null;
    if (Object.keys(changes).length > 0) {
      proof = await createProof(supabase, {
        type: "plan_adapted",
        user_id: auth.user_id,
        plan_id: planId,
        event_data: {
          action: "metadata_update",
          changes,
        },
      });
    }

    return NextResponse.json({
      plan: {
        id: updatedPlan.id,
        user_id: updatedPlan.user_id,
        title: updatedPlan.title,
        root_topic: updatedPlan.root_topic,
        status: updatedPlan.status,
        source_type: updatedPlan.source_type,
        source_url: updatedPlan.source_url,
        source_summary: updatedPlan.source_summary,
        notes: updatedPlan.notes,
        cover_image_url: updatedPlan.cover_image_url,
        is_agent_session: updatedPlan.is_agent_session,
        created_at: updatedPlan.created_at,
        updated_at: updatedPlan.updated_at,
      },
      changes,
      proof: proof ? serializeProof(proof) : null,
    });
  } catch (err) {
    console.error("[plans:update] Unexpected error:", err);
    return errorResponse(500, "internal_error", "Internal server error");
  }
}

// ---------------------------------------------------------------------------
// DELETE /api/v2/agent/plans/:id - Delete plan, nodes, and unlink sessions
// ---------------------------------------------------------------------------

export async function DELETE(req: NextRequest, context: RouteContext) {
  try {
    const result = await authenticateRequest(req, "plans:write");
    if (result instanceof NextResponse) return result;
    const { auth, supabase } = result;

    const { id: planId } = await context.params;
    if (!planId) {
      return errorResponse(400, "validation_error", "Plan ID is required");
    }

    const plan = await fetchPlanForUser(supabase, planId, auth.user_id);
    if (!plan) {
      return errorResponse(404, "plan_not_found", "Plan not found");
    }

    // Count nodes before deletion for the response
    const { count: nodeCount } = await supabase
      .from("plan_nodes")
      .select("id", { count: "exact", head: true })
      .eq("plan_id", planId);

    // Delete all nodes belonging to this plan
    const { error: nodesDeleteError } = await supabase
      .from("plan_nodes")
      .delete()
      .eq("plan_id", planId);

    if (nodesDeleteError) {
      console.error("[plans:delete] Failed to delete nodes:", nodesDeleteError);
      return errorResponse(500, "internal_error", "Failed to delete plan nodes");
    }

    // Unlink sessions that reference this plan (set plan_id to null)
    const { error: sessionsUnlinkError } = await supabase
      .from("sessions")
      .update({ plan_id: null })
      .eq("plan_id", planId);

    if (sessionsUnlinkError) {
      // Log but don't fail - sessions table may not have plan_id column
      console.warn(
        "[plans:delete] Failed to unlink sessions (may not exist):",
        sessionsUnlinkError
      );
    }

    // Delete the plan itself
    const { error: planDeleteError } = await supabase
      .from("learning_plans")
      .delete()
      .eq("id", planId);

    if (planDeleteError) {
      console.error("[plans:delete] Failed to delete plan:", planDeleteError);
      return errorResponse(500, "internal_error", "Failed to delete plan");
    }

    return NextResponse.json({
      deleted: true,
      plan_id: planId,
      nodes_deleted: nodeCount ?? 0,
    });
  } catch (err) {
    console.error("[plans:delete] Unexpected error:", err);
    return errorResponse(500, "internal_error", "Internal server error");
  }
}
