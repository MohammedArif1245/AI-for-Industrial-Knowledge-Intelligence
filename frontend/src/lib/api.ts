// Centralized API client for all backend calls

const API_BASE = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8001";

export interface Document {
  id: number;
  filename: string;
  category: string;
  tags: string[];
  status: "Processing" | "Success" | "Error";
  upload_time: string;
}

export interface Citation {
  document_name: string;
  page: number;
  content: string;
}

export interface ChatMessage {
  id: number;
  role: "user" | "assistant";
  content: string;
  citations: Citation[];
  timestamp: string;
  confidence_score?: number;
}

export interface KnowledgeNode {
  id: string;
  name: string;
  type: "Equipment" | "Department" | "Standard" | "Incident";
  properties: Record<string, string>;
}

export interface KnowledgeLink {
  id: number;
  source: string;
  target: string;
  relation: string;
}

export interface KnowledgeGraph {
  nodes: KnowledgeNode[];
  links: KnowledgeLink[];
}

export interface ComplianceGap {
  id: number;
  title: string;
  severity: "High" | "Medium" | "Low";
  category: string;
  regulation: string;
  offending_doc: string;
  description: string;
  recommendation: string;
  status: "Open" | "Resolved";
  timestamp: string;
}

export interface PredictiveAlert {
  equipment_id: string;
  date: string;
  metric: string;
  value: number;
  unit: string;
  threshold: number;
  status: "Critical" | "Normal";
  description: string;
}

export interface PredictiveSummary {
  equipment_id: string;
  risk_level: "High" | "Medium" | "Low";
  critical_anomalies: number;
  total_maintenance_events: number;
  alerts: PredictiveAlert[];
}

export interface Analytics {
  stats: {
    total_documents: number;
    total_chunks: number;
    total_queries: number;
    open_gaps: number;
  };
  categories_distribution: Record<string, number>;
  most_queried_topics: { topic: string; count: number }[];
}

// ---- API Functions ----

export async function getDocuments(): Promise<Document[]> {
  const res = await fetch(`${API_BASE}/api/documents`);
  if (!res.ok) throw new Error("Failed to fetch documents");
  return res.json();
}

export async function uploadDocument(
  file: File,
  category: string,
  tags: string
): Promise<{ message: string; document: Document }> {
  const formData = new FormData();
  formData.append("file", file);
  formData.append("category", category);
  formData.append("tags", tags);
  const res = await fetch(`${API_BASE}/api/upload`, {
    method: "POST",
    body: formData,
  });
  if (!res.ok) throw new Error(`Upload failed: ${res.statusText}`);
  return res.json();
}

export async function deleteDocument(id: number): Promise<void> {
  const res = await fetch(`${API_BASE}/api/documents/${id}/delete`, {
    method: "POST",
  });
  if (!res.ok) throw new Error("Delete failed");
}

export async function getChatHistory(sessionId: string): Promise<ChatMessage[]> {
  const res = await fetch(`${API_BASE}/api/chat/history?session_id=${sessionId}`);
  if (!res.ok) throw new Error("Failed to fetch chat history");
  return res.json();
}

export async function sendChatMessage(
  query: string,
  sessionId: string
): Promise<{ answer: string; confidence_score: number; citations: Citation[] }> {
  const res = await fetch(`${API_BASE}/api/chat`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ query, session_id: sessionId }),
  });
  if (!res.ok) throw new Error("Chat query failed");
  return res.json();
}

export async function getKnowledgeGraph(): Promise<KnowledgeGraph> {
  const res = await fetch(`${API_BASE}/api/knowledge-graph`);
  if (!res.ok) throw new Error("Failed to fetch knowledge graph");
  return res.json();
}

export async function getComplianceGaps(): Promise<ComplianceGap[]> {
  const res = await fetch(`${API_BASE}/api/compliance`);
  if (!res.ok) throw new Error("Failed to fetch compliance gaps");
  return res.json();
}

export async function triggerComplianceAudit(): Promise<{ gaps_count: number }> {
  const res = await fetch(`${API_BASE}/api/compliance/audit`, { method: "POST" });
  if (!res.ok) throw new Error("Audit failed");
  return res.json();
}

export async function getPredictiveMaintenance(): Promise<PredictiveSummary[]> {
  const res = await fetch(`${API_BASE}/api/predictive-maintenance`);
  if (!res.ok) throw new Error("Failed to fetch predictive maintenance");
  return res.json();
}

export async function getAnalytics(): Promise<Analytics> {
  const res = await fetch(`${API_BASE}/api/analytics`);
  if (!res.ok) throw new Error("Failed to fetch analytics");
  return res.json();
}
