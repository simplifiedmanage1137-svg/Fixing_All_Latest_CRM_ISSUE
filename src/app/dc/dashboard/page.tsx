"use client";

import { useEffect, useState } from "react";
import { Card, Col, Row, Spin, Typography } from "antd";
import {
  FundProjectionScreenOutlined,
  TeamOutlined,
  CheckCircleOutlined,
  RiseOutlined,
  ArrowUpOutlined,
} from "@ant-design/icons";
import { useRoleGuard } from "@/hooks/useRoleGuard";
import DashboardGreeting from "@/components/Dashboard/DashboardGreeting";

const { Text } = Typography;

const cardStyle = {
  borderRadius: 16,
  boxShadow: "0 2px 8px rgba(0,0,0,0.04)",
  border: "1px solid #f0f0f0",
  transition: "all 0.3s ease",
  cursor: "pointer" as const,
};

interface Stats {
  totalCampaigns: number;
  totalLeads: number;
  qualifiedLeads: number;
  deliveredLeads: number;
  deliveredToday: number;
}

export default function DCDashboardPage() {
  const { status } = useRoleGuard(["dc"]);
  const [stats, setStats] = useState<Stats | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (status !== "authorized") return;
    fetch("/api/dc/dashboard", { credentials: "include" })
      .then((r) => r.json())
      .then((d) => {
        console.log("[DC Dashboard debug]", d._debug);
        setStats(d);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [status]);

  if (status !== "authorized") return null;

  const statCards = [
    { title: "Total Campaigns", value: stats?.totalCampaigns ?? 0, icon: <FundProjectionScreenOutlined />, color: "#1677ff", bgColor: "#e6f4ff", change: "Client DC campaigns" },
    { title: "Total Leads", value: stats?.totalLeads ?? 0, icon: <TeamOutlined />, color: "#722ed1", bgColor: "#f9f0ff", change: "Across all DC campaigns" },
    { title: "Qualified Leads", value: stats?.qualifiedLeads ?? 0, icon: <CheckCircleOutlined />, color: "#52c41a", bgColor: "#f6ffed", change: "Status = qualified" },
    { title: "Delivered Leads", value: stats?.deliveredLeads ?? 0, icon: <RiseOutlined />, color: "#13c2c2", bgColor: "#e6fffb", change: "Delivered by MIS" },
    { title: "Delivered Today", value: stats?.deliveredToday ?? 0, icon: <RiseOutlined />, color: "#fa8c16", bgColor: "#fff7e6", change: "Updated today" },
  ];

  return (
    <div style={{ padding: "0 4px", maxWidth: 1600, margin: "0 auto" }}>
      <DashboardGreeting />

      {loading ? (
        <div style={{ textAlign: "center", padding: 48 }}><Spin size="large" /></div>
      ) : (
        <Row gutter={[20, 20]} style={{ marginBottom: 24 }}>
          {statCards.map((stat, i) => (
            <Col xs={24} sm={12} xl={6} key={i}>
              <Card
                bordered={false}
                style={{ ...cardStyle, height: "100%" }}
                styles={{ body: { padding: "24px" } }}
                onMouseEnter={(e) => { e.currentTarget.style.boxShadow = "0 4px 16px rgba(0,0,0,0.08)"; e.currentTarget.style.transform = "translateY(-2px)"; }}
                onMouseLeave={(e) => { e.currentTarget.style.boxShadow = "0 2px 8px rgba(0,0,0,0.04)"; e.currentTarget.style.transform = "translateY(0)"; }}
              >
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
                  <div style={{ flex: 1 }}>
                    <Text type="secondary" style={{ fontSize: 13, display: "block", marginBottom: 8 }}>{stat.title}</Text>
                    <div style={{ fontSize: 32, fontWeight: 700, color: "#1f1f1f", lineHeight: 1, marginBottom: 12 }}>{stat.value}</div>
                    <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
                      <ArrowUpOutlined style={{ color: "#52c41a", fontSize: 12 }} />
                      <Text style={{ fontSize: 12, color: "#8c8c8c", fontWeight: 500 }}>{stat.change}</Text>
                    </div>
                  </div>
                  <div style={{ width: 48, height: 48, borderRadius: 12, backgroundColor: stat.bgColor, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 22, color: stat.color }}>
                    {stat.icon}
                  </div>
                </div>
              </Card>
            </Col>
          ))}
        </Row>
      )}
    </div>
  );
}
