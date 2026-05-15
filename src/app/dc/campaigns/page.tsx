"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Button, Card, Input, Select, Space, Spin, Table, Tag, Typography, message } from "antd";
import { ReloadOutlined } from "@ant-design/icons";
import { useRoleGuard } from "@/hooks/useRoleGuard";

type DCCampaign = {
  id: string;
  campaign_id: string | null;
  name: string;
  status: string;
  start_date: string | null;
  end_date: string | null;
  created_at: string;
  total_leads: number;
  qualified_leads: number;
  delivered_leads: number;
};

const statusColors: Record<string, string> = { draft: "default", active: "green", paused: "orange", completed: "blue" };

export default function DCCampaignsPage() {
  const router = useRouter();
  const { status } = useRoleGuard(["dc"]);
  const [campaigns, setCampaigns] = useState<DCCampaign[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<string | null>(null);

  const fetchCampaigns = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/dc/campaigns", { credentials: "include" });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to load");
      setCampaigns(data.campaigns ?? []);
    } catch {
      message.error("Failed to load campaigns");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (status !== "authorized") return;
    fetchCampaigns();
  }, [status, fetchCampaigns]);

  if (status === "loading" || status === "redirecting") {
    return <div className="min-h-[60vh] flex items-center justify-center"><Spin size="large" /></div>;
  }

  const filtered = campaigns.filter((c) => {
    const q = search.trim().toLowerCase();
    const matchSearch = !q || c.name.toLowerCase().includes(q) || (c.campaign_id ?? "").toLowerCase().includes(q);
    const matchStatus = !statusFilter || c.status === statusFilter;
    return matchSearch && matchStatus;
  });

  return (
    <div style={{ width: "100%", padding: "0 24px 32px" }}>
      <div style={{ marginBottom: 24 }}>
        <Typography.Title level={3} style={{ margin: 0, fontWeight: 600 }}>DC Campaigns</Typography.Title>
        <Typography.Text type="secondary" style={{ fontSize: 14, display: "block", marginTop: 4 }}>
          All campaigns for client DC. Click a campaign to view qualified leads.
        </Typography.Text>
      </div>

      <Space style={{ marginBottom: 16 }} wrap>
        <Input.Search
          placeholder="Search by name or campaign ID"
          allowClear
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          style={{ width: 320 }}
        />
        <Select
          placeholder="Filter by status"
          allowClear
          value={statusFilter}
          onChange={setStatusFilter}
          options={[
            { value: "draft", label: "Draft" },
            { value: "active", label: "Active" },
            { value: "paused", label: "Paused" },
            { value: "completed", label: "Completed" },
          ]}
          style={{ width: 160 }}
        />
        <Button icon={<ReloadOutlined />} onClick={fetchCampaigns} loading={loading}>Refresh</Button>
      </Space>

      <Card
        styles={{ body: { padding: 0 } }}
        style={{ borderRadius: 8, border: "1px solid #f0f0f0", boxShadow: "0 1px 2px rgba(0,0,0,0.03)" }}
      >
        <Table
          size="middle"
          rowKey="id"
          dataSource={filtered}
          loading={loading}
          pagination={{ defaultPageSize: 15, showSizeChanger: true, showTotal: (t) => `${t} campaigns` }}
          onRow={(r) => ({
            onClick: () => router.push(`/dc/campaigns/${r.id}`),
            style: { cursor: "pointer" },
            onMouseEnter: (e) => { e.currentTarget.style.backgroundColor = "#fafafa"; },
            onMouseLeave: (e) => { e.currentTarget.style.backgroundColor = ""; },
          })}
          columns={[
            {
              title: "Sr.", key: "sr", width: 60, align: "center" as const,
              render: (_: unknown, __: DCCampaign, i: number) => <Typography.Text type="secondary">{i + 1}</Typography.Text>,
            },
            {
              title: "Campaign Name", dataIndex: "name", key: "name", ellipsis: true,
              render: (v: string) => <Typography.Text strong style={{ fontSize: 14 }}>{v || "—"}</Typography.Text>,
            },
            {
              title: "Campaign ID", dataIndex: "campaign_id", key: "campaign_id", width: 140,
              render: (v: string | null) => <Typography.Text style={{ fontSize: 13 }}>{v || "—"}</Typography.Text>,
            },
            {
              title: "Status", dataIndex: "status", key: "status", width: 100, align: "center" as const,
              render: (v: string) => <Tag color={statusColors[v] ?? "default"} style={{ textTransform: "capitalize", margin: 0 }}>{v}</Tag>,
            },
            {
              title: "Total Leads", dataIndex: "total_leads", key: "total_leads", width: 110, align: "center" as const,
              render: (v: number) => <Typography.Text style={{ fontWeight: 600 }}>{v}</Typography.Text>,
            },
            {
              title: "Qualified Leads", dataIndex: "qualified_leads", key: "qualified_leads", width: 130, align: "center" as const,
              render: (v: number) => <Tag color="blue" style={{ fontWeight: 600 }}>{v}</Tag>,
            },
            {
              title: "Delivered", dataIndex: "delivered_leads", key: "delivered_leads", width: 110, align: "center" as const,
              render: (v: number) => <Tag color="green" style={{ fontWeight: 600 }}>{v}</Tag>,
            },
            {
              title: "Created", dataIndex: "created_at", key: "created_at", width: 120,
              render: (v: string) => <Typography.Text style={{ fontSize: 13 }}>{v ? new Date(v).toLocaleDateString() : "—"}</Typography.Text>,
            },
          ]}
          locale={{ emptyText: "No DC campaigns found." }}
        />
      </Card>
    </div>
  );
}
