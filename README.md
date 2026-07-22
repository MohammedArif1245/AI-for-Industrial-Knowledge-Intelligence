# Unified Asset & Operations Brain

### Industrial Knowledge Intelligence Platform

> Hackathon prototype that turns scattered industrial documents into a single queryable AI knowledge layer.

---

## ⚡ Quick Start (2 terminals)

### 1. Backend (FastAPI + RAG)

```bash
cd backend

# Set your Gemini API key in .env
# Edit backend/.env and replace: GEMINI_API_KEY=your_key_here

py -m uvicorn main:app --reload --port 8000
```

The server starts at **http://localhost:8000**. On first boot it:

* Creates the SQLite database
* Generates 15+ synthetic industrial documents
* Indexes them into the ChromaDB vector store
* Seeds the Knowledge Graph & Compliance Gaps

### 2. Frontend (Next.js)

```bash
cd frontend
npm run dev
```

Frontend runs at **http://localhost:3000**

---

## 🔑 Required: Gemini API Key

1. Go to https://aistudio.google.com/app/apikey
2. Create a free API key
3. Open `backend/.env` and replace `your_gemini_api_key_here` with your key
4. Restart the backend server

---

## 🏗️ Architecture

```text
frontend/ (Next.js + Tailwind)
│   src/app/page.tsx         ← Dashboard shell + sidebar
│   src/components/
│       ChatPanel.tsx         ← RAG chat with citations
│       DocumentLibraryPanel  ← Upload, tag, manage docs
│       KnowledgeGraphPanel   ← SVG force-directed graph
│       CompliancePanel       ← Regulatory gap checker
│       AnalyticsDashboardPanel ← Stats + predictive health
│   src/lib/api.ts           ← Typed API client

backend/ (FastAPI + SQLite + ChromaDB)
│   main.py                  ← FastAPI app + all endpoints
│   database.py              ← SQLAlchemy models (SQLite)
│   rag_engine.py            ← Parse → Chunk → Embed → Retrieve → Answer
│   synthetic_generator.py   ← 15+ realistic synthetic documents
│   compliance_checker.py    ← AI-powered compliance audit
│   uploads/                 ← Document storage
│   chroma_db/               ← ChromaDB vector index
│   database.db              ← SQLite DB
```

---

## 📦 Tier Status

| Feature                                               | Tier | Status                    |
| ----------------------------------------------------- | ---- | ------------------------- |
| PDF / DOCX / XLSX / Image parsing                     | T1   | ✅ Built                   |
| RAG pipeline (chunk → embed → retrieve → answer)      | T1   | ✅ Built                   |
| ChatGPT-style chat with citations & confidence score  | T1   | ✅ Built                   |
| 15+ realistic synthetic industrial documents          | T1   | ✅ Built                   |
| Knowledge Graph (Equipment, Dept, Standard, Incident) | T2   | ✅ Built                   |
| Compliance Gap Checker (AI + rule-based)              | T2   | ✅ Built                   |
| Document Library (upload, tag, category filter)       | T2   | ✅ Built                   |
| Predictive Maintenance signals                        | T3   | ✅ Built                   |
| Analytics Dashboard                                   | T3   | ✅ Built                   |
| Auth / RBAC                                           | T3   | ⏭️ Skipped (out of scope) |
| Notifications, email alerts                           | —    | ⏭️ Explicitly excluded    |

---

## 🎯 Demo Script (3–5 min)

### Single-document lookup

> *"What is the current certification status of Boiler-203?"*

### Cross-document reasoning

> *"What does the Factory Act require for boilers, and does Boiler-203 comply?"*

### Citation + confidence

> *"What startup procedure should I follow for Pump-101?"*
> → Shows source document, page number, confidence %

### Compliance gap

> Navigate to Compliance Audit → See: Boiler annual inspection overdue

### Knowledge graph

> Navigate to Knowledge Graph → Click on BOILER-203 → See connections to TURBINE-301, Factory Act, Power Dept

---

## 🛠️ Tech Stack

* **Frontend**: Next.js 15 + TypeScript + Tailwind CSS
* **Backend**: FastAPI + SQLAlchemy + SQLite
* **Vector Store**: ChromaDB (persistent, local)
* **LLM & Embeddings**: Google Gemini 2.5 Flash + text-embedding-004
* **Document Parsing**: pypdf, python-docx, openpyxl, Gemini OCR for scanned images
