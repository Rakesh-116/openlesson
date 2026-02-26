import { NextResponse } from "next/server";
import { createClient as createSupabaseAdmin } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/server";

export const runtime = "nodejs";

function getAdminClient() {
  return createSupabaseAdmin(
    process.env.NEXT_PUBLIC_SUPABASE_URL || "",
    process.env.SUPABASE_SERVICE_ROLE_KEY || ""
  );
}

export async function GET() {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    
    if (!user) {
      return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
    }

    const { data: profile } = await supabase
      .from("profiles")
      .select("is_admin")
      .eq("id", user.id)
      .single();

    if (!profile?.is_admin) {
      return NextResponse.json({ error: "Admin access required" }, { status: 403 });
    }

    const adminClient = getAdminClient();

    const { data: users, error } = await adminClient
      .from("profiles")
      .select(`
        id,
        username,
        created_at,
        plan,
        is_admin,
        extra_lessons,
        subscription_status,
        current_period_end,
        token_tier,
        token_validity_expires_at,
        metadata
      `)
      .order("created_at", { ascending: false });

    if (error) {
      console.error("Error fetching users:", error);
      return NextResponse.json({ error: "Failed to fetch users" }, { status: 500 });
    }

    const userIds = (users || []).map(u => u.id);
    
    const [sessionsData, plansData] = await Promise.all([
      userIds.length > 0 
        ? adminClient.from("sessions").select("user_id").in("user_id", userIds)
        : { data: [] as { user_id: string }[] | null, error: null },
      userIds.length > 0 
        ? adminClient.from("learning_plans").select("user_id").in("user_id", userIds)
        : { data: [] as { user_id: string }[] | null, error: null },
    ]);

    const sessionsByUser: Record<string, number> = {};
    const plansByUser: Record<string, number> = {};
    
    (sessionsData.data || []).forEach(s => {
      sessionsByUser[s.user_id] = (sessionsByUser[s.user_id] || 0) + 1;
    });
    (plansData.data || []).forEach(p => {
      plansByUser[p.user_id] = (plansByUser[p.user_id] || 0) + 1;
    });

    const { data: authUsers } = await adminClient.auth.admin.listUsers();
    
    const enrichedUsers = (users || []).map(u => {
      const authUser = authUsers.users.find(a => a.id === u.id);
      return {
        ...u,
        email: authUser?.email || null,
        email_confirmed_at: authUser?.email_confirmed_at || null,
        lessons_count: sessionsByUser[u.id] || 0,
        plans_count: plansByUser[u.id] || 0,
      };
    });

    return NextResponse.json({ users: enrichedUsers });
  } catch (error) {
    console.error("Admin users error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

export async function PUT(request: Request) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    
    if (!user) {
      return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
    }

    const { data: profile } = await supabase
      .from("profiles")
      .select("is_admin")
      .eq("id", user.id)
      .single();

    if (!profile?.is_admin) {
      return NextResponse.json({ error: "Admin access required" }, { status: 403 });
    }

    const { userId, plan, subscription_status, extra_lessons, current_period_end, is_admin } = await request.json();

    if (!userId) {
      return NextResponse.json({ error: "User ID required" }, { status: 400 });
    }

    const updateData: Record<string, unknown> = {};
    
    if (plan !== undefined) updateData.plan = plan;
    if (subscription_status !== undefined) updateData.subscription_status = subscription_status;
    if (extra_lessons !== undefined) updateData.extra_lessons = extra_lessons;
    if (current_period_end !== undefined) updateData.current_period_end = current_period_end;
    if (is_admin !== undefined) updateData.is_admin = is_admin;

    const adminClient = getAdminClient();

    const { data, error } = await adminClient
      .from("profiles")
      .update(updateData)
      .eq("id", userId)
      .select()
      .single();

    if (error) {
      console.error("Error updating user:", error);
      return NextResponse.json({ error: "Failed to update user" }, { status: 500 });
    }

    return NextResponse.json({ user: data });
  } catch (error) {
    console.error("Admin update error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
