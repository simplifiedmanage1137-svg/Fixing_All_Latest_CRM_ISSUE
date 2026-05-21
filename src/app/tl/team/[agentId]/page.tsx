"use client";

import { useCallback, useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import {
  Button,
  Card,
  Col,
  Descriptions,
  Form,
  Input,
  message,
  Modal,
  Row,
  Spin,
  Switch,
  Table,
  Tag,
  Typography,
} from "antd";
import {
  ArrowLeftOutlined,
  LockOutlined,
  UserOutlined,
} from "@ant-design/icons";
import { useAuth } from "@/context/AuthContext";

const { Title, Text } = Typography;

interface AgentProfile {
  id: string;
  full_name: string | null;
  email: string | null;
  phone: string | null;
  employee_id: string | null;
  agent_code: string | null;
  date_of_birth: string | null;
  joining_date: string | null;
  status: string | null;
  is_active: boolean;
  created_at: string | null;
  updated_at: string | null;
  designation: string | null;
  department: string | null;
  employment_type: string | null;
  roles: string[];
  organization_name: string | null;
}

interface CampaignStat {
  campaign_id: string;
  campaign_ref: string;
  campaign_name: string;
  total_leads: number;
  qualified_leads: number;
  today: number;
  yesterday: number;
  overall: number;
}

interface Summary {
  total_leads: number;
  qualified_leads: number;
  today: number;
  yesterday: number;
  total_campaigns: number;
}

function fmt(dateStr: string | null | undefined) {
  if (!dateStr) return "—";
  return new Date(dateStr).toLocaleDateString("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

export default function AgentDetailsPage() {
  const params = useParams();
  const router = useRouter();
  const agentId = params?.agentId as string | undefined;
  const { hasRole, isInitialized } = useAuth();

  const [agent, setAgent] = useState<AgentProfile | null>(null);
  const [campaigns, setCampaigns] = useState<CampaignStat[]>([]);
  const [summary, setSummary] = useState<Summary | null>(null);
  const [loading, setLoading] = useState(true);
  const [togglingStatus, setTogglingStatus] = useState(false);
  const [pwModalOpen, setPwModalOpen] = useState(false);
  const [pwLoading, setPwLoading] = useState(false);
  const [pwForm] = Form.useForm<{ password: string; confirm: string }>();

  const fetchAgent = useCallback(async () => {
    if (!agentId) return;
    setLoading(true);
    try {
      const res = await fetch(`/api/tl/agents/${agentId}`, { credentials: "include" });
      const data = await res.json();
      // Always render whatever data we get — never redirect on data errors
      if (data.agent) {
        setAgent(data.agent);
        setCampaigns(data.campaigns ?? []);
        setSummary(data.summary ?? null);
      } else {
        // Minimal shell so the page still renders
        setAgent({
          id: agentId,
          full_name: null, email: null, phone: null,
          employee_id: null, agent_code: null, date_of_birth: null,
          joining_date: null, status: null, is_active: true,
          created_at: null, updated_at: null, designation: null,
          department: null, employment_type: null,
          roles: [], organization_name: null,
        });
        if (data.error) message.warning(`Could not load full profile: ${data.error}`);
      }
    } catch (err) {
      message.error(err instanceof Error ? err.message : "Failed to load agent");
    } finally {
      setLoading(false);
    }
  }, [agentId]);

  useEffect(() => {
    if (!isInitialized) return;
    if (!hasRole("team_leader") && !hasRole("tl")) {
      router.replace("/tl/dashboard");
      return;
    }
    if (!agentId) {
      router.replace("/tl/team");
      return;
    }
    fetchAgent();
  }, [isInitialized, hasRole, agentId, fetchAgent, router]);

  const handleToggleStatus = async (checked: boolean) => {
    if (!agent) return;
    setTogglingStatus(true);
    try {
      const res = await fetch(`/api/tl/agents/${agent.id}/status`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ is_active: checked }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to update status");
      setAgent((prev) => prev ? { ...prev, is_active: checked } : prev);
      message.success(`Account ${checked ? "activated" : "deactivated"} successfully`);
    } catch (err) {
      message.error(err instanceof Error ? err.message : "Failed to update status");
    } finally {
      setTogglingStatus(false);
    }
  };

  const handleChangePassword = async () => {
    if (!agent) return;
    try {
      const values = await pwForm.validateFields();
      setPwLoading(true);
      const res = await fetch(`/api/tl/agents/${agent.id}/password`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ password: values.password }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to change password");
      message.success("Password changed successfully");
      pwForm.resetFields();
      setPwModalOpen(false);
    } catch (err) {
      const isValidation =
        err && typeof err === "object" && "errorFields" in err;
      if (!isValidation) {
        message.error(err instanceof Error ? err.message : "Failed to change password");
      }
    } finally {
      setPwLoading(false);
    }
  };

  const campaignColumns = [
    {
      title: "Campaign",
      key: "campaign",
      render: (_: unknown, r: CampaignStat) => (
        <div>
          <div style={{ fontWeight: 600, fontSize: 14 }}>{r.campaign_name}</div>
          <Text type="secondary" style={{ fontSize: 12 }}>{r.campaign_ref}</Text>
        </div>
      ),
    },
    {
      title: "Total Leads",
      dataIndex: "total_leads",
      key: "total_leads",
      align: "center" as const,
      render: (v: number) => <span style={{ fontWeight: 600 }}>{v}</span>,
    },
    {
      title: "Qualified Leads",
      dataIndex: "qualified_leads",
      key: "qualified_leads",
      align: "center" as const,
      render: (v: number) => (
        <Tag color="green" style={{ fontWeight: 600 }}>{v}</Tag>
      ),
    },
    {
      title: "Today",
      dataIndex: "today",
      key: "today",
      align: "center" as const,
      render: (v: number) => <span style={{ fontWeight: 600, color: v > 0 ? "#1677ff" : undefined }}>{v}</span>,
    },
    {
      title: "Yesterday",
      dataIndex: "yesterday",
      key: "yesterday",
      align: "center" as const,
      render: (v: number) => <span style={{ fontWeight: 600 }}>{v}</span>,
    },
    {
      title: "Overall",
      dataIndex: "overall",
      key: "overall",
      align: "center" as const,
      render: (v: number) => <span style={{ fontWeight: 600 }}>{v}</span>,
    },
  ];

  if (!isInitialized || loading) {
    return (
      <div style={{ minHeight: "60vh", display: "flex", alignItems: "center", justifyContent: "center" }}>
        <Spin size="large" />
      </div>
    );
  }

  if (!agent) return null;

  return (
    <div style={{ padding: "0 0 40px" }}>
      {/* Back */}
      <div style={{ marginBottom: 20 }}>
        <Link
          href="/tl/team"
          style={{ display: "inline-flex", alignItems: "center", gap: 6, fontSize: 14, color: "#1677ff", textDecoration: "none" }}
        >
          <ArrowLeftOutlined /> Back to Team
        </Link>
      </div>

      {/* Page title */}
      <div style={{ marginBottom: 24, display: "flex", alignItems: "center", gap: 14 }}>
        <div
          style={{
            width: 48,
            height: 48,
            borderRadius: "50%",
            background: "#1677ff",
            color: "#fff",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            fontSize: 20,
            fontWeight: 700,
            flexShrink: 0,
          }}
        >
          {agent.full_name?.[0]?.toUpperCase() ?? <UserOutlined />}
        </div>
        <div>
          <Title level={3} style={{ margin: 0 }}>{agent.full_name || "—"}</Title>
          <Text type="secondary">{agent.email}</Text>
        </div>
      </div>

      {/* Summary stat strip */}
      {summary && (
        <Row gutter={[16, 16]} style={{ marginBottom: 24 }}>
          {[
            { label: "Total Leads", value: summary.total_leads, color: "#1677ff" },
            { label: "Qualified Leads", value: summary.qualified_leads, color: "#52c41a" },
            { label: "Today's Work", value: summary.today, color: "#fa8c16" },
            { label: "Yesterday's Work", value: summary.yesterday, color: "#722ed1" },
            { label: "Campaigns", value: summary.total_campaigns, color: "#13c2c2" },
          ].map((s) => (
            <Col xs={12} sm={8} md={6} lg={4} key={s.label}>
              <Card
                size="small"
                style={{ borderRadius: 10, textAlign: "center", boxShadow: "0 1px 4px rgba(0,0,0,0.06)" }}
                styles={{ body: { padding: "14px 12px" } }}
              >
                <div style={{ fontSize: 24, fontWeight: 700, color: s.color }}>{s.value}</div>
                <div style={{ fontSize: 12, color: "#8c8c8c", marginTop: 2 }}>{s.label}</div>
              </Card>
            </Col>
          ))}
        </Row>
      )}

      <Row gutter={[24, 24]}>
        {/* Card 1: Profile */}
        <Col xs={24} lg={14}>
          <Card
            title="Agent Details"
            style={{ borderRadius: 10, boxShadow: "0 2px 8px rgba(0,0,0,0.05)" }}
            extra={
              <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                <Text style={{ fontSize: 13 }}>
                  {agent.is_active ? (
                    <Tag color="success">Active</Tag>
                  ) : (
                    <Tag color="error">Inactive</Tag>
                  )}
                </Text>
                <Switch
                  checked={agent.is_active}
                  loading={togglingStatus}
                  onChange={handleToggleStatus}
                  checkedChildren="Active"
                  unCheckedChildren="Inactive"
                />
              </div>
            }
          >
            <Descriptions column={{ xs: 1, sm: 2 }} size="small" labelStyle={{ color: "#8c8c8c", fontWeight: 500 }}>
              <Descriptions.Item label="Full Name">{agent.full_name || "—"}</Descriptions.Item>
              <Descriptions.Item label="Email">{agent.email || "—"}</Descriptions.Item>
              <Descriptions.Item label="Phone">{agent.phone || "—"}</Descriptions.Item>
              <Descriptions.Item label="Role">
                {agent.roles.length > 0
                  ? agent.roles.map((r) => (
                      <Tag key={r} style={{ textTransform: "capitalize" }}>{r}</Tag>
                    ))
                  : "—"}
              </Descriptions.Item>
              <Descriptions.Item label="Employee ID">{agent.employee_id || "—"}</Descriptions.Item>
              <Descriptions.Item label="Agent Code">{agent.agent_code || "—"}</Descriptions.Item>
              <Descriptions.Item label="Designation">{agent.designation || "—"}</Descriptions.Item>
              <Descriptions.Item label="Department">{agent.department || "—"}</Descriptions.Item>
              <Descriptions.Item label="Employment Type">{agent.employment_type || "—"}</Descriptions.Item>
              <Descriptions.Item label="Organization">{agent.organization_name || "—"}</Descriptions.Item>
              <Descriptions.Item label="Joining Date">{fmt(agent.joining_date)}</Descriptions.Item>
              <Descriptions.Item label="Date of Birth">{fmt(agent.date_of_birth)}</Descriptions.Item>
              <Descriptions.Item label="Account Created">{fmt(agent.created_at)}</Descriptions.Item>
              <Descriptions.Item label="Last Updated">{fmt(agent.updated_at)}</Descriptions.Item>
            </Descriptions>
          </Card>
        </Col>

        {/* Card 2: Account Actions */}
        <Col xs={24} lg={10}>
          <Card
            title="Account Actions"
            style={{ borderRadius: 10, boxShadow: "0 2px 8px rgba(0,0,0,0.05)" }}
          >
            <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
              {/* Status toggle explanation */}
              <div style={{ background: "#f9f9f9", borderRadius: 8, padding: "14px 16px" }}>
                <Text strong style={{ display: "block", marginBottom: 4 }}>Account Status</Text>
                <Text type="secondary" style={{ fontSize: 13 }}>
                  {agent.is_active
                    ? "This agent can currently log in. Toggle the switch to deactivate."
                    : "This agent is deactivated and cannot log in. Toggle to reactivate."}
                </Text>
                <div style={{ marginTop: 12, display: "flex", gap: 10 }}>
                  <Button
                    type="primary"
                    disabled={agent.is_active}
                    loading={togglingStatus}
                    onClick={() => handleToggleStatus(true)}
                  >
                    Activate Account
                  </Button>
                  <Button
                    danger
                    disabled={!agent.is_active}
                    loading={togglingStatus}
                    onClick={() => handleToggleStatus(false)}
                  >
                    Deactivate Account
                  </Button>
                </div>
              </div>

              {/* Change password */}
              <div style={{ background: "#f9f9f9", borderRadius: 8, padding: "14px 16px" }}>
                <Text strong style={{ display: "block", marginBottom: 4 }}>Change Password</Text>
                <Text type="secondary" style={{ fontSize: 13 }}>
                  {"Set a new password for this agent's account."}
                </Text>
                <div style={{ marginTop: 12 }}>
                  <Button
                    icon={<LockOutlined />}
                    onClick={() => {
                      pwForm.resetFields();
                      setPwModalOpen(true);
                    }}
                  >
                    Change Password
                  </Button>
                </div>
              </div>
            </div>
          </Card>
        </Col>
      </Row>

      {/* Card 3: Campaign Performance */}
      <Card
        title={
          <span>
            Campaign Performance
            <Text type="secondary" style={{ fontSize: 13, fontWeight: 400, marginLeft: 10 }}>
              ({campaigns.length} campaign{campaigns.length !== 1 ? "s" : ""})
            </Text>
          </span>
        }
        style={{ marginTop: 24, borderRadius: 10, boxShadow: "0 2px 8px rgba(0,0,0,0.05)" }}
      >
        <Table
          dataSource={campaigns}
          columns={campaignColumns}
          rowKey="campaign_id"
          size="middle"
          pagination={{ pageSize: 10, showSizeChanger: true, showTotal: (t) => `Total ${t} campaigns` }}
          locale={{ emptyText: "No campaigns worked yet." }}
          scroll={{ x: 700 }}
        />
      </Card>

      {/* Change Password Modal */}
      <Modal
        title="Change Agent Password"
        open={pwModalOpen}
        onCancel={() => {
          pwForm.resetFields();
          setPwModalOpen(false);
        }}
        onOk={handleChangePassword}
        okText="Change Password"
        okButtonProps={{ loading: pwLoading, icon: <LockOutlined /> }}
        cancelButtonProps={{ disabled: pwLoading }}
        destroyOnClose
        width={420}
      >
        <Form form={pwForm} layout="vertical" style={{ marginTop: 16 }}>
          <Form.Item
            name="password"
            label="New Password"
            rules={[
              { required: true, message: "Password is required" },
              { min: 8, message: "Minimum 8 characters" },
            ]}
          >
            <Input.Password placeholder="Enter new password" />
          </Form.Item>
          <Form.Item
            name="confirm"
            label="Confirm Password"
            dependencies={["password"]}
            rules={[
              { required: true, message: "Please confirm the password" },
              ({ getFieldValue }) => ({
                validator(_, value) {
                  if (!value || getFieldValue("password") === value) {
                    return Promise.resolve();
                  }
                  return Promise.reject(new Error("Passwords do not match"));
                },
              }),
            ]}
          >
            <Input.Password placeholder="Confirm new password" />
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
}
