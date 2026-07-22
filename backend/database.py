import os
import json
from datetime import datetime
from sqlalchemy import create_engine, Column, Integer, String, Text, DateTime, ForeignKey
from sqlalchemy.ext.declarative import declarative_base
from sqlalchemy.orm import sessionmaker, relationship

DATABASE_URL = "sqlite:///./database.db"

engine = create_engine(DATABASE_URL, connect_args={"check_same_thread": False})
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
Base = declarative_base()

class Document(Base):
    __tablename__ = "documents"

    id = Column(Integer, primary_key=True, index=True)
    filename = Column(String, index=True)
    file_path = Column(String)
    category = Column(String, index=True)  # e.g., "Maintenance Log", "P&ID Excerpt", "SOP", "Regulation", "Inspection Report"
    tags = Column(String, default="")  # Comma-separated tags
    status = Column(String, default="Processing")  # "Processing", "Success", "Error"
    upload_time = Column(DateTime, default=datetime.utcnow)
    
    chunks = relationship("Chunk", back_populates="document", cascade="all, delete-orphan")

class Chunk(Base):
    __tablename__ = "chunks"

    id = Column(Integer, primary_key=True, index=True)
    document_id = Column(Integer, ForeignKey("documents.id"))
    content = Column(Text)
    page_num = Column(Integer, default=1)
    chunk_index = Column(Integer)

    document = relationship("Document", back_populates="chunks")

class ChatHistory(Base):
    __tablename__ = "chat_history"

    id = Column(Integer, primary_key=True, index=True)
    session_id = Column(String, index=True)
    role = Column(String)  # "user" or "assistant"
    content = Column(Text)
    citations = Column(Text, default="[]")  # JSON string containing list of dicts: [{"filename": "...", "page": 1, "content": "..."}]
    timestamp = Column(DateTime, default=datetime.utcnow)

class KnowledgeNode(Base):
    __tablename__ = "knowledge_nodes"

    id = Column(String, primary_key=True, index=True)  # Unique ID (e.g., "PUMP-101", "BOILER-203", "SAFETY-STANDARD-12")
    name = Column(String)
    type = Column(String, index=True)  # "Equipment", "Department", "Standard", "Incident"
    properties = Column(Text, default="{}")  # JSON string of attributes

class KnowledgeEdge(Base):
    __tablename__ = "knowledge_edges"

    id = Column(Integer, primary_key=True, index=True)
    source = Column(String, ForeignKey("knowledge_nodes.id"))
    target = Column(String, ForeignKey("knowledge_nodes.id"))
    relation = Column(String)  # e.g., "LOCATED_IN", "GOVERNED_BY", "INVOLVED_IN"

class ComplianceGap(Base):
    __tablename__ = "compliance_gaps"

    id = Column(Integer, primary_key=True, index=True)
    title = Column(String)
    severity = Column(String)  # "High", "Medium", "Low"
    category = Column(String)  # e.g., "Maintenance", "Inspection", "SOP compliance"
    regulation = Column(String)  # e.g., "Factory Act Section 21"
    offending_doc = Column(String)  # Document that shows the gap (e.g., Boiler Inspection Report)
    description = Column(Text)
    recommendation = Column(Text)
    status = Column(String, default="Open")  # "Open", "Resolved"
    timestamp = Column(DateTime, default=datetime.utcnow)

def init_db():
    Base.metadata.create_all(bind=engine)

def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
