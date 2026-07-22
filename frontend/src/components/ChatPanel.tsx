"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import {
  Send,
  Bot,
  User,
  FileText,
  ChevronDown,
  ChevronUp,
  Zap,
  MessageSquare,
  Sparkles,
} from "lucide-react";
import {
  sendChatMessage,
  getChatHistory,
  type ChatMessage,
  type Citation,
} from "@/lib/api";

const SESSION_ID = "demo_session_" + Math.floor(Date.now() / 3600000);

const SUGGESTED_QUERIES = [
  "What is the inspection status of Boiler-203?",
  "What are the startup steps for Pump-101?",
  "Compare safety incidents across departments",
  "What does OISD-116 require for fire hydrant testing?",
  "What compliance gaps exist in the facility?",
  "Explain the steam loop between Boiler-203 and Turbine-301",
];

function ConfidenceBar({ score }: { score: number }) {
  const color =
    score >= 75 ? "#10b981" : score >= 50 ? "#f59e0b" : "#ef4444";
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 8 }}>
      <span style={{ fontSize: "0.7rem", color: "var(--text-muted)", flexShrink: 0 }}>
        Confidence
      </span>
      <div className="confidence-bar" style={{ flex: 1 }}>
        <div
          className="confidence-fill"
          style={{ width: `${score}%`, background: color }}
        />
      </div>
      <span
        className="mono"
        style={{ fontSize: "0.7rem", color, minWidth: 28, textAlign: "right" }}
      >
        {score}%
      </span>
    </div>
  );
}

function CitationCard({ citation, index }: { citation: Citation; index: number }) {
  const [expanded, setExpanded] = useState(false);
  return (
    <div
      style={{
        marginTop: 6,
        background: "rgba(59,130,246,0.06)",
        border: "1px solid rgba(59,130,246,0.2)",
        borderRadius: 8,
        overflow: "hidden",
      }}
    >
      <button
        onClick={() => setExpanded(!expanded)}
        style={{
          width: "100%",
          display: "flex",
          alignItems: "center",
          gap: 8,
          padding: "6px 10px",
          background: "transparent",
          border: "none",
          cursor: "pointer",
          color: "var(--text-secondary)",
          fontSize: "0.72rem",
        }}
      >
        <FileText size={12} color="#60a5fa" />
        <span style={{ flex: 1, textAlign: "left", color: "#93c5fd", fontWeight: 500 }}>
          [{index + 1}] {citation.document_name} — p.{citation.page}
        </span>
        {expanded ? (
          <ChevronUp size={12} />
        ) : (
          <ChevronDown size={12} />
        )}
      </button>
      {expanded && (
        <div
          style={{
            padding: "6px 10px 8px",
            borderTop: "1px solid rgba(59,130,246,0.15)",
            fontSize: "0.72rem",
            color: "var(--text-secondary)",
            lineHeight: 1.55,
            fontStyle: "italic",
          }}
        >
          {citation.content}
        </div>
      )}
    </div>
  );
}

function MessageBubble({ msg }: { msg: ChatMessage }) {
  const isUser = msg.role === "user";

  if (isUser) {
    return (
      <div
        className="fade-in"
        style={{
          display: "flex",
          justifyContent: "flex-end",
          marginBottom: 16,
        }}
      >
        <div style={{ display: "flex", gap: 8, maxWidth: "80%", alignItems: "flex-start" }}>
          <div
            style={{
              background: "linear-gradient(135deg, #2563eb, #1d4ed8)",
              borderRadius: "12px 12px 2px 12px",
              padding: "10px 14px",
              color: "white",
              fontSize: "0.875rem",
              lineHeight: 1.6,
              boxShadow: "0 2px 12px rgba(37,99,235,0.3)",
            }}
          >
            {msg.content}
          </div>
          <div
            style={{
              width: 30,
              height: 30,
              borderRadius: 8,
              background: "rgba(59,130,246,0.2)",
              border: "1px solid rgba(59,130,246,0.3)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              flexShrink: 0,
              marginTop: 2,
            }}
          >
            <User size={14} color="#60a5fa" />
          </div>
        </div>
      </div>
    );
  }

  return (
    <div
      className="fade-in"
      style={{ display: "flex", gap: 10, marginBottom: 20, maxWidth: "90%" }}
    >
      <div
        style={{
          width: 30,
          height: 30,
          borderRadius: 8,
          background: "linear-gradient(135deg, rgba(6,182,212,0.2), rgba(139,92,246,0.2))",
          border: "1px solid rgba(6,182,212,0.3)",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          flexShrink: 0,
          marginTop: 2,
        }}
      >
        <Bot size={14} color="#06b6d4" />
      </div>

      <div style={{ flex: 1 }}>
        <div
          style={{
            background: "var(--bg-card)",
            border: "1px solid var(--border)",
            borderRadius: "2px 12px 12px 12px",
            padding: "12px 14px",
          }}
        >
          <p
            style={{
              fontSize: "0.875rem",
              lineHeight: 1.7,
              color: "var(--text-primary)",
              whiteSpace: "pre-wrap",
            }}
          >
            {msg.content}
          </p>

          {msg.confidence_score !== undefined && (
            <ConfidenceBar score={msg.confidence_score} />
          )}
        </div>

        {msg.citations && msg.citations.length > 0 && (
          <div style={{ marginTop: 4 }}>
            {msg.citations.map((c, i) => (
              <CitationCard key={i} citation={c} index={i} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

export default function ChatPanel() {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [loadingHistory, setLoadingHistory] = useState(true);
  const bottomRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    getChatHistory(SESSION_ID)
      .then(setMessages)
      .catch(() => setMessages([]))
      .finally(() => setLoadingHistory(false));
  }, []);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, loading]);

  const handleSend = useCallback(
    async (query?: string) => {
      const text = (query ?? input).trim();
      if (!text || loading) return;

      const userMsg: ChatMessage = {
        id: Date.now(),
        role: "user",
        content: text,
        citations: [],
        timestamp: new Date().toISOString(),
      };
      setMessages((prev) => [...prev, userMsg]);
      setInput("");
      setLoading(true);

      try {
        const res = await sendChatMessage(text, SESSION_ID);
        const assistantMsg: ChatMessage = {
          id: Date.now() + 1,
          role: "assistant",
          content: res.answer,
          citations: res.citations,
          confidence_score: res.confidence_score,
          timestamp: new Date().toISOString(),
        };
        setMessages((prev) => [...prev, assistantMsg]);
      } catch (err) {
        const errMsg: ChatMessage = {
          id: Date.now() + 1,
          role: "assistant",
          content:
            "⚠️ The chat request could not reach the backend. Please ensure the FastAPI server is running and that the API key is configured correctly.",
          citations: [],
          timestamp: new Date().toISOString(),
        };
        setMessages((prev) => [...prev, errMsg]);
      } finally {
        setLoading(false);
        inputRef.current?.focus();
      }
    },
    [input, loading]
  );

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
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
          display: "flex",
          alignItems: "center",
          gap: 12,
          background: "rgba(13,20,41,0.95)",
          flexShrink: 0,
        }}
      >
        <div
          style={{
            width: 36,
            height: 36,
            borderRadius: 10,
            background: "linear-gradient(135deg, rgba(6,182,212,0.2), rgba(139,92,246,0.2))",
            border: "1px solid rgba(6,182,212,0.35)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          <MessageSquare size={16} color="#06b6d4" />
        </div>
        <div>
          <h2 style={{ fontSize: "0.95rem", fontWeight: 700, color: "var(--text-primary)" }}>
            Operations Brain Chat
          </h2>
          <p style={{ fontSize: "0.72rem", color: "var(--text-muted)" }}>
            RAG-powered · Cross-document reasoning · Source citations
          </p>
        </div>
        <div style={{ marginLeft: "auto", display: "flex", alignItems: "center", gap: 6 }}>
          <div className="pulse-dot green" />
          <span style={{ fontSize: "0.72rem", color: "var(--accent-green)" }}>Live</span>
        </div>
      </div>

      {/* Messages */}
      <div style={{ flex: 1, overflowY: "auto", padding: "20px 20px 0" }}>
        {loadingHistory ? (
          <div style={{ textAlign: "center", color: "var(--text-muted)", paddingTop: 60 }}>
            <Sparkles size={24} style={{ margin: "0 auto 8px" }} />
            <p style={{ fontSize: "0.875rem" }}>Loading conversation...</p>
          </div>
        ) : messages.length === 0 ? (
          <div style={{ paddingTop: 20 }}>
            <div style={{ textAlign: "center", marginBottom: 28 }}>
              <div
                style={{
                  width: 56,
                  height: 56,
                  borderRadius: 16,
                  background:
                    "linear-gradient(135deg, rgba(59,130,246,0.2), rgba(6,182,212,0.2))",
                  border: "1px solid rgba(59,130,246,0.3)",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  margin: "0 auto 12px",
                }}
              >
                <Bot size={24} color="#3b82f6" />
              </div>
              <h3
                style={{
                  fontSize: "1rem",
                  fontWeight: 700,
                  marginBottom: 4,
                }}
                className="gradient-text"
              >
                Unified Asset & Operations Brain
              </h3>
              <p style={{ fontSize: "0.8rem", color: "var(--text-muted)", maxWidth: 360, margin: "0 auto" }}>
                Ask anything across all your industrial documents — maintenance logs, SOPs,
                P&IDs, regulations, and inspection reports.
              </p>
            </div>

            <div style={{ marginBottom: 12 }}>
              <p
                style={{
                  fontSize: "0.75rem",
                  color: "var(--text-muted)",
                  marginBottom: 8,
                  display: "flex",
                  alignItems: "center",
                  gap: 4,
                }}
              >
                <Zap size={12} />
                Suggested queries
              </p>
              <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                {SUGGESTED_QUERIES.map((q, i) => (
                  <button
                    key={i}
                    onClick={() => handleSend(q)}
                    style={{
                      textAlign: "left",
                      background: "rgba(59,130,246,0.05)",
                      border: "1px solid rgba(59,130,246,0.15)",
                      borderRadius: 8,
                      padding: "8px 12px",
                      color: "var(--text-secondary)",
                      fontSize: "0.8rem",
                      cursor: "pointer",
                      transition: "all 0.2s",
                    }}
                    onMouseEnter={(e) => {
                      (e.target as HTMLElement).style.background =
                        "rgba(59,130,246,0.12)";
                      (e.target as HTMLElement).style.color = "var(--text-primary)";
                    }}
                    onMouseLeave={(e) => {
                      (e.target as HTMLElement).style.background =
                        "rgba(59,130,246,0.05)";
                      (e.target as HTMLElement).style.color = "var(--text-secondary)";
                    }}
                  >
                    {q}
                  </button>
                ))}
              </div>
            </div>
          </div>
        ) : (
          <>
            {messages.map((msg) => (
              <MessageBubble key={msg.id} msg={msg} />
            ))}
            {loading && (
              <div
                className="fade-in"
                style={{ display: "flex", gap: 10, marginBottom: 20 }}
              >
                <div
                  style={{
                    width: 30,
                    height: 30,
                    borderRadius: 8,
                    background:
                      "linear-gradient(135deg, rgba(6,182,212,0.2), rgba(139,92,246,0.2))",
                    border: "1px solid rgba(6,182,212,0.3)",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    flexShrink: 0,
                  }}
                >
                  <Bot size={14} color="#06b6d4" />
                </div>
                <div
                  style={{
                    background: "var(--bg-card)",
                    border: "1px solid var(--border)",
                    borderRadius: "2px 12px 12px 12px",
                    padding: "12px 16px",
                    display: "flex",
                    gap: 5,
                    alignItems: "center",
                  }}
                >
                  {[0, 1, 2].map((i) => (
                    <div
                      key={i}
                      className="typing-dot"
                      style={{
                        width: 7,
                        height: 7,
                        borderRadius: "50%",
                        background: "#06b6d4",
                        animationDelay: `${i * 0.2}s`,
                      }}
                    />
                  ))}
                </div>
              </div>
            )}
            <div ref={bottomRef} />
          </>
        )}
      </div>

      {/* Input Area */}
      <div
        style={{
          padding: "14px 16px",
          borderTop: "1px solid var(--border)",
          background: "rgba(13,20,41,0.95)",
          flexShrink: 0,
        }}
      >
        <div
          style={{
            display: "flex",
            gap: 10,
            alignItems: "flex-end",
            background: "rgba(10,15,30,0.6)",
            border: `1px solid ${loading ? "rgba(59,130,246,0.4)" : "var(--border)"}`,
            borderRadius: 12,
            padding: "10px 12px",
            transition: "border-color 0.2s",
          }}
        >
          <textarea
            ref={inputRef}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Ask about any equipment, procedure, regulation, or incident..."
            disabled={loading}
            rows={1}
            style={{
              flex: 1,
              background: "transparent",
              border: "none",
              outline: "none",
              color: "var(--text-primary)",
              fontFamily: "Inter, sans-serif",
              fontSize: "0.875rem",
              lineHeight: 1.5,
              resize: "none",
              maxHeight: 120,
              overflowY: "auto",
            }}
          />
          <button
            onClick={() => handleSend()}
            disabled={!input.trim() || loading}
            className="btn-primary"
            style={{ padding: "6px 12px", borderRadius: 8, flexShrink: 0 }}
          >
            <Send size={14} />
          </button>
        </div>
        <p style={{ fontSize: "0.68rem", color: "var(--text-muted)", marginTop: 6, textAlign: "center" }}>
          Enter · Send &nbsp;|&nbsp; Shift+Enter · Newline &nbsp;|&nbsp; Answers include source citations & confidence scores
        </p>
      </div>
    </div>
  );
}
