"use client";

import { useCallback, useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { ArrowLeftOutlined, ReloadOutlined } from "@ant-design/icons";
import { Card, Select, Spin, Table, Tag, Typography, message, Input, Space, Button } from "antd";
import { useRoleGuard } from "@/hooks/useRoleGuard";

const { Title, Text } = Typography;

type Lead = {
  id: string;
  lead_id: string | null;
  name: string | null;
  first_name: string | null;
  last_name: string | null;
  company_name: string | null;
  email: string | null;
  phone: string | null;
  job_title: string | null;
  job_function: string | null;
  city: string | null;
  state: string | null;
  country: string | null;
  status: string | null;
  delivery_status: string | null;
  notes: string | null;
  created_at: string;
  updated_at: string | null;
};

type Campaign = {
  id: string;
  campaign_id: string | null;
  name: string;
  status: string;
  start_date: string | null;
  end_date: string | null;
};

const deliveryOptions = [
  { value: "not_delivered", label: "Not Delivered" },
  { value: "delivered_by_mis", label: "Delivered by MIS" },
];

const deliveryColor: Record<string, string> = {
  delivered_by_mis: "green",
  not_delivered: "default",
};

export default function DCCampaignDetailPage() {
  const params = useParams();
  const router = useRouter();
  const campaignId = params?.id as string | undefined;
  const { status } = useRoleGuard(["dc"]);

  const [campaign, setCampaign] = useState<Campaign | null>(null);
  const [leads, setLeads] = useState<Lead[]>([]);
  const [loading, setLoading] = useState(true);
  const [updatingId, setUpdatingId] = useState<string | null>(null);
  const [search, setSearch] = useState("");

  const fetchData = useCallback(async () => {
    if (!campaignId) return;
    setLoading(true);
    try {
      const res = await fetch(`/api/dc/campaigns/${campaignId}`, { credentials: "include" });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to load");
      setCampaign(data.campaign);
      setLeads(data.leads ?? []);
    } catch (err) {
      message.error(err instanceof Error ? err.message : "Failed to load");
      router.replace("/dc/campaigns");
    } finally {
      setLoading(false);
    }
  }, [campaignId, router]);

  useEffect(() => {
    if (status !== "authorized") return;
    if (!campaignId) { router.replace("/dc/campaigns"); return; }
    fetchData();
  }, [status, campaignId, fetchData, router]);

  const handleDeliveryChange = async (leadId: string, value: string) => {
    if (!campaignId) return;
    setUpdatingId(leadId);
    try {
      const res = await fetch(`/api/dc/campaigns/${campaignId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ lead_id: leadId, delivery_status: value }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to update");
      setLeads((prev) => prev.map((l) => l.id === leadId ? { ...l, delivery_status: value } : l));
      message.success("Delivery status updated");
    } catch (err) {
      message.error(err instanceof Error ? err.message : "Failed to update");
    } finally {
      setUpdatingId(null);
    }
  };

  if (status === "loading" || status === "redirecting") {
    return <div className="min-h-[60vh] flex items-center justify-center"><Spin size="large" /></div>;
  }

  const filtered = leads.filter((l) => {
    const q = search.trim().toLowerCase();
    if (!q) return true;
    return (
      (l.lead_id ?? "").toLowerCase().includes(q) ||
      (l.name ?? "").toLowerCase().includes(q) ||
      ([l.first_name, l.last_name].filter(Boolean).join(" ")).toLowerCase().includes(q) ||
      (l.company_name ?? "").toLowerCase().includes(q) ||
      (l.email ?? "").toLowerCase().includes(q) ||
      (l.phone ?? "").toLowerCase().includes(q)
    );
  });

  const statusColors: Record<string, string> = { new: "default", contacted: "processing", interested: "green", followup: "gold", qualified: "blue", closed_won: "blue", closed_lost: "red" };

  return (
    <div style={{ padding: "0 0 40px" }}>
      <div style={{ marginBottom: 20 }}>
        <Link href="/dc/campaigns" style={{ display: "inline-flex", alignItems: "center", gap: 6, fontSize: 14, color: "#1677ff", textDecoration: "none" }}>
          <ArrowLeftOutlined /> Back to Campaigns
        </Link>
      </div>

      {campaign && (
        <div style={{ marginBottom: 24 }}>
          <Title level={3} style={{ margin: 0 }}>{campaign.name}</Title>
          <Space size="small" style={{ marginTop: 6 }} wrap>
            <Tag color={campaign.status === "active" ? "green" : campaign.status === "completed" ? "blue" : "default"} style={{ textTransform: "capitalize" }}>{campaign.status}</Tag>
            {campaign.campaign_id && <Text type="secondary" style={{ fontSize: 13 }}>ID: {campaign.campaign_id}</Text>}
            {campaign.start_date && <Text type="secondary" style={{ fontSize: 13 }}>Start: {new Date(campaign.start_date).toLocaleDateString()}</Text>}
            {campaign.end_date && <Text type="secondary" style={{ fontSize: 13 }}>End: {new Date(campaign.end_date).toLocaleDateString()}</Text>}
          </Space>
        </div>
      )}

      <Card
        title={
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 12 }}>
            <span>Qualified Leads <Text type="secondary" style={{ fontSize: 13, fontWeight: 400 }}>({filtered.length}{filtered.length !== leads.length ? ` of ${leads.length}` : ""})</Text></span>
            <Space wrap>
              <Input.Search
                placeholder="Search leads..."
                allowClear
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                style={{ width: 260 }}
              />
              <Button icon={<ReloadOutlined />} onClick={fetchData} loading={loading}>Refresh</Button>
            </Space>
          </div>
        }
        styles={{ body: { padding: 0 } }}
        style={{ borderRadius: 8, border: "1px solid #f0f0f0", boxShadow: "0 1px 2px rgba(0,0,0,0.03)" }}
      >
        <Table
          size="middle"
          rowKey="id"
          dataSource={filtered}
          loading={loading}
          scroll={{ x: 1600 }}
          pagination={{ defaultPageSize: 15, showSizeChanger: true, showTotal: (t) => `${t} leads` }}
          locale={{ emptyText: "No qualified leads in this campaign." }}
          columns={[
            {
              title: "Lead ID", dataIndex: "lead_id", key: "lead_id", width: 110, fixed: "left" as const,
              render: (v: string | null) => <Text style={{ fontSize: 12, fontFamily: "monospace" }}>{v || "—"}</Text>,
            },
            {
              title: "Name", key: "name", width: 150, ellipsis: true,
              render: (_: unknown, r: Lead) => {
                const n = [r.first_name, r.last_name].filter(Boolean).join(" ") || r.name || "—";
                return <Text strong style={{ fontSize: 13 }}>{n}</Text>;
              },
            },
            {
              title: "Company", dataIndex: "company_name", key: "company_name", width: 150, ellipsis: true,
              render: (v: string | null) => <Text style={{ fontSize: 13 }}>{v || "—"}</Text>,
            },
            {
              title: "Email", dataIndex: "email", key: "email", width: 180, ellipsis: true,
              render: (v: string | null) => <Text style={{ fontSize: 13 }}>{v || "—"}</Text>,
            },
            {
              title: "Phone", dataIndex: "phone", key: "phone", width: 130,
              render: (v: string | null) => <Text style={{ fontSize: 13 }}>{v || "—"}</Text>,
            },
            {
              title: "Job Title", dataIndex: "job_title", key: "job_title", width: 140, ellipsis: true,
              render: (v: string | null) => <Text style={{ fontSize: 13 }}>{v || "—"}</Text>,
            },
            {
              title: "City", dataIndex: "city", key: "city", width: 100,
              render: (v: string | null) => <Text style={{ fontSize: 13 }}>{v || "—"}</Text>,
            },
            {
              title: "State", dataIndex: "state", key: "state", width: 100,
              render: (v: string | null) => <Text style={{ fontSize: 13 }}>{v || "—"}</Text>,
            },
            {
              title: "Country", dataIndex: "country", key: "country", width: 100,
              render: (v: string | null) => <Text style={{ fontSize: 13 }}>{v || "—"}</Text>,
            },
            {
              title: "Status", dataIndex: "status", key: "status", width: 110, align: "center" as const,
              render: (v: string | null) => v ? <Tag color={statusColors[v] ?? "default"} style={{ textTransform: "capitalize", margin: 0 }}>{v}</Tag> : <Text type="secondary">—</Text>,
            },
            {
              title: "Delivery Status", key: "delivery_status", width: 180, align: "center" as const,
              render: (_: unknown, r: Lead) => (
                <Select
                  size="small"
                  value={r.delivery_status ?? "not_delivered"}
                  options={deliveryOptions}
                  loading={updatingId === r.id}
                  disabled={updatingId === r.id}
                  onChange={(v) => handleDeliveryChange(r.id, v)}
                  style={{ width: 160 }}
                  popupMatchSelectWidth={false}
                />
              ),
            },
            {
              title: "Notes", dataIndex: "notes", key: "notes", width: 160, ellipsis: true,
              render: (v: string | null) => <Text style={{ fontSize: 13 }}>{v || "—"}</Text>,
            },
            {
              title: "Created", dataIndex: "created_at", key: "created_at", width: 110,
              render: (v: string) => <Text style={{ fontSize: 12 }}>{v ? new Date(v).toLocaleDateString() : "—"}</Text>,
            },
            {
              title: "Updated", dataIndex: "updated_at", key: "updated_at", width: 110,
              render: (v: string | null) => <Text style={{ fontSize: 12 }}>{v ? new Date(v).toLocaleDateString() : "—"}</Text>,
            },
          ]}
        />
      </Card>
    </div>
  );
}
