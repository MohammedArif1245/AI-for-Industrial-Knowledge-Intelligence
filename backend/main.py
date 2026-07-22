import os
import json
import shutil
from datetime import datetime
from typing import List, Dict, Any, Optional
from fastapi import FastAPI, UploadFile, File, Form, Depends, HTTPException, BackgroundTasks
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy.orm import Session
import traceback

from database import init_db, get_db, Document, Chunk, ChatHistory, KnowledgeNode, KnowledgeEdge, ComplianceGap
from synthetic_generator import generate_synthetic_data
from rag_engine import add_document_to_vector_store, delete_document_from_vector_store, query_rag_pipeline
from compliance_checker import run_compliance_audit

app = FastAPI(title="Industrial Knowledge Intelligence API")

# Configure CORS for Next.js development server
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # For hackathon, allow all; change to specific domain in production
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Initialize database and seed data on startup
@app.on_event("startup")
def startup_event():
    init_db()
    db = next(get_db())
    try:
        generate_synthetic_data(db)
    except Exception as e:
        print(f"Error seeding database: {e}")
    finally:
        db.close()


def process_uploaded_document_task(doc_id: int, file_path: str, filename: str, category: str):
    """Background task to extract text, chunk, embed, and index an uploaded document."""
    db = next(get_db())
    try:
        num_chunks = add_document_to_vector_store(
            doc_id=doc_id,
            file_path=file_path,
            filename=filename,
            category=category
        )
        
        # Update DB status
        doc = db.query(Document).filter(Document.id == doc_id).first()
        if doc:
            if num_chunks > 0:
                doc.status = "Success"
            else:
                doc.status = "Error"
            db.commit()
            
        # Re-run compliance audit in background if it's an inspection or regulation
        if category in ["Regulation", "Inspection Report", "Maintenance Log"]:
            run_compliance_audit(db)
            
    except Exception as e:
        print(f"Background indexing task failed for doc {doc_id}: {e}")
        doc = db.query(Document).filter(Document.id == doc_id).first()
        if doc:
            doc.status = "Error"
            db.commit()
    finally:
        db.close()


# --- API Endpoints ---

@app.get("/api/health")
def health_check():
    return {"status": "healthy", "time": datetime.utcnow()}


@app.get("/api/documents")
def get_documents(db: Session = Depends(get_db)):
    docs = db.query(Document).order_by(Document.upload_time.desc()).all()
    return [{
        "id": d.id,
        "filename": d.filename,
        "file_path": d.file_path,
        "category": d.category,
        "tags": [t.strip() for t in d.tags.split(",") if t.strip()] if d.tags else [],
        "status": d.status,
        "upload_time": d.upload_time.isoformat()
    } for d in docs]


@app.post("/api/upload")
def upload_document(
    background_tasks: BackgroundTasks,
    file: UploadFile = File(...),
    category: str = Form(...),
    tags: str = Form(""),
    db: Session = Depends(get_db)
):
    try:
        # Create uploads directory if not exists
        os.makedirs("./uploads", exist_ok=True)
        
        file_path = os.path.join("./uploads", file.filename)
        
        # Save file to disk
        with open(file_path, "wb") as buffer:
            shutil.copyfileobj(file.file, buffer)
            
        # Create Document record
        doc = Document(
            filename=file.filename,
            file_path=file_path,
            category=category,
            tags=tags,
            status="Processing"
        )
        db.add(doc)
        db.commit()
        db.refresh(doc)
        
        # Run indexing in background
        background_tasks.add_task(
            process_uploaded_document_task,
            doc_id=doc.id,
            file_path=file_path,
            filename=file.filename,
            category=category
        )
        
        return {
            "message": "File uploaded successfully. Processing started in background.",
            "document": {
                "id": doc.id,
                "filename": doc.filename,
                "category": doc.category,
                "status": doc.status
            }
        }
    except Exception as e:
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=f"Failed to upload file: {str(e)}")


@app.post("/api/documents/{doc_id}/delete")
def delete_document(doc_id: int, db: Session = Depends(get_db)):
    doc = db.query(Document).filter(Document.id == doc_id).first()
    if not doc:
        raise HTTPException(status_code=404, detail="Document not found")
        
    try:
        # 1. Remove file from disk
        if os.path.exists(doc.file_path):
            os.remove(doc.file_path)
            
        # 2. Delete from vector store
        delete_document_from_vector_store(doc_id)
        
        # 3. Delete from SQLite DB (will cascade delete chunks)
        db.delete(doc)
        db.commit()
        
        # 4. Trigger compliance audit update
        run_compliance_audit(db)
        
        return {"message": "Document deleted successfully"}
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to delete document: {str(e)}")


@app.post("/api/chat")
def chat_query(data: Dict[str, Any], db: Session = Depends(get_db)):
    query = data.get("query")
    session_id = data.get("session_id", "default_session")
    
    if not query:
        raise HTTPException(status_code=400, detail="Query is required")
        
    try:
        # Get last 5 messages from session history
        history_records = db.query(ChatHistory).filter(
            ChatHistory.session_id == session_id
        ).order_by(ChatHistory.timestamp.desc()).limit(5).all()
        
        # Revert history list so it is chronological
        history_records.reverse()
        
        chat_history = [
            {"role": h.role, "content": h.content} for h in history_records
        ]
        
        # Execute RAG query
        rag_response = query_rag_pipeline(query, chat_history)
        
        # Save User Message to History
        user_msg = ChatHistory(
            session_id=session_id,
            role="user",
            content=query,
            citations="[]"
        )
        db.add(user_msg)
        
        # Save Assistant Message to History
        citations_json = json.dumps(rag_response.get("citations", []))
        assistant_msg = ChatHistory(
            session_id=session_id,
            role="assistant",
            content=rag_response.get("answer", ""),
            citations=citations_json
        )
        db.add(assistant_msg)
        
        db.commit()
        
        return {
            "answer": rag_response.get("answer"),
            "confidence_score": rag_response.get("confidence_score", 0),
            "citations": rag_response.get("citations", [])
        }
    except Exception as e:
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=f"Chat pipeline error: {str(e)}")


@app.get("/api/chat/history")
def get_chat_history(session_id: str = "default_session", db: Session = Depends(get_db)):
    history = db.query(ChatHistory).filter(
        ChatHistory.session_id == session_id
    ).order_by(ChatHistory.timestamp.asc()).all()
    
    return [{
        "id": h.id,
        "role": h.role,
        "content": h.content,
        "citations": json.loads(h.citations) if h.citations else [],
        "timestamp": h.timestamp.isoformat()
    } for h in history]


@app.get("/api/knowledge-graph")
def get_knowledge_graph(db: Session = Depends(get_db)):
    nodes = db.query(KnowledgeNode).all()
    edges = db.query(KnowledgeEdge).all()
    
    return {
        "nodes": [{
            "id": n.id,
            "name": n.name,
            "type": n.type,
            "properties": json.loads(n.properties) if n.properties else {}
        } for n in nodes],
        "links": [{
            "id": e.id,
            "source": e.source,
            "target": e.target,
            "relation": e.relation
        } for e in edges]
    }


@app.get("/api/compliance")
def get_compliance_gaps(db: Session = Depends(get_db)):
    gaps = db.query(ComplianceGap).order_by(ComplianceGap.timestamp.desc()).all()
    return [{
        "id": g.id,
        "title": g.title,
        "severity": g.severity,
        "category": g.category,
        "regulation": g.regulation,
        "offending_doc": g.offending_doc,
        "description": g.description,
        "recommendation": g.recommendation,
        "status": g.status,
        "timestamp": g.timestamp.isoformat()
    } for g in gaps]


@app.post("/api/compliance/audit")
def trigger_compliance_audit(db: Session = Depends(get_db)):
    try:
        gaps = run_compliance_audit(db)
        return {
            "message": "Compliance audit completed successfully.",
            "gaps_count": len(gaps),
            "gaps": [{
                "id": g.id,
                "title": g.title,
                "severity": g.severity,
                "category": g.category,
                "regulation": g.regulation,
                "offending_doc": g.offending_doc,
                "description": g.description,
                "recommendation": g.recommendation,
                "status": g.status
            } for g in gaps]
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Audit failed: {str(e)}")


@app.get("/api/predictive-maintenance")
def get_predictive_maintenance(db: Session = Depends(get_db)):
    """Tier 3: Basic frequency/trend detection on equipment maintenance logs to flag anomalies."""
    logs = db.query(Document).filter(Document.category == "Maintenance Log").all()
    
    equipment_alerts = []
    
    # We scan the text of maintenance logs to identify equipment maintenance entries
    for log in logs:
        if not os.path.exists(log.file_path):
            continue
            
        with open(log.file_path, "r", encoding="utf-8") as f:
            content = f.read()
            
        # Analyze content of log
        lines = content.split("\n")
        current_eq = None
        for line in lines:
            if "EQUIPMENT TAG:" in line:
                current_eq = line.split("EQUIPMENT TAG:")[1].split("(")[0].strip()
            
            # Simple rule-based trend parser
            if line.startswith("-") and current_eq:
                # Format: - YYYY-MM-DD: Description
                parts = line[1:].split(":")
                if len(parts) >= 2:
                    date_str = parts[0].strip()
                    desc = ":".join(parts[1:]).strip()
                    
                    try:
                        date_obj = datetime.strptime(date_str, "%Y-%m-%d")
                        
                        # Add telemetry points
                        # Look for symptoms like "vibration", "temperature", "seal leak"
                        if "vibration" in desc.lower():
                            # Extract mm/s if exists
                            val = 1.8
                            if "mm/s" in desc.lower():
                                try:
                                    # Find number before mm/s
                                    words = desc.lower().split()
                                    idx = [w for w, word in enumerate(words) if "mm/s" in word]
                                    if idx:
                                        val = float(words[idx[0]-1].replace("(", "").replace(")", ""))
                                except:
                                    pass
                            equipment_alerts.append({
                                "equipment_id": current_eq,
                                "date": date_str,
                                "metric": "Vibration Amplitude",
                                "value": val,
                                "unit": "mm/s",
                                "threshold": 4.5,
                                "status": "Critical" if val > 4.5 else "Normal",
                                "description": desc
                            })
                        elif "temperature" in desc.lower() or "bearing heating" in desc.lower() or "spike" in desc.lower():
                            val = 54.0
                            if "deg c" in desc.lower():
                                try:
                                    words = desc.lower().split()
                                    idx = [w for w, word in enumerate(words) if "deg" in word or "c" in word]
                                    if idx:
                                        # find first numerical word
                                        for word in reversed(words[:idx[0]]):
                                            word_cleaned = word.replace("(", "").replace(")", "").replace("deg", "")
                                            if word_cleaned.replace(".", "", 1).isdigit():
                                                val = float(word_cleaned)
                                                break
                                except:
                                    pass
                            equipment_alerts.append({
                                "equipment_id": current_eq,
                                "date": date_str,
                                "metric": "Bearing Temperature",
                                "value": val,
                                "unit": "°C",
                                "threshold": 65.0,
                                "status": "Critical" if val > 65.0 else "Normal",
                                "description": desc
                            })
                        elif "leak" in desc.lower():
                            equipment_alerts.append({
                                "equipment_id": current_eq,
                                "date": date_str,
                                "metric": "Seal Integrity",
                                "value": 15.0 if "15 drops" in desc.lower() else 3.0,
                                "unit": "drops/min",
                                "threshold": 10.0,
                                "status": "Critical" if "15 drops" in desc.lower() else "Normal",
                                "description": desc
                            })
                    except Exception as parse_err:
                        # Ignore parsing errors on date
                        pass

    # Group anomalies and compute risk levels
    equipment_risk = {}
    for alert in equipment_alerts:
        eq = alert["equipment_id"]
        if eq not in equipment_risk:
            equipment_risk[eq] = {"critical_count": 0, "total_events": 0, "alerts": []}
        
        equipment_risk[eq]["total_events"] += 1
        if alert["status"] == "Critical":
            equipment_risk[eq]["critical_count"] += 1
        equipment_risk[eq]["alerts"].append(alert)

    # Compile output
    summary = []
    for eq, data in equipment_risk.items():
        risk_level = "Low"
        if data["critical_count"] >= 2:
            risk_level = "High"
        elif data["critical_count"] == 1 or data["total_events"] >= 3:
            risk_level = "Medium"
            
        summary.append({
            "equipment_id": eq,
            "risk_level": risk_level,
            "critical_anomalies": data["critical_count"],
            "total_maintenance_events": data["total_events"],
            "alerts": sorted(data["alerts"], key=lambda x: x["date"], reverse=True)
        })
        
    return summary


@app.get("/api/analytics")
def get_analytics(db: Session = Depends(get_db)):
    """Tier 3: Return system stats, document categories chart, and query counts for dashboards."""
    total_docs = db.query(Document).count()
    total_chunks = db.query(Chunk).count()
    total_queries = db.query(ChatHistory).filter(ChatHistory.role == "user").count()
    open_gaps = db.query(ComplianceGap).filter(ComplianceGap.status == "Open").count()
    
    # Categories distribution
    cat_dist = {}
    docs = db.query(Document).all()
    for d in docs:
        cat_dist[d.category] = cat_dist.get(d.category, 0) + 1
        
    # Find most-queried topics (extract equipment IDs from queries)
    equipment_tags = ["PUMP-101", "BOILER-203", "TURBINE-301", "COMP-102", "HX-105"]
    query_counts = {tag: 0 for tag in equipment_tags}
    
    queries = db.query(ChatHistory).filter(ChatHistory.role == "user").all()
    for q in queries:
        for tag in equipment_tags:
            if tag.lower() in q.content.lower():
                query_counts[tag] += 1
                
    return {
        "stats": {
            "total_documents": total_docs,
            "total_chunks": total_chunks,
            "total_queries": total_queries,
            "open_gaps": open_gaps
        },
        "categories_distribution": cat_dist,
        "most_queried_topics": [{"topic": k, "count": v} for k, v in query_counts.items() if v > 0]
    }
