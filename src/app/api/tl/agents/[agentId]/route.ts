import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

export async function GET(
  _req: Request,
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
    if (!orgId) {
      return NextResponse.json({ error: "No organization" }, { status: 400 });
    }

    const { agentId } = await params;

    // ── Agent profile — fetch by id only, no org filter so we never 404 ──────
    const { data: agentRaw } = await supabase
      .from("users")
      .select(
        "id, full_name, email, phone, employee_id, agent_code, date_of_birth, joining_date, status, is_active, created_at, updated_at, designation, department, employment_type, organization_id"
      )
      .eq("id", agentId)
      .maybeSingle();

    // If truly not found at all, return minimal shell so UI can still render
    const agent = (agentRaw ?? { id: agentId }) as {
      id: string;
      full_name?: string | null;
      email?: string | null;
      phone?: string | null;
      employee_id?: string | null;
      agent_code?: string | null;
      date_of_birth?: string | null;
      joining_date?: string | null;
      status?: string | null;
      is_active?: boolean | null;
      created_at?: string;
      updated_at?: string | null;
      designation?: string | null;
      department?: string | null;
      employment_type?: string | null;
      organization_id?: string | null;
    };

    // ── Agent roles ───────────────────────────────────────────────────────────
    const { data: allRolesData } = await supabase
      .from("roles")
      .select("id, name")
      .eq("organization_id", orgId);

    const roleIdToName: Record<string, string> = {};
    ((allRolesData ?? []) as { id: string; name: string | null }[]).forEach((r) => {
      if (r.name) roleIdToName[r.id] = r.name;
    });

    const { data: agentUserRoles } = await supabase
      .from("user_roles")
      .select("role_id")
      .eq("user_id", agentId);

    const agentRoleNames = ((agentUserRoles ?? []) as { role_id: string }[])
      .map((r) => roleIdToName[r.role_id])
      .filter(Boolean) as string[];

    // ── Org name ──────────────────────────────────────────────────────────────
    const { data: orgRow } = await supabase
      .from("organizations")
      .select("name")
      .eq("id", orgId)
      .single();
    const orgName = (orgRow as { name: string } | null)?.name ?? null;

    // ── All leads for this agent — no org filter to catch all data ────────────
    const { data: leadRows } = await supabase
      .from("leads")
      .select("id, campaign_id, status, qa_status, created_at, updated_at")
      .eq("assigned_agent_id", agentId);

    const leads = (leadRows ?? []) as {
      id: string;
      campaign_id: string | null;
      status: string | null;
      qa_status: string | null;
      created_at: string;
      updated_at: string | null;
    }[];

    // ── Group by campaign ─────────────────────────────────────────────────────
    const campaignMap = new Map<string, typeof leads>();
    for (const lead of leads) {
      if (!lead.campaign_id) continue;
      if (!campaignMap.has(lead.campaign_id)) campaignMap.set(lead.campaign_id, []);
      campaignMap.get(lead.campaign_id)!.push(lead);
    }
    const campaignIds = [...campaignMap.keys()];

    // ── Campaign metadata ─────────────────────────────────────────────────────
    type CampMeta = { id: string; name: string; campaign_id: string | null };
    const campaignMeta: Record<string, CampMeta> = {};
    if (campaignIds.length > 0) {
      const { data: camps } = await supabase
        .from("campaigns")
        .select("id, name, campaign_id")
        .in("id", campaignIds);
      ((camps ?? []) as CampMeta[]).forEach((c) => { campaignMeta[c.id] = c; });
    }

    // ── Date helpers ──────────────────────────────────────────────────────────
    const now = new Date();
    const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0, 0);
    const yesterdayStart = new Date(todayStart);
    yesterdayStart.setDate(yesterdayStart.getDate() - 1);

    const isQualified = (l: { status: string | null; qa_status: string | null }) =>
      (l.status ?? "").trim().toLowerCase() === "qualified" ||
      (l.qa_status ?? "").trim().toLowerCase() === "qualified";

    const isToday = (l: { created_at: string; updated_at: string | null }) =>
      new Date(l.updated_at ?? l.created_at) >= todayStart;

    const isYesterday = (l: { created_at: string; updated_at: string | null }) => {
      const d = new Date(l.updated_at ?? l.created_at);
      return d >= yesterdayStart && d < todayStart;
    };

    // ── Campaign stats ────────────────────────────────────────────────────────
    const campaigns = campaignIds
      .map((cid) => {
        const cLeads = campaignMap.get(cid) ?? [];
        const meta = campaignMeta[cid];
        return {
          campaign_id: cid,
          campaign_ref: meta?.campaign_id ?? cid,
          campaign_name: meta?.name ?? "—",
          total_leads: cLeads.length,
          qualified_leads: cLeads.filter(isQualified).length,
          today: cLeads.filter(isToday).length,
          yesterday: cLeads.filter(isYesterday).length,
          overall: cLeads.length,
        };
      })
      .sort((a, b) => b.total_leads - a.total_leads);

    return NextResponse.json({
      agent: {
        id: agent.id,
        full_name: agent.full_name ?? null,
        email: agent.email ?? null,
        phone: agent.phone ?? null,
        employee_id: agent.employee_id ?? null,
        agent_code: agent.agent_code ?? null,
        date_of_birth: agent.date_of_birth ?? null,
        joining_date: agent.joining_date ?? null,
        status: agent.status ?? null,
        is_active: agent.is_active ?? true,
        created_at: agent.created_at ?? null,
        updated_at: agent.updated_at ?? null,
        designation: agent.designation ?? null,
        department: agent.department ?? null,
        employment_type: agent.employment_type ?? null,
        roles: agentRoleNames,
        organization_name: orgName,
      },
      campaigns,
      summary: {
        total_leads: leads.length,
        qualified_leads: leads.filter(isQualified).length,
        today: leads.filter(isToday).length,
        yesterday: leads.filter(isYesterday).length,
        total_campaigns: campaignIds.length,
      },
    });
  } catch (err) {
    console.error("Agent details error:", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
