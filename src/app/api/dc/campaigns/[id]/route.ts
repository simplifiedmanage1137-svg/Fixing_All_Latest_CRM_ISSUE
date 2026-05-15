import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getAdminClientSafe } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";

const DC_CLIENT_NAME = "DC";

async function verifyDC(
  supabase: Awaited<ReturnType<typeof createClient>>,
  userId: string,
  orgId: string
): Promise<boolean> {
  const { data: roles } = await supabase.from("roles").select("id, name").eq("organization_id", orgId);
  const dcRoles = ((roles ?? []) as { id: string; name: string | null }[]).filter(
    (r) => r.name?.toLowerCase() === "dc"
  );
  if (dcRoles.length === 0) return false;
  const { data: ur } = await supabase
    .from("user_roles").select("role_id").eq("user_id", userId)
    .in("role_id", dcRoles.map((r) => r.id));
  return (ur ?? []).length > 0;
}

async function isCampaignDC(
  admin: NonNullable<ReturnType<typeof getAdminClientSafe>>,
  campaignId: string,
  orgId: string
): Promise<boolean> {
  const { data: camp } = await admin
    .from("campaigns")
    .select("id, client_name, client_id")
    .eq("id", campaignId)
    .eq("organization_id", orgId)
    .maybeSingle();

  if (!camp) return false;
  const c = camp as { client_name: string | null; client_id: string | null };

  if ((c.client_name ?? "").trim().toLowerCase() === DC_CLIENT_NAME.toLowerCase()) return true;

  if (c.client_id) {
    const { data: client } = await admin
      .from("clients")
      .select("company_name")
      .eq("id", c.client_id)
      .maybeSingle();
    const name = (client as { company_name: string } | null)?.company_name ?? "";
    if (name.trim().toLowerCase() === DC_CLIENT_NAME.toLowerCase()) return true;
  }

  return false;
}

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const supabase = await createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const { data: profile } = await supabase.from("users").select("organization_id").eq("id", user.id).single();
    const orgId = (profile as { organization_id: string | null } | null)?.organization_id;
    if (!orgId) return NextResponse.json({ error: "No organization" }, { status: 400 });

    const isDC = await verifyDC(supabase, user.id, orgId);
    if (!isDC) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

    const admin = getAdminClientSafe();
    if (!admin) return NextResponse.json({ error: "Server misconfiguration" }, { status: 500 });

    const { id: campaignId } = await params;

    const belongs = await isCampaignDC(admin, campaignId, orgId);
    if (!belongs) return NextResponse.json({ error: "Campaign not found or not accessible" }, { status: 404 });

    const { data: camp } = await admin
      .from("campaigns")
      .select("id, campaign_id, name, status, start_date, end_date, client_name")
      .eq("id", campaignId)
      .single();

    // Only qualified leads — no agent/creator fields
    const { data: leads } = await admin
      .from("leads")
      .select("id, lead_id, name, first_name, last_name, company_name, email, phone, job_title, city, state, country, status, qa_status, delivery_status, notes, created_at, updated_at")
      .eq("campaign_id", campaignId)
      .eq("organization_id", orgId)
      .or("status.ilike.qualified,qa_status.ilike.qualified")
      .order("created_at", { ascending: false });

    return NextResponse.json({ campaign: camp ?? null, leads: leads ?? [] });
  } catch (err) {
    console.error("DC campaign leads error:", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const supabase = await createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const { data: profile } = await supabase.from("users").select("organization_id").eq("id", user.id).single();
    const orgId = (profile as { organization_id: string | null } | null)?.organization_id;
    if (!orgId) return NextResponse.json({ error: "No organization" }, { status: 400 });

    const isDC = await verifyDC(supabase, user.id, orgId);
    if (!isDC) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

    const admin = getAdminClientSafe();
    if (!admin) return NextResponse.json({ error: "Server misconfiguration" }, { status: 500 });

    const { id: campaignId } = await params;

    const belongs = await isCampaignDC(admin, campaignId, orgId);
    if (!belongs) return NextResponse.json({ error: "Campaign not found or not accessible" }, { status: 404 });

    const body = await request.json() as { lead_id: string; delivery_status: string };
    if (!body.lead_id) return NextResponse.json({ error: "lead_id is required" }, { status: 400 });

    const allowed = ["not_delivered", "delivered_by_mis"];
    if (!allowed.includes(body.delivery_status)) {
      return NextResponse.json({ error: `delivery_status must be one of: ${allowed.join(", ")}` }, { status: 400 });
    }

    // Use admin client for update — DC user doesn't have leads UPDATE RLS
    const { error: updateErr } = await admin
      .from("leads")
      .update({ delivery_status: body.delivery_status } as never)
      .eq("id", body.lead_id)
      .eq("campaign_id", campaignId)
      .eq("organization_id", orgId);

    if (updateErr) return NextResponse.json({ error: updateErr.message }, { status: 500 });

    return NextResponse.json({ success: true });
  } catch (err) {
    console.error("DC delivery status update error:", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
