"use client";

import { useState, useEffect } from "react";
import { BarChart2, Activity, TrendingUp, AlertTriangle, RefreshCw } from "lucide-react";
import { getAnalytics, getPredictiveMaintenance, type Analytics, type PredictiveSummary } from "@/lib/api";

function StatCard({ label, value, sub, color }: { label: string; value: string | number; sub?: string; color: string }) {
  return (
    <div
      style={{
        flex: 1,
        padding: "14px 16px",
        background: "var(--bg-card)",
        border: "1px solid var(--border)",
        borderRadius: 12,
        borderTop: `3px solid ${color}`,
      }}
    >
      <p style={{ fontSize: "1.8rem", fontWeight: 800, color, lineHeight: 1 }}>{value}</p>
      <p style={{ fontSize: "0.75rem", fontWeight: 600, color: "var(--text-primary)", marginTop: 4 }}>{label}</p>
      {sub && <p style={{ fontSize: "0.68rem", color: "var(--text-muted)", marginTop: 2 }}>{sub}</p>}
    </div>
  );
}

function HorizontalBar({ label, value, total, color }: { label: string; value: number; total: number; color: string }) {
  const pct = total > 0 ? Math.round((value / total) * 100) : 0;
  return (
    <div style={{ marginBottom: 8 }}>
      <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 3 }}>
        <span style={{ fontSize: "0.78rem", color: "var(--text-secondary)" }}>{label}</span>
        <span style={{ fontSize: "0.78rem", color: "var(--text-muted)" }}>{value} ({pct}%)</span>
      </div>
      <div style={{ height: 6, background: "var(--border)", borderRadius: 3, overflow: "hidden" }}>
        <div style={{ height: "100%", width: `${pct}%`, background: color, borderRadius: 3, transition: "width 0.8s ease" }} />
      </div>
    </div>
  );
}

const CAT_COLORS: Record<string, string> = {
  "Maintenance Log": "#3b82f6",
  "Inspection Report": "#10b981",
  "SOP": "#f59e0b",
  "P&ID Excerpt": "#8b5cf6",
  "Regulation": "#ef4444",
  "Drawing": "#06b6d4",
  "Other": "#6b7280",
};

function RiskBadge({ level }: { level: string }) {
  const cls = level === "High" ? "badge-high" : level === "Medium" ? "badge-medium" : "badge-low";
  return <span className={`badge ${cls}`}>{level} Risk</span>;
}

export default function AnalyticsDashboardPanel() {
  const [analytics, setAnalytics] = useState<Analytics | null>(null);
  const [predictive, setPredictive] = useState<PredictiveSummary[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchData = async () => {
    setLoading(true);
    try {
      const [a, p] = await Promise.all([getAnalytics(), getPredictiveMaintenance()]);
      setAnalytics(a);
      setPredictive(p);
    } catch {
      // silent
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchData(); }, []);

  const totalDocs = analytics?.stats.total_documents ?? 0;

  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100%", background: "var(--bg-secondary)" }}>
      {/* Header */}
      <div
        style={{
          padding: "16px 20px",
          borderBottom: "1px solid var(--border)",
          background: "rgba(13,20,41,0.95)",
          flexShrink: 0,
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <div
            style={{
              width: 36, height: 36, borderRadius: 10,
              background: "rgba(245,158,11,0.15)",
              border: "1px solid rgba(245,158,11,0.3)",
              display: "flex", alignItems: "center", justifyContent: "center",
            }}
          >
            <BarChart2 size={16} color="#fbbf24" />
          </div>
          <div>
            <h2 style={{ fontSize: "0.95rem", fontWeight: 700 }}>Analytics & Predictive Maintenance</h2>
            <p style={{ fontSize: "0.72rem", color: "var(--text-muted)" }}>Knowledge base insights & equipment health signals</p>
          </div>
        </div>
        <button className="btn-ghost" onClick={fetchData} style={{ padding: "6px 10px" }}>
          <RefreshCw size={13} />
        </button>
      </div>

      <div style={{ flex: 1, overflowY: "auto", padding: "16px 20px" }}>
        {loading ? (
          <div style={{ textAlign: "center", paddingTop: 60, color: "var(--text-muted)" }}>
            <BarChart2 size={28} style={{ margin: "0 auto 8px", opacity: 0.4 }} />
            <p>Loading analytics...</p>
          </div>
        ) : (
          <>
            {/* Stat Cards */}
            <div style={{ display: "flex", gap: 10, marginBottom: 20, flexWrap: "wrap" }}>
              <StatCard label="Total Documents" value={analytics?.stats.total_documents ?? 0} sub="In knowledge base" color="#3b82f6" />
              <StatCard label="Text Chunks Indexed" value={analytics?.stats.total_chunks ?? 0} sub="Available for RAG" color="#06b6d4" />
              <StatCard label="Queries Answered" value={analytics?.stats.total_queries ?? 0} sub="In this session" color="#8b5cf6" />
              <StatCard label="Open Compliance Gaps" value={analytics?.stats.open_gaps ?? 0} sub="Require attention" color="#ef4444" />
            </div>

            {/* Category Distribution */}
            <div style={{ marginBottom: 20 }}>
              <h3 style={{ fontSize: "0.825rem", fontWeight: 700, marginBottom: 12, display: "flex", alignItems: "center", gap: 6 }}>
                <Activity size={14} color="var(--text-muted)" />
                Document Category Distribution
              </h3>
              {Object.entries(analytics?.categories_distribution ?? {}).map(([cat, count]) => (
                <HorizontalBar
                  key={cat}
                  label={cat}
                  value={count}
                  total={totalDocs}
                  color={CAT_COLORS[cat] ?? "#6b7280"}
                />
              ))}
            </div>

            {/* Predictive Maintenance */}
            <div>
              <h3 style={{ fontSize: "0.825rem", fontWeight: 700, marginBottom: 12, display: "flex", alignItems: "center", gap: 6 }}>
                <TrendingUp size={14} color="var(--text-muted)" />
                Equipment Health & Predictive Signals
              </h3>

              {predictive.length === 0 ? (
                <div
                  style={{
                    textAlign: "center",
                    padding: "24px",
                    color: "var(--text-muted)",
                    background: "var(--bg-card)",
                    borderRadius: 12,
                    border: "1px solid var(--border)",
                  }}
                >
                  <Activity size={20} style={{ margin: "0 auto 8px", opacity: 0.4 }} />
                  <p style={{ fontSize: "0.8rem" }}>No maintenance logs with telemetry signals detected yet.</p>
                </div>
              ) : (
                <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                  {predictive.map((equip) => (
                    <div
                      key={equip.equipment_id}
                      className="card"
                      style={{
                        padding: "12px 14px",
                        borderLeft: `3px solid ${
                          equip.risk_level === "High" ? "#ef4444" : equip.risk_level === "Medium" ? "#f59e0b" : "#10b981"
                        }`,
                        borderRadius: "4px 12px 12px 4px",
                      }}
                    >
                      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
                        <div>
                          <h4 style={{ fontSize: "0.875rem", fontWeight: 700, color: "var(--text-primary)" }}>
                            {equip.equipment_id}
                          </h4>
                          <p style={{ fontSize: "0.7rem", color: "var(--text-muted)" }}>
                            {equip.total_maintenance_events} maintenance events · {equip.critical_anomalies} anomalies
                          </p>
                        </div>
                        <RiskBadge level={equip.risk_level} />
                      </div>

                      <div style={{ display: "flex", flexDirection: "column", gap: 5 }}>
                        {equip.alerts.slice(0, 3).map((alert, i) => (
                          <div
                            key={i}
                            style={{
                              display: "flex",
                              alignItems: "center",
                              gap: 8,
                              padding: "5px 8px",
                              borderRadius: 6,
                              background: alert.status === "Critical" ? "rgba(239,68,68,0.06)" : "rgba(16,185,129,0.06)",
                              border: `1px solid ${alert.status === "Critical" ? "rgba(239,68,68,0.2)" : "rgba(16,185,129,0.2)"}`,
                            }}
                          >
                            {alert.status === "Critical" && <AlertTriangle size={11} color="#ef4444" />}
                            <span style={{ fontSize: "0.72rem", color: "var(--text-secondary)", flex: 1 }}>
                              {alert.metric}: <strong style={{ color: alert.status === "Critical" ? "#f87171" : "#34d399" }}>
                                {alert.value} {alert.unit}
                              </strong>
                              <span style={{ color: "var(--text-muted)" }}> (limit: {alert.threshold})</span>
                            </span>
                            <span style={{ fontSize: "0.65rem", color: "var(--text-muted)" }}>{alert.date}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </>
        )}
      </div>
    </div>
  );
}
