import os
import json
from pydantic import BaseModel
from sqlalchemy.orm import Session
from database import Document, ComplianceGap
from google import genai
from google.genai import types
from dotenv import load_dotenv

load_dotenv()

class GapDetailSchema(BaseModel):
    title: str
    severity: str  # "High", "Medium", "Low"
    category: str  # e.g., "Inspection", "Safety Check", "Equiment Check"
    regulation: str  # e.g., "Factory Act 1948, Section 31"
    offending_doc: str  # Filename
    description: str
    recommendation: str

class ComplianceAuditSchema(BaseModel):
    gaps: list[GapDetailSchema]

def get_genai_client():
    api_key = os.environ.get("GEMINI_API_KEY", "")
    if not api_key:
        if os.path.exists(".env"):
            with open(".env", "r") as f:
                for line in f:
                    if line.startswith("GEMINI_API_KEY="):
                        api_key = line.split("=")[1].strip()
                        os.environ["GEMINI_API_KEY"] = api_key
                        break
    if not api_key:
        raise ValueError("GEMINI_API_KEY is not set.")
    return genai.Client(api_key=api_key)

def run_compliance_audit(db: Session) -> list[ComplianceGap]:
    """Runs a compliance audit by comparing regulations against inspection/maintenance reports using Gemini."""
    try:
        client = get_genai_client()
    except Exception as e:
        print(f"Skipping compliance audit: LLM client error: {e}")
        # Return existing gaps
        return db.query(ComplianceGap).all()

    # 1. Fetch all regulations and inspection reports
    regulations = db.query(Document).filter(Document.category == "Regulation").all()
    inspections = db.query(Document).filter(Document.category.in_(["Inspection Report", "Maintenance Log"])).all()

    if not regulations or not inspections:
        print("Not enough documents to run a compliance audit. Regulations or Inspections are missing.")
        return db.query(ComplianceGap).all()

    # 2. Build context
    context = "=== SAFETY REGULATIONS AND STANDARDS ===\n\n"
    for r in regulations:
        context += f"Document: {r.filename}\n"
        if os.path.exists(r.file_path):
            with open(r.file_path, "r", encoding="utf-8") as f:
                context += f.read()
        context += "\n--------------------------------------\n\n"

    context += "=== INSPECTION AND MAINTENANCE REPORTS ===\n\n"
    for ins in inspections:
        context += f"Document: {ins.filename}\n"
        if os.path.exists(ins.file_path):
            with open(ins.file_path, "r", encoding="utf-8") as f:
                context += f.read()
        context += "\n--------------------------------------\n\n"

    # 3. Formulate Prompt
    system_instruction = (
        "You are an Industrial Compliance Auditor. Your task is to compare the provided Safety Regulations/Standards "
        "against the latest Inspection and Maintenance Reports. Identify any compliance gaps.\n"
        "A compliance gap exists if:\n"
        "1. An inspection is overdue based on the frequency required in the regulations (assume the current date is July 2026).\n"
        "2. An inspection report mentions a failure or an issue that is not yet marked as repaired or resolved.\n"
        "3. A required safety test or parameter is missing from the reports.\n"
        "Return the findings in a structured JSON list of gaps."
    )

    prompt = (
        f"Context:\n{context}\n\n"
        "Please conduct the compliance audit and list all detected gaps according to the schema."
    )

    try:
        response = client.models.generate_content(
            model='gemini-2.0-flash',
            contents=prompt,
            config=types.GenerateContentConfig(
                system_instruction=system_instruction,
                response_mime_type="application/json",
                response_schema=ComplianceAuditSchema,
                temperature=0.1
            )
        )

        audit_result = json.loads(response.text)
        new_gaps = audit_result.get("gaps", [])

        # 4. Update the DB: Delete old gaps and insert new ones
        db.query(ComplianceGap).delete()
        
        db_gaps = []
        for gap in new_gaps:
            db_gap = ComplianceGap(
                title=gap["title"],
                severity=gap["severity"],
                category=gap["category"],
                regulation=gap["regulation"],
                offending_doc=gap["offending_doc"],
                description=gap["description"],
                recommendation=gap["recommendation"],
                status="Open"
            )
            db.add(db_gap)
            db_gaps.append(db_gap)
        
        db.commit()
        print(f"Compliance audit complete. Identified {len(db_gaps)} compliance gaps.")
        return db_gaps

    except Exception as e:
        print(f"Error running compliance audit LLM call: {e}")
        # Return what we currently have in DB as fallback
        return db.query(ComplianceGap).all()
