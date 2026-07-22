"use client";

import { useState } from "react";
import {
  MessageSquare,
  Library,
  Share2,
  ShieldAlert,
  BarChart2,
  Brain,
  ChevronRight,
  Settings,
} from "lucide-react";
import dynamic from "next/dynamic";

// Dynamic imports to avoid SSR issues with browser APIs
const ChatPanel = dynamic(() => import("@/components/ChatPanel"), { ssr: false });
const DocumentLibraryPanel = dynamic(() => import("@/components/DocumentLibraryPanel"), { ssr: false });
const KnowledgeGraphPanel = dynamic(() => import("@/components/KnowledgeGraphPanel"), { ssr: false });
const CompliancePanel = dynamic(() => import("@/components/CompliancePanel"), { ssr: false });
const AnalyticsDashboardPanel = dynamic(() => import("@/components/AnalyticsDashboardPanel"), { ssr: false });

type Tab = "chat" | "documents" | "knowledge" | "compliance" | "analytics";

const TABS: { id: Tab; label: string; icon: React.ReactNode; description: string; tier: number }[] = [
  {
    id: "chat",
    label: "Operations Brain",
    icon: <MessageSquare size={16} />,
    description: "AI-powered Q&A",
    tier: 1,
  },
  {
    id: "documents",
    label: "Document Library",
    icon: <Library size={16} />,
    description: "Upload & manage",
    tier: 1,
  },
  {
    id: "knowledge",
    label: "Knowledge Graph",
    icon: <Share2 size={16} />,
    description: "Entity relationships",
    tier: 2,
  },
  {
    id: "compliance",
    label: "Compliance Audit",
    icon: <ShieldAlert size={16} />,
    description: "Regulatory gaps",
    tier: 2,
  },
  {
    id: "analytics",
    label: "Analytics",
    icon: <BarChart2 size={16} />,
    description: "Insights & trends",
    tier: 3,
  },
];

const TIER_COLORS: Record<number, string> = {
  1: "#10b981",
  2: "#3b82f6",
  3: "#8b5cf6",
};

export default function DashboardPage() {
  const [activeTab, setActiveTab] = useState<Tab>("chat");
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);

  return (
    <div
      style={{
        display: "flex",
        height: "100vh",
        background: "var(--bg-primary)",
        overflow: "hidden",
        fontFamily: "Inter, sans-serif",
      }}
    >
      {/* Sidebar */}
      <div
        style={{
          width: sidebarCollapsed ? 60 : 230,
          flexShrink: 0,
          display: "flex",
          flexDirection: "column",
          background: "rgba(10, 15, 30, 0.98)",
          borderRight: "1px solid var(--border)",
          transition: "width 0.25s ease",
          overflow: "hidden",
        }}
      >
        {/* Logo */}
        <div
          style={{
            padding: sidebarCollapsed ? "16px 10px" : "16px 14px",
            borderBottom: "1px solid var(--border)",
            display: "flex",
            alignItems: "center",
            gap: 10,
            minHeight: 64,
          }}
        >
          <div
            style={{
              width: 34,
              height: 34,
              borderRadius: 9,
              background: "linear-gradient(135deg, #3b82f6 0%, #06b6d4 50%, #8b5cf6 100%)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              flexShrink: 0,
              boxShadow: "0 0 16px rgba(59,130,246,0.4)",
            }}
          >
            <Brain size={18} color="white" />
          </div>
          {!sidebarCollapsed && (
            <div style={{ overflow: "hidden" }}>
              <div
                style={{
                  fontSize: "0.82rem",
                  fontWeight: 800,
                  whiteSpace: "nowrap",
                  overflow: "hidden",
                }}
                className="gradient-text"
              >
                Unified Brain
              </div>
              <div style={{ fontSize: "0.64rem", color: "var(--text-muted)", whiteSpace: "nowrap" }}>
                Industrial Intelligence
              </div>
            </div>
          )}
        </div>

        {/* Nav Items */}
        <nav style={{ flex: 1, padding: "10px 8px", display: "flex", flexDirection: "column", gap: 3 }}>
          {!sidebarCollapsed && (
            <p
              style={{
                fontSize: "0.6rem",
                color: "var(--text-muted)",
                textTransform: "uppercase",
                letterSpacing: "0.1em",
                padding: "6px 4px 4px",
              }}
            >
              Modules
            </p>
          )}
          {TABS.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`nav-item ${activeTab === tab.id ? "active" : ""}`}
              title={sidebarCollapsed ? tab.label : undefined}
              style={{
                justifyContent: sidebarCollapsed ? "center" : "flex-start",
                padding: sidebarCollapsed ? "10px" : "10px 12px",
                position: "relative",
              }}
            >
              <span style={{ flexShrink: 0 }}>{tab.icon}</span>
              {!sidebarCollapsed && (
                <>
                  <div style={{ flex: 1, overflow: "hidden" }}>
                    <div style={{ fontSize: "0.825rem", fontWeight: 600, whiteSpace: "nowrap" }}>
                      {tab.label}
                    </div>
                    <div style={{ fontSize: "0.65rem", color: "var(--text-muted)" }}>
                      {tab.description}
                    </div>
                  </div>
                  <div
                    style={{
                      fontSize: "0.55rem",
                      fontWeight: 700,
                      padding: "1px 5px",
                      borderRadius: 3,
                      background: `rgba(${
                        tab.tier === 1
                          ? "16,185,129"
                          : tab.tier === 2
                          ? "59,130,246"
                          : "139,92,246"
                      }, 0.15)`,
                      color: TIER_COLORS[tab.tier],
                      border: `1px solid rgba(${
                        tab.tier === 1
                          ? "16,185,129"
                          : tab.tier === 2
                          ? "59,130,246"
                          : "139,92,246"
                      }, 0.3)`,
                      flexShrink: 0,
                      textTransform: "uppercase",
                      letterSpacing: "0.04em",
                    }}
                  >
                    T{tab.tier}
                  </div>
                </>
              )}
            </button>
          ))}
        </nav>

        {/* Collapse toggle & Status */}
        <div style={{ borderTop: "1px solid var(--border)", padding: "10px 8px" }}>
          {!sidebarCollapsed && (
            <div
              style={{
                padding: "8px 10px",
                borderRadius: 8,
                background: "rgba(16,185,129,0.06)",
                border: "1px solid rgba(16,185,129,0.15)",
                marginBottom: 8,
              }}
            >
              <div style={{ display: "flex", alignItems: "center", gap: 5, marginBottom: 2 }}>
                <div className="pulse-dot green" style={{ width: 6, height: 6 }} />
                <span style={{ fontSize: "0.68rem", color: "#34d399", fontWeight: 600 }}>
                  System Active
                </span>
              </div>
              <p style={{ fontSize: "0.62rem", color: "var(--text-muted)" }}>
                Backend · RAG Pipeline · Vector DB
              </p>
            </div>
          )}
          <button
            onClick={() => setSidebarCollapsed(!sidebarCollapsed)}
            className="btn-ghost"
            style={{
              width: "100%",
              justifyContent: "center",
              padding: "7px",
              borderRadius: 8,
            }}
          >
            <ChevronRight
              size={14}
              style={{
                transform: sidebarCollapsed ? "rotate(0deg)" : "rotate(180deg)",
                transition: "transform 0.2s",
              }}
            />
          </button>
        </div>
      </div>

      {/* Main Content */}
      <main style={{ flex: 1, display: "flex", flexDirection: "column", overflow: "hidden" }}>
        {/* Top bar */}
        <div
          style={{
            height: 0,
            background: "linear-gradient(90deg, rgba(59,130,246,0.05) 0%, rgba(6,182,212,0.05) 50%, rgba(139,92,246,0.05) 100%)",
            borderBottom: "1px solid transparent",
          }}
        />

        {/* Panel Content */}
        <div style={{ flex: 1, overflow: "hidden" }}>
          {activeTab === "chat" && <ChatPanel />}
          {activeTab === "documents" && <DocumentLibraryPanel />}
          {activeTab === "knowledge" && <KnowledgeGraphPanel />}
          {activeTab === "compliance" && <CompliancePanel />}
          {activeTab === "analytics" && <AnalyticsDashboardPanel />}
        </div>
      </main>
    </div>
  );
}
