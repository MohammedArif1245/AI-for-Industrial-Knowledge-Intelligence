"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { Share2, ZoomIn, ZoomOut, Info } from "lucide-react";
import { getKnowledgeGraph, type KnowledgeNode, type KnowledgeLink } from "@/lib/api";

const NODE_COLORS: Record<string, string> = {
  Equipment: "#3b82f6",
  Department: "#10b981",
  Standard: "#f59e0b",
  Incident: "#ef4444",
};

const NODE_RADIUS = 28;
const WIDTH = 800;
const HEIGHT = 500;

// Simple physics-based force layout
function useForceLayout(nodes: KnowledgeNode[], links: KnowledgeLink[]) {
  const [positions, setPositions] = useState<Record<string, { x: number; y: number }>>({});

  useEffect(() => {
    if (!nodes.length) return;

    // Initialize random positions
    const pos: Record<string, { x: number; y: number; vx: number; vy: number }> = {};
    nodes.forEach((n, i) => {
      const angle = (i / nodes.length) * 2 * Math.PI;
      const r = Math.min(WIDTH, HEIGHT) * 0.32;
      pos[n.id] = {
        x: WIDTH / 2 + r * Math.cos(angle),
        y: HEIGHT / 2 + r * Math.sin(angle),
        vx: 0,
        vy: 0,
      };
    });

    // Run force simulation
    const ITERATIONS = 200;
    const REPULSION = 4000;
    const ATTRACTION = 0.04;
    const DAMPING = 0.85;
    const CENTER_FORCE = 0.008;

    for (let iter = 0; iter < ITERATIONS; iter++) {
      // Repulsion between all nodes
      for (let i = 0; i < nodes.length; i++) {
        for (let j = i + 1; j < nodes.length; j++) {
          const a = pos[nodes[i].id];
          const b = pos[nodes[j].id];
          const dx = b.x - a.x;
          const dy = b.y - a.y;
          const dist = Math.sqrt(dx * dx + dy * dy) || 1;
          const force = REPULSION / (dist * dist);
          const fx = (dx / dist) * force;
          const fy = (dy / dist) * force;
          a.vx -= fx; a.vy -= fy;
          b.vx += fx; b.vy += fy;
        }
      }

      // Attraction along links
      links.forEach((link) => {
        const a = pos[link.source];
        const b = pos[link.target];
        if (!a || !b) return;
        const dx = b.x - a.x;
        const dy = b.y - a.y;
        const dist = Math.sqrt(dx * dx + dy * dy) || 1;
        const force = (dist - 120) * ATTRACTION;
        a.vx += (dx / dist) * force;
        a.vy += (dy / dist) * force;
        b.vx -= (dx / dist) * force;
        b.vy -= (dy / dist) * force;
      });

      // Center force
      nodes.forEach((n) => {
        const p = pos[n.id];
        p.vx += (WIDTH / 2 - p.x) * CENTER_FORCE;
        p.vy += (HEIGHT / 2 - p.y) * CENTER_FORCE;
        // Apply velocity
        p.vx *= DAMPING;
        p.vy *= DAMPING;
        p.x += p.vx;
        p.y += p.vy;
        // Clamp to bounds
        p.x = Math.max(NODE_RADIUS + 10, Math.min(WIDTH - NODE_RADIUS - 10, p.x));
        p.y = Math.max(NODE_RADIUS + 10, Math.min(HEIGHT - NODE_RADIUS - 10, p.y));
      });
    }

    const finalPos: Record<string, { x: number; y: number }> = {};
    nodes.forEach((n) => {
      finalPos[n.id] = { x: pos[n.id].x, y: pos[n.id].y };
    });
    setPositions(finalPos);
  }, [nodes, links]);

  return positions;
}

export default function KnowledgeGraphPanel() {
  const [graph, setGraph] = useState<{ nodes: KnowledgeNode[]; links: KnowledgeLink[] }>({
    nodes: [],
    links: [],
  });
  const [loading, setLoading] = useState(true);
  const [selectedNode, setSelectedNode] = useState<KnowledgeNode | null>(null);
  const [zoom, setZoom] = useState(1);
  const positions = useForceLayout(graph.nodes, graph.links);

  useEffect(() => {
    getKnowledgeGraph()
      .then(setGraph)
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  const typeCount = graph.nodes.reduce<Record<string, number>>((acc, n) => {
    acc[n.type] = (acc[n.type] || 0) + 1;
    return acc;
  }, {});

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
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <div
              style={{
                width: 36, height: 36, borderRadius: 10,
                background: "rgba(16,185,129,0.15)",
                border: "1px solid rgba(16,185,129,0.3)",
                display: "flex", alignItems: "center", justifyContent: "center",
              }}
            >
              <Share2 size={16} color="#34d399" />
            </div>
            <div>
              <h2 style={{ fontSize: "0.95rem", fontWeight: 700 }}>Knowledge Graph</h2>
              <p style={{ fontSize: "0.72rem", color: "var(--text-muted)" }}>
                {graph.nodes.length} nodes · {graph.links.length} relationships
              </p>
            </div>
          </div>
          <div style={{ display: "flex", gap: 6 }}>
            <button className="btn-ghost" onClick={() => setZoom((z) => Math.min(z + 0.2, 2))} style={{ padding: "6px 10px" }}>
              <ZoomIn size={14} />
            </button>
            <button className="btn-ghost" onClick={() => setZoom((z) => Math.max(z - 0.2, 0.4))} style={{ padding: "6px 10px" }}>
              <ZoomOut size={14} />
            </button>
          </div>
        </div>

        {/* Legend */}
        <div style={{ display: "flex", gap: 12, marginTop: 10, flexWrap: "wrap" }}>
          {Object.entries(NODE_COLORS).map(([type, color]) => (
            <div key={type} style={{ display: "flex", alignItems: "center", gap: 5 }}>
              <div style={{ width: 10, height: 10, borderRadius: "50%", background: color, boxShadow: `0 0 6px ${color}` }} />
              <span style={{ fontSize: "0.72rem", color: "var(--text-secondary)" }}>
                {type} ({typeCount[type] || 0})
              </span>
            </div>
          ))}
        </div>
      </div>

      <div style={{ flex: 1, display: "flex", overflow: "hidden" }}>
        {/* Graph Canvas */}
        <div style={{ flex: 1, overflow: "hidden", position: "relative" }}>
          {loading ? (
            <div
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                height: "100%",
                color: "var(--text-muted)",
                flexDirection: "column",
                gap: 8,
              }}
            >
              <Share2 size={28} style={{ opacity: 0.3 }} />
              <p style={{ fontSize: "0.875rem" }}>Loading knowledge graph...</p>
            </div>
          ) : (
            <div
              style={{
                width: "100%",
                height: "100%",
                overflow: "hidden",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              <svg
                width={WIDTH}
                height={HEIGHT}
                style={{
                  transform: `scale(${zoom})`,
                  transformOrigin: "center center",
                  transition: "transform 0.2s",
                  maxWidth: "100%",
                  maxHeight: "100%",
                }}
              >
                {/* Background grid */}
                <defs>
                  <pattern id="grid" width="30" height="30" patternUnits="userSpaceOnUse">
                    <path d="M 30 0 L 0 0 0 30" fill="none" stroke="rgba(30,45,74,0.5)" strokeWidth="0.5" />
                  </pattern>
                  {Object.entries(NODE_COLORS).map(([type, color]) => (
                    <radialGradient key={type} id={`glow-${type}`} cx="50%" cy="50%" r="50%">
                      <stop offset="0%" stopColor={color} stopOpacity="0.3" />
                      <stop offset="100%" stopColor={color} stopOpacity="0" />
                    </radialGradient>
                  ))}
                </defs>
                <rect width={WIDTH} height={HEIGHT} fill="url(#grid)" />

                {/* Links */}
                {graph.links.map((link) => {
                  const s = positions[link.source];
                  const t = positions[link.target];
                  if (!s || !t) return null;
                  const mx = (s.x + t.x) / 2;
                  const my = (s.y + t.y) / 2;
                  return (
                    <g key={link.id}>
                      <line
                        x1={s.x} y1={s.y} x2={t.x} y2={t.y}
                        stroke="rgba(59,130,246,0.2)"
                        strokeWidth={1.5}
                        strokeDasharray="4 3"
                      />
                      <text
                        x={mx} y={my - 5}
                        fill="rgba(143,163,191,0.7)"
                        fontSize={9}
                        textAnchor="middle"
                        fontFamily="JetBrains Mono"
                      >
                        {link.relation}
                      </text>
                    </g>
                  );
                })}

                {/* Nodes */}
                {graph.nodes.map((node) => {
                  const pos = positions[node.id];
                  if (!pos) return null;
                  const color = NODE_COLORS[node.type] || "#8b5cf6";
                  const isSelected = selectedNode?.id === node.id;

                  return (
                    <g
                      key={node.id}
                      onClick={() => setSelectedNode(isSelected ? null : node)}
                      style={{ cursor: "pointer" }}
                    >
                      {/* Glow */}
                      <circle
                        cx={pos.x} cy={pos.y}
                        r={isSelected ? NODE_RADIUS + 12 : NODE_RADIUS + 6}
                        fill={`url(#glow-${node.type})`}
                      />
                      {/* Main circle */}
                      <circle
                        cx={pos.x} cy={pos.y}
                        r={NODE_RADIUS}
                        fill={`rgba(${hexToRgb(color)}, 0.15)`}
                        stroke={color}
                        strokeWidth={isSelected ? 2.5 : 1.5}
                      />
                      {/* Type letter */}
                      <text
                        x={pos.x} y={pos.y - 4}
                        fill={color}
                        fontSize={11}
                        textAnchor="middle"
                        fontWeight={700}
                        fontFamily="Inter"
                      >
                        {node.type[0]}
                      </text>
                      {/* ID label inside */}
                      <text
                        x={pos.x} y={pos.y + 8}
                        fill={color}
                        fontSize={7.5}
                        textAnchor="middle"
                        fontFamily="JetBrains Mono"
                        opacity={0.8}
                      >
                        {node.id.length > 10 ? node.id.slice(0, 10) + "…" : node.id}
                      </text>
                      {/* Name below circle */}
                      <text
                        x={pos.x} y={pos.y + NODE_RADIUS + 13}
                        fill="rgba(143,163,191,0.9)"
                        fontSize={9}
                        textAnchor="middle"
                        fontFamily="Inter"
                        fontWeight={500}
                      >
                        {node.name.length > 18 ? node.name.slice(0, 18) + "…" : node.name}
                      </text>
                    </g>
                  );
                })}
              </svg>
            </div>
          )}
        </div>

        {/* Node Detail Panel */}
        {selectedNode && (
          <div
            className="fade-in"
            style={{
              width: 240,
              borderLeft: "1px solid var(--border)",
              padding: 14,
              background: "rgba(13,20,41,0.98)",
              overflowY: "auto",
              flexShrink: 0,
            }}
          >
            <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 12 }}>
              <div
                style={{
                  width: 10, height: 10, borderRadius: "50%",
                  background: NODE_COLORS[selectedNode.type],
                  boxShadow: `0 0 8px ${NODE_COLORS[selectedNode.type]}`,
                }}
              />
              <span style={{ fontSize: "0.72rem", color: "var(--text-muted)" }}>
                {selectedNode.type}
              </span>
            </div>
            <h3 style={{ fontSize: "0.875rem", fontWeight: 700, marginBottom: 4 }}>
              {selectedNode.name}
            </h3>
            <p className="mono" style={{ fontSize: "0.7rem", color: NODE_COLORS[selectedNode.type], marginBottom: 12 }}>
              {selectedNode.id}
            </p>

            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              {Object.entries(selectedNode.properties).map(([k, v]) => (
                <div key={k}>
                  <p style={{ fontSize: "0.65rem", color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 2 }}>
                    {k.replace(/_/g, " ")}
                  </p>
                  <p style={{ fontSize: "0.78rem", color: "var(--text-primary)" }}>{v as string}</p>
                </div>
              ))}
            </div>

            <div style={{ marginTop: 14 }}>
              <p style={{ fontSize: "0.65rem", color: "var(--text-muted)", marginBottom: 6 }}>CONNECTIONS</p>
              {graph.links
                .filter((l) => l.source === selectedNode.id || l.target === selectedNode.id)
                .map((l) => {
                  const otherId = l.source === selectedNode.id ? l.target : l.source;
                  const otherNode = graph.nodes.find((n) => n.id === otherId);
                  return (
                    <div
                      key={l.id}
                      onClick={() => setSelectedNode(otherNode || null)}
                      style={{
                        padding: "5px 8px",
                        borderRadius: 6,
                        marginBottom: 4,
                        background: "rgba(59,130,246,0.06)",
                        border: "1px solid rgba(59,130,246,0.15)",
                        cursor: "pointer",
                      }}
                    >
                      <p style={{ fontSize: "0.65rem", color: "var(--text-muted)" }}>{l.relation}</p>
                      <p style={{ fontSize: "0.75rem", color: "#60a5fa" }}>{otherId}</p>
                    </div>
                  );
                })}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function hexToRgb(hex: string): string {
  const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
  return result
    ? `${parseInt(result[1], 16)}, ${parseInt(result[2], 16)}, ${parseInt(result[3], 16)}`
    : "59, 130, 246";
}
