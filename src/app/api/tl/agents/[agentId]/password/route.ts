import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createClient as createAdminClient } from "@supabase/supabase-js";

export const dynamic = "force-dynamic";

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ agentId: string }> }
) {
  try {
    const supabase = await createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { data: callerProfile } = await supabase
      .from("users")
      .select("organization_id")
      .eq("id", user.id)
      .single();
    const orgId = (callerProfile as { organization_id: string | null } | null)?.organization_id;
    if (!orgId) return NextResponse.json({ error: "No organization" }, { status: 400 });

    const { agentId } = await params;
    const body = await request.json() as { password: string };
    const password = body.password?.trim();

    if (!password || password.length < 8) {
      return NextResponse.json({ error: "Password must be at least 8 characters" }, { status: 400 });
    }

    // Ensure agent is in same org
    const { data: agentCheck } = await supabase
      .from("users")
      .select("id")
      .eq("id", agentId)
      .eq("organization_id", orgId)
      .single();
    if (!agentCheck) {
      return NextResponse.json({ error: "Agent not found" }, { status: 404 });
    }

    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
    if (!supabaseUrl || !serviceKey) {
      return NextResponse.json({ error: "Server misconfiguration" }, { status: 500 });
    }

    const adminClient = createAdminClient(supabaseUrl, serviceKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    });

    const { error: pwErr } = await adminClient.auth.admin.updateUserById(agentId, { password });
    if (pwErr) {
      return NextResponse.json({ error: pwErr.message }, { status: 500 });
    }

    return NextResponse.json({ success: true });
  } catch (err) {
    console.error("Agent password reset error:", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
