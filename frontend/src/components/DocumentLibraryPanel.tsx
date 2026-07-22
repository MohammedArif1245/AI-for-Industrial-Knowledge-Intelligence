"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import {
  Upload,
  FileText,
  FileSpreadsheet,
  File,
  Search,
  Tag,
  Trash2,
  RefreshCw,
  Plus,
  CheckCircle,
  AlertCircle,
  Clock,
} from "lucide-react";
import { getDocuments, uploadDocument, deleteDocument, type Document } from "@/lib/api";

const CATEGORIES = [
  "All",
  "Maintenance Log",
  "Inspection Report",
  "SOP",
  "P&ID Excerpt",
  "Regulation",
  "Drawing",
  "Other",
];

function fileIcon(filename: string) {
  const ext = filename.split(".").pop()?.toLowerCase();
  if (ext === "pdf") return <FileText size={16} color="#ef4444" />;
  if (ext === "xlsx" || ext === "xls") return <FileSpreadsheet size={16} color="#10b981" />;
  if (ext === "docx" || ext === "doc") return <FileText size={16} color="#3b82f6" />;
  if (["png", "jpg", "jpeg"].includes(ext ?? "")) return <File size={16} color="#f59e0b" />;
  return <FileText size={16} color="#8b5cf6" />;
}

function StatusBadge({ status }: { status: Document["status"] }) {
  if (status === "Success")
    return (
      <span className="badge badge-success" style={{ display: "flex", alignItems: "center", gap: 3 }}>
        <CheckCircle size={9} /> Indexed
      </span>
    );
  if (status === "Processing")
    return (
      <span className="badge badge-processing" style={{ display: "flex", alignItems: "center", gap: 3 }}>
        <Clock size={9} /> Processing
      </span>
    );
  return (
    <span className="badge badge-error" style={{ display: "flex", alignItems: "center", gap: 3 }}>
      <AlertCircle size={9} /> Error
    </span>
  );
}

export default function DocumentLibraryPanel() {
  const [documents, setDocuments] = useState<Document[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeCategory, setActiveCategory] = useState("All");
  const [searchQuery, setSearchQuery] = useState("");
  const [uploading, setUploading] = useState(false);
  const [showUpload, setShowUpload] = useState(false);
  const [uploadCategory, setUploadCategory] = useState("Maintenance Log");
  const [uploadTags, setUploadTags] = useState("");
  const [dragActive, setDragActive] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const fetchDocs = useCallback(async () => {
    setLoading(true);
    try {
      const docs = await getDocuments();
      setDocuments(docs);
    } catch {
      // silent fail
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchDocs();
    const interval = setInterval(fetchDocs, 5000); // Poll for status updates
    return () => clearInterval(interval);
  }, [fetchDocs]);

  const handleUpload = async (files: FileList | null) => {
    if (!files || files.length === 0) return;
    setUploading(true);
    try {
      for (const file of Array.from(files)) {
        await uploadDocument(file, uploadCategory, uploadTags);
      }
      setShowUpload(false);
      setUploadTags("");
      await fetchDocs();
    } catch (err) {
      alert("Upload failed. Ensure the backend is running.");
    } finally {
      setUploading(false);
    }
  };

  const handleDelete = async (id: number, filename: string) => {
    if (!confirm(`Delete "${filename}"? This will remove it from the knowledge base.`)) return;
    try {
      await deleteDocument(id);
      setDocuments((prev) => prev.filter((d) => d.id !== id));
    } catch {
      alert("Delete failed.");
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDragActive(false);
    handleUpload(e.dataTransfer.files);
  };

  const filtered = documents.filter((d) => {
    const matchCat = activeCategory === "All" || d.category === activeCategory;
    const matchSearch =
      !searchQuery ||
      d.filename.toLowerCase().includes(searchQuery.toLowerCase()) ||
      d.tags.some((t) => t.toLowerCase().includes(searchQuery.toLowerCase()));
    return matchCat && matchSearch;
  });

  const stats = {
    total: documents.length,
    indexed: documents.filter((d) => d.status === "Success").length,
    processing: documents.filter((d) => d.status === "Processing").length,
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
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 12 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <div
              style={{
                width: 36, height: 36, borderRadius: 10,
                background: "rgba(139,92,246,0.15)",
                border: "1px solid rgba(139,92,246,0.3)",
                display: "flex", alignItems: "center", justifyContent: "center",
              }}
            >
              <FileText size={16} color="#a78bfa" />
            </div>
            <div>
              <h2 style={{ fontSize: "0.95rem", fontWeight: 700, color: "var(--text-primary)" }}>Document Library</h2>
              <p style={{ fontSize: "0.72rem", color: "var(--text-muted)" }}>
                {stats.indexed} indexed · {stats.processing} processing · {stats.total} total
              </p>
            </div>
          </div>
          <div style={{ display: "flex", gap: 8 }}>
            <button className="btn-ghost" onClick={fetchDocs} style={{ padding: "6px 10px" }}>
              <RefreshCw size={13} />
            </button>
            <button className="btn-primary" onClick={() => setShowUpload(!showUpload)}>
              <Plus size={13} /> Upload
            </button>
          </div>
        </div>

        {/* Upload Form */}
        {showUpload && (
          <div
            className="fade-in"
            style={{
              background: "rgba(10,15,30,0.8)",
              border: "1px solid var(--border-bright)",
              borderRadius: 10,
              padding: 14,
              marginBottom: 12,
            }}
          >
            <div style={{ display: "flex", gap: 8, marginBottom: 10 }}>
              <select
                value={uploadCategory}
                onChange={(e) => setUploadCategory(e.target.value)}
                className="input-field"
                style={{ flex: 1 }}
              >
                {CATEGORIES.filter((c) => c !== "All").map((c) => (
                  <option key={c} value={c}>{c}</option>
                ))}
              </select>
              <input
                type="text"
                value={uploadTags}
                onChange={(e) => setUploadTags(e.target.value)}
                placeholder="Tags (comma-separated)"
                className="input-field"
                style={{ flex: 1 }}
              />
            </div>
            <div
              onDragOver={(e) => { e.preventDefault(); setDragActive(true); }}
              onDragLeave={() => setDragActive(false)}
              onDrop={handleDrop}
              onClick={() => fileInputRef.current?.click()}
              style={{
                border: `2px dashed ${dragActive ? "rgba(59,130,246,0.6)" : "rgba(59,130,246,0.25)"}`,
                borderRadius: 8,
                padding: "20px",
                textAlign: "center",
                cursor: "pointer",
                background: dragActive ? "rgba(59,130,246,0.08)" : "transparent",
                transition: "all 0.2s",
              }}
            >
              <Upload size={20} color="#3b82f6" style={{ margin: "0 auto 6px" }} />
              <p style={{ fontSize: "0.8rem", color: "var(--text-secondary)" }}>
                {uploading ? "Uploading…" : "Drop files here or click to browse"}
              </p>
              <p style={{ fontSize: "0.7rem", color: "var(--text-muted)", marginTop: 3 }}>
                PDF, DOCX, XLSX, PNG, JPG supported
              </p>
              <input
                ref={fileInputRef}
                type="file"
                multiple
                accept=".pdf,.docx,.xlsx,.xls,.png,.jpg,.jpeg,.txt"
                style={{ display: "none" }}
                onChange={(e) => handleUpload(e.target.files)}
              />
            </div>
          </div>
        )}

        {/* Search & Category Filters */}
        <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
          <div style={{ position: "relative", flex: 1 }}>
            <Search size={13} style={{ position: "absolute", left: 10, top: "50%", transform: "translateY(-50%)", color: "var(--text-muted)" }} />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search documents or tags..."
              className="input-field"
              style={{ paddingLeft: 30 }}
            />
          </div>
        </div>

        <div style={{ display: "flex", gap: 5, marginTop: 8, flexWrap: "wrap" }}>
          {CATEGORIES.map((cat) => (
            <button
              key={cat}
              onClick={() => setActiveCategory(cat)}
              style={{
                padding: "3px 10px",
                borderRadius: 6,
                fontSize: "0.72rem",
                fontWeight: 500,
                border: "1px solid",
                cursor: "pointer",
                transition: "all 0.15s",
                borderColor: activeCategory === cat ? "rgba(59,130,246,0.5)" : "var(--border)",
                background: activeCategory === cat ? "rgba(59,130,246,0.15)" : "transparent",
                color: activeCategory === cat ? "#60a5fa" : "var(--text-muted)",
              }}
            >
              {cat}
            </button>
          ))}
        </div>
      </div>

      {/* Document List */}
      <div style={{ flex: 1, overflowY: "auto", padding: "12px 16px" }}>
        {loading ? (
          <div style={{ textAlign: "center", paddingTop: 40, color: "var(--text-muted)" }}>
            <RefreshCw size={20} style={{ margin: "0 auto 8px", animation: "spin 1s linear infinite" }} />
            <p style={{ fontSize: "0.875rem" }}>Loading documents...</p>
          </div>
        ) : filtered.length === 0 ? (
          <div style={{ textAlign: "center", paddingTop: 40, color: "var(--text-muted)" }}>
            <FileText size={24} style={{ margin: "0 auto 8px", opacity: 0.4 }} />
            <p style={{ fontSize: "0.875rem" }}>No documents found</p>
          </div>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
            {filtered.map((doc) => (
              <div
                key={doc.id}
                className="card fade-in"
                style={{ padding: "10px 12px" }}
              >
                <div style={{ display: "flex", alignItems: "flex-start", gap: 10 }}>
                  <div style={{ marginTop: 1, flexShrink: 0 }}>{fileIcon(doc.filename)}</div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 4 }}>
                      <span
                        style={{
                          fontSize: "0.8rem",
                          fontWeight: 600,
                          color: "var(--text-primary)",
                          overflow: "hidden",
                          textOverflow: "ellipsis",
                          whiteSpace: "nowrap",
                          flex: 1,
                        }}
                      >
                        {doc.filename}
                      </span>
                      <StatusBadge status={doc.status} />
                    </div>
                    <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
                      <span
                        style={{
                          fontSize: "0.68rem",
                          color: "var(--text-muted)",
                          background: "rgba(139,92,246,0.1)",
                          border: "1px solid rgba(139,92,246,0.2)",
                          borderRadius: 4,
                          padding: "1px 6px",
                        }}
                      >
                        {doc.category}
                      </span>
                      {doc.tags.map((tag) => (
                        <span
                          key={tag}
                          style={{
                            fontSize: "0.65rem",
                            color: "var(--text-muted)",
                            display: "flex",
                            alignItems: "center",
                            gap: 2,
                          }}
                        >
                          <Tag size={9} /> {tag}
                        </span>
                      ))}
                    </div>
                  </div>
                  <button
                    onClick={() => handleDelete(doc.id, doc.filename)}
                    style={{
                      background: "transparent",
                      border: "none",
                      cursor: "pointer",
                      color: "var(--text-muted)",
                      padding: 4,
                      borderRadius: 4,
                      flexShrink: 0,
                      transition: "color 0.2s",
                    }}
                    onMouseEnter={(e) => ((e.currentTarget as HTMLElement).style.color = "#ef4444")}
                    onMouseLeave={(e) => ((e.currentTarget as HTMLElement).style.color = "var(--text-muted)")}
                  >
                    <Trash2 size={13} />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
