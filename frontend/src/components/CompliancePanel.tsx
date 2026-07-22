"use client";

import { useState, useEffect } from "react";
import {
  ShieldAlert,
  RefreshCw,
  ChevronDown,
  ChevronUp,
  AlertTriangle,
  CheckCircle2,
  Zap,
} from "lucide-react";
import {
  getComplianceGaps,
  triggerComplianceAudit,
  type ComplianceGap,
} from "@/lib/api";

function SeverityBadge({ severity }: { severity: ComplianceGap["severity"] }) {
  const cls =
    severity === "High"
      ? "badge-high"
      : severity === "Medium"
      ? "badge-medium"
      : "badge-low";
  return <span className={`badge ${cls}`}>{severity}</span>;
}

function GapCard({ gap }: { gap: ComplianceGap }) {
  const [expanded, setExpanded] = useState(false);

  const severityColor =
    gap.severity === "High"
      ? "#ef4444"
      : gap.severity === "Medium"
      ? "#f59e0b"
      : "#10b981";

  return (
    <div
      className="card fade-in"
      style={{
        borderLeft: `3px solid ${severityColor}`,
        borderRadius: "4px 12px 12px 4px",
      }}
    >
      <div
        style={{ padding: "12px 14px", cursor: "pointer" }}
        onClick={() => setExpanded(!expanded)}
      >
        <div
          style={{
            display: "flex",
            alignItems: "flex-start",
            justifyContent: "space-between",
            gap: 8,
          }}
        >
          <div style={{ flex: 1 }}>
            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: 8,
                marginBottom: 4,
                flexWrap: "wrap",
              }}
            >
              <AlertTriangle size={13} color={severityColor} />
              <span
                style={{
                  fontSize: "0.825rem",
                  fontWeight: 700,
                  color: "var(--text-primary)",
                  flex: 1,
                }}
              >
                {gap.title}
              </span>
              <SeverityBadge severity={gap.severity} />
            </div>

            <div
              style={{
                display: "flex",
                gap: 8,
                flexWrap: "wrap",
                alignItems: "center",
              }}
            >
              <span
                style={{
                  fontSize: "0.68rem",
                  color: "var(--text-muted)",
                  background: "rgba(245,158,11,0.08)",
                  border: "1px solid rgba(245,158,11,0.2)",
                  borderRadius: 4,
                  padding: "1px 6px",
                }}
              >
                {gap.regulation}
              </span>
              <span
                style={{
                  fontSize: "0.68rem",
                  color: "var(--text-muted)",
                }}
              >
                📄 {gap.offending_doc}
              </span>
              <span
                style={{
                  fontSize: "0.68rem",
                  color:
                    gap.status === "Open" ? "#f87171" : "var(--accent-green)",
                  marginLeft: "auto",
                }}
              >
                {gap.status}
              </span>
            </div>
          </div>
          <div style={{ flexShrink: 0, marginTop: 2 }}>
            {expanded ? (
              <ChevronUp size={14} color="var(--text-muted)" />
            ) : (
              <ChevronDown size={14} color="var(--text-muted)" />
            )}
          </div>
        </div>
      </div>

      {expanded && (
        <div
          className="fade-in"
          style={{
            borderTop: "1px solid var(--border)",
            padding: "12px 14px",
          }}
        >
          <div style={{ marginBottom: 10 }}>
            <p
              style={{
                fontSize: "0.65rem",
                color: "var(--text-muted)",
                textTransform: "uppercase",
                letterSpacing: "0.06em",
                marginBottom: 4,
              }}
            >
              Finding
            </p>
            <p
              style={{
                fontSize: "0.8rem",
                color: "var(--text-secondary)",
                lineHeight: 1.6,
              }}
            >
              {gap.description}
            </p>
          </div>
          <div
            style={{
              background: "rgba(16,185,129,0.05)",
              border: "1px solid rgba(16,185,129,0.2)",
              borderRadius: 8,
              padding: "8px 12px",
            }}
          >
            <p
              style={{
                fontSize: "0.65rem",
                color: "#34d399",
                textTransform: "uppercase",
                letterSpacing: "0.06em",
                marginBottom: 3,
              }}
            >
              💡 Recommendation
            </p>
            <p
              style={{
                fontSize: "0.8rem",
                color: "var(--text-secondary)",
                lineHeight: 1.6,
              }}
            >
              {gap.recommendation}
            </p>
          </div>
        </div>
      )}
    </div>
  );
}

export default function CompliancePanel() {
  const [gaps, setGaps] = useState<ComplianceGap[]>([]);
  const [loading, setLoading] = useState(true);
  const [auditing, setAuditing] = useState(false);
  const [filter, setFilter] = useState<"All" | "High" | "Medium" | "Low">("All");

  const fetchGaps = async () => {
    setLoading(true);
    try {
      const data = await getComplianceGaps();
      setGaps(data);
    } catch {
      // silent
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchGaps();
  }, []);

  const handleAudit = async () => {
    setAuditing(true);
    try {
      const result = await triggerComplianceAudit();
      await fetchGaps();
    } catch {
      alert("Audit failed. Ensure backend is running with a valid GEMINI_API_KEY.");
    } finally {
      setAuditing(false);
    }
  };

  const filtered =
    filter === "All" ? gaps : gaps.filter((g) => g.severity === filter);
  const counts = {
    High: gaps.filter((g) => g.severity === "High").length,
    Medium: gaps.filter((g) => g.severity === "Medium").length,
    Low: gaps.filter((g) => g.severity === "Low").length,
  };

  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        height: "100%",
        background: "var(--bg-secondary)",
      }}
    >
      {/* Header */}
      <div
        style={{
          padding: "16px 20px",
          borderBottom: "1px solid var(--border)",
          background: "rgba(13,20,41,0.95)",
          flexShrink: 0,
        }}
      >
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            marginBottom: 12,
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <div
              style={{
                width: 36,
                height: 36,
                borderRadius: 10,
                background: "rgba(239,68,68,0.12)",
                border: "1px solid rgba(239,68,68,0.25)",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              <ShieldAlert size={16} color="#f87171" />
            </div>
            <div>
              <h2
                style={{
                  fontSize: "0.95rem",
                  fontWeight: 700,
                  color: "var(--text-primary)",
                }}
              >
                Compliance Audit
              </h2>
              <p style={{ fontSize: "0.72rem", color: "var(--text-muted)" }}>
                {gaps.length} gaps detected · Regulations vs Inspections
              </p>
            </div>
          </div>
          <div style={{ display: "flex", gap: 8 }}>
            <button
              className="btn-ghost"
              onClick={fetchGaps}
              style={{ padding: "6px 10px" }}
            >
              <RefreshCw size={13} />
            </button>
            <button
              className="btn-primary"
              onClick={handleAudit}
              disabled={auditing}
              style={{
                background: auditing
                  ? undefined
                  : "linear-gradient(135deg, #dc2626, #b91c1c)",
              }}
            >
              <Zap size={13} />
              {auditing ? "Running…" : "Run AI Audit"}
            </button>
          </div>
        </div>

        {/* Summary Stats */}
        <div style={{ display: "flex", gap: 10, marginBottom: 12 }}>
          {(["High", "Medium", "Low"] as const).map((sev) => {
            const color =
              sev === "High"
                ? "#ef4444"
                : sev === "Medium"
                ? "#f59e0b"
                : "#10b981";
            return (
              <div
                key={sev}
                style={{
                  flex: 1,
                  padding: "8px 10px",
                  borderRadius: 8,
                  background: `rgba(${
                    sev === "High"
                      ? "239,68,68"
                      : sev === "Medium"
                      ? "245,158,11"
                      : "16,185,129"
                  }, 0.08)`,
                  border: `1px solid rgba(${
                    sev === "High"
                      ? "239,68,68"
                      : sev === "Medium"
                      ? "245,158,11"
                      : "16,185,129"
                  }, 0.2)`,
                  textAlign: "center",
                  cursor: "pointer",
                }}
                onClick={() => setFilter(filter === sev ? "All" : sev)}
              >
                <p
                  style={{
                    fontSize: "1.4rem",
                    fontWeight: 800,
                    color,
                    lineHeight: 1,
                  }}
                >
                  {counts[sev]}
                </p>
                <p style={{ fontSize: "0.65rem", color: "var(--text-muted)", marginTop: 2 }}>
                  {sev} Risk
                </p>
              </div>
            );
          })}
        </div>

        {/* Filter tabs */}
        <div style={{ display: "flex", gap: 5 }}>
          {(["All", "High", "Medium", "Low"] as const).map((f) => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              style={{
                padding: "3px 10px",
                borderRadius: 6,
                fontSize: "0.72rem",
                fontWeight: 500,
                border: "1px solid",
                cursor: "pointer",
                transition: "all 0.15s",
                borderColor:
                  filter === f
                    ? "rgba(59,130,246,0.5)"
                    : "var(--border)",
                background:
                  filter === f
                    ? "rgba(59,130,246,0.15)"
                    : "transparent",
                color: filter === f ? "#60a5fa" : "var(--text-muted)",
              }}
            >
              {f}
            </button>
          ))}
        </div>
      </div>

      {/* Gap List */}
      <div style={{ flex: 1, overflowY: "auto", padding: "12px 16px" }}>
        {loading ? (
          <div
            style={{
              textAlign: "center",
              paddingTop: 40,
              color: "var(--text-muted)",
            }}
          >
            <RefreshCw size={20} style={{ margin: "0 auto 8px" }} />
            <p style={{ fontSize: "0.875rem" }}>Loading compliance data...</p>
          </div>
        ) : filtered.length === 0 ? (
          <div
            style={{
              textAlign: "center",
              paddingTop: 40,
              color: "var(--text-muted)",
            }}
          >
            <CheckCircle2 size={28} color="#10b981" style={{ margin: "0 auto 8px" }} />
            <p style={{ fontSize: "0.875rem", color: "#34d399" }}>
              No compliance gaps detected
            </p>
            <p style={{ fontSize: "0.75rem", marginTop: 4 }}>
              All inspections appear to be within required schedule.
            </p>
          </div>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {filtered.map((gap) => (
              <GapCard key={gap.id} gap={gap} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
