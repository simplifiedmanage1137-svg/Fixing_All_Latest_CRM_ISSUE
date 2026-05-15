import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

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
    const body = await request.json() as { is_active: boolean };

    if (typeof body.is_active !== "boolean") {
      return NextResponse.json({ error: "is_active (boolean) is required" }, { status: 400 });
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

    const { error: updateErr } = await supabase
      .from("users")
      .update({ is_active: body.is_active } as never)
      .eq("id", agentId)
      .eq("organization_id", orgId);

    if (updateErr) {
      return NextResponse.json({ error: updateErr.message }, { status: 500 });
    }

    return NextResponse.json({ success: true, is_active: body.is_active });
  } catch (err) {
    console.error("Agent status update error:", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
