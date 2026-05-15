"use client";

import DCLayout from "@/components/DC/DCLayout";
import { useRoleGuard } from "@/hooks/useRoleGuard";
import { Spin } from "antd";

export default function DCRootLayout({ children }: { children: React.ReactNode }) {
  const { status } = useRoleGuard(["dc"]);

  return (
    <DCLayout>
      {status === "loading" ? (
        <div className="min-h-[60vh] flex items-center justify-center"><Spin size="large" /></div>
      ) : status === "redirecting" ? (
        <div className="min-h-[60vh] flex items-center justify-center"><Spin size="large" tip="Redirecting..." /></div>
      ) : (
        children
      )}
    </DCLayout>
  );
}
