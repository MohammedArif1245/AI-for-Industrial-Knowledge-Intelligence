import os
import json
import math
import numpy as np
from typing import List, Dict, Any, Tuple
from pydantic import BaseModel
from google import genai
from google.genai import types
from dotenv import load_dotenv
import pypdf
import docx
import openpyxl
import pandas as pd
import traceback

load_dotenv()

# Global variables for fallback vector store
use_fallback = False
fallback_vectors = []  # List of dicts: {"id": str, "embedding": list, "text": str, "metadata": dict}

# Initialize ChromaDB Client
db_client = None
collection = None

try:
    import chromadb
    db_client = chromadb.PersistentClient(path="./chroma_db")
    # Get or create the collection
    collection = db_client.get_or_create_collection(name="industrial_brain")
    print("ChromaDB collection initialized successfully.")
except Exception as e:
    print(f"Error initializing ChromaDB: {e}. Falling back to NumPy-based vector store.")
    use_fallback = True


def get_genai_client():
    api_key = os.environ.get("GEMINI_API_KEY", "")
    if not api_key:
        # Check if we can find it in a .env file or local configs
        if os.path.exists(".env"):
            with open(".env", "r") as f:
                for line in f:
                    if line.startswith("GEMINI_API_KEY="):
                        api_key = line.split("=")[1].strip()
                        os.environ["GEMINI_API_KEY"] = api_key
                        break
    if not api_key:
        raise ValueError("GEMINI_API_KEY is not set. Please set it in a .env file or environment variables.")
    return genai.Client(api_key=api_key)


# --- Extraction Functions ---

def extract_pdf(file_path: str) -> List[Dict[str, Any]]:
    """Extracts text from PDF, page by page. Falls back to Gemini OCR for scanned PDFs."""
    pages_content = []
    try:
        with open(file_path, "rb") as f:
            reader = pypdf.PdfReader(f)
            num_pages = len(reader.pages)
            for page_num in range(num_pages):
                page = reader.pages[page_num]
                text = page.extract_text() or ""
                # If text is very short/empty, we assume it's scanned and run Gemini OCR on this page
                if len(text.strip()) < 100:
                    print(f"Page {page_num + 1} of {file_path} seems scanned or has low text density. Running Gemini OCR.")
                    try:
                        client = get_genai_client()
                        # Read the page image or send page bytes directly if possible.
                        # Since we can send the whole PDF page to Gemini multimodal API, we send page bytes.
                        # In standard Gemini SDK, we can send the PDF file and specify the prompt.
                        f.seek(0)
                        pdf_bytes = f.read()
                        prompt = f"This is page {page_num + 1} of a PDF document. OCR and extract all text, procedures, safety instructions, tables, and equipment names. Maintain layout."
                        response = client.models.generate_content(
                            model='gemini-2.0-flash',
                            contents=[
                                types.Part.from_bytes(
                                    data=pdf_bytes,
                                    mime_type='application/pdf',
                                ),
                                prompt
                            ]
                        )
                        text = response.text or ""
                    except Exception as ocr_err:
                        print(f"Gemini OCR failed for page {page_num + 1}: {ocr_err}")
                
                if text.strip():
                    pages_content.append({
                        "page": page_num + 1,
                        "text": text
                    })
    except Exception as e:
        print(f"Error reading PDF {file_path}: {e}")
        traceback.print_exc()
    return pages_content


def extract_docx(file_path: str) -> List[Dict[str, Any]]:
    """Extracts text from DOCX document."""
    pages_content = []
    try:
        doc = docx.Document(file_path)
        text_runs = []
        for i, para in enumerate(doc.paragraphs):
            if para.text.strip():
                text_runs.append(para.text)
        
        # Word documents don't have strict physical pages. We'll group paragraphs into "logical pages"
        # of roughly 2500 characters each.
        full_text = "\n\n".join(text_runs)
        page_size = 2500
        total_len = len(full_text)
        num_pages = math.ceil(total_len / page_size) if total_len > 0 else 1
        
        for p in range(num_pages):
            start = p * page_size
            end = min(start + page_size, total_len)
            pages_content.append({
                "page": p + 1,
                "text": full_text[start:end]
            })
    except Exception as e:
        print(f"Error reading DOCX {file_path}: {e}")
    return pages_content


def extract_xlsx(file_path: str) -> List[Dict[str, Any]]:
    """Extracts tables and content from XLSX and formats as Markdown."""
    pages_content = []
    try:
        xls = pd.ExcelFile(file_path)
        for sheet_idx, sheet_name in enumerate(xls.sheet_names):
            df = pd.read_excel(xls, sheet_name=sheet_name)
            # Convert sheet to markdown table
            markdown_table = df.to_markdown(index=False)
            pages_content.append({
                "page": sheet_idx + 1,
                "text": f"### Sheet: {sheet_name}\n\n{markdown_table}"
            })
    except Exception as e:
        print(f"Error reading XLSX {file_path}: {e}")
    return pages_content


def extract_image(file_path: str) -> List[Dict[str, Any]]:
    """Extracts text from scanned image (PNG, JPG) using Gemini Multimodal."""
    pages_content = []
    try:
        client = get_genai_client()
        with open(file_path, "rb") as f:
            img_bytes = f.read()
        
        # Detect mime type
        ext = os.path.splitext(file_path)[1].lower()
        mime_type = "image/png" if ext == ".png" else "image/jpeg"
        
        prompt = "Extract all text, procedures, safety instructions, tables, and equipment names from this image. Keep the layout and structure."
        response = client.models.generate_content(
            model='gemini-2.0-flash',
            contents=[
                types.Part.from_bytes(
                    data=img_bytes,
                    mime_type=mime_type,
                ),
                prompt
            ]
        )
        text = response.text or ""
        pages_content.append({
            "page": 1,
            "text": text
        })
    except Exception as e:
        print(f"Error running OCR on image {file_path}: {e}")
    return pages_content


def extract_document_text(file_path: str) -> List[Dict[str, Any]]:
    """Determines file type and calls the appropriate parser."""
    ext = os.path.splitext(file_path)[1].lower()
    if ext == ".pdf":
        return extract_pdf(file_path)
    elif ext in [".docx", ".doc"]:
        return extract_docx(file_path)
    elif ext in [".xlsx", ".xls"]:
        return extract_xlsx(file_path)
    elif ext in [".png", ".jpg", ".jpeg"]:
        return extract_image(file_path)
    elif ext in [".txt", ".md", ".csv", ".log"]:
        try:
            with open(file_path, "r", encoding="utf-8") as f:
                content = f.read()
            return [{"page": 1, "text": content}]
        except Exception as e:
            print(f"Error reading text file {file_path}: {e}")
    return []


# --- Chunking & Vector Functions ---

def chunk_text(text: str, chunk_size: int = 1000, overlap: int = 200) -> List[str]:
    """Splits a document text into overlapping chunks."""
    chunks = []
    words = text.split()
    current_chunk = []
    current_len = 0
    
    for word in words:
        current_chunk.append(word)
        current_len += len(word) + 1  # Add 1 for space
        if current_len >= chunk_size:
            chunks.append(" ".join(current_chunk))
            # Keep overlap words
            overlap_words = current_chunk[-math.ceil(overlap / 6):] # Estimate 6 chars/word
            current_chunk = list(overlap_words)
            current_len = sum(len(w) + 1 for w in current_chunk)
            
    if current_chunk:
        chunks.append(" ".join(current_chunk))
        
    return chunks


def get_embedding(text: str) -> List[float]:
    """Generates embedding vector for a given text chunk using Gemini gemini-embedding-001."""
    try:
        client = get_genai_client()
        result = client.models.embed_content(
            model="gemini-embedding-001",
            contents=text
        )
        # Handle different response shapes from SDK
        if hasattr(result, 'embeddings') and isinstance(result.embeddings, list) and len(result.embeddings) > 0:
            emb = result.embeddings[0]
            if hasattr(emb, 'values'):
                return emb.values
        if hasattr(result, 'embedding') and hasattr(result.embedding, 'values'):
            return result.embedding.values
        # Some SDK versions return a flat list
        if hasattr(result, 'embeddings') and hasattr(result.embeddings, 'values'):
            return result.embeddings.values
        raise ValueError(f"Unexpected embedding response shape: {type(result)}")
    except Exception as e:
        print(f"Embedding error: {e}")
        # Return a zero vector as fallback (3072-dim for gemini-embedding-001)
        return [0.0] * 3072


def add_document_to_vector_store(doc_id: int, file_path: str, filename: str, category: str):
    """Parses, chunks, embeds, and stores a document in ChromaDB or the fallback store."""
    global fallback_vectors, use_fallback
    from database import SessionLocal, Chunk
    
    pages = extract_document_text(file_path)
    if not pages:
        print(f"No text extracted from document {filename}.")
        return 0
        
    db = SessionLocal()
    total_chunks = 0
    
    try:
        # Process each page
        for page_data in pages:
            page_num = page_data["page"]
            page_text = page_data["text"]
            
            chunks = chunk_text(page_text)
            for idx, chunk_content in enumerate(chunks):
                chunk_id = f"doc_{doc_id}_page_{page_num}_chunk_{idx}"
                embedding = get_embedding(chunk_content)
                
                metadata = {
                    "document_id": doc_id,
                    "filename": filename,
                    "category": category,
                    "page": page_num,
                    "chunk_index": idx
                }
                
                # Insert chunk into SQL database
                db_chunk = Chunk(
                    document_id=doc_id,
                    content=chunk_content,
                    page_num=page_num,
                    chunk_index=idx
                )
                db.add(db_chunk)
                
                if not use_fallback and collection is not None:
                    try:
                        collection.add(
                            ids=[chunk_id],
                            embeddings=[embedding],
                            metadatas=[metadata],
                            documents=[chunk_content]
                        )
                    except Exception as e:
                        print(f"Chroma add error: {e}. Switching to NumPy fallback vector store.")
                        use_fallback = True
                
                # Always append to fallback memory if use_fallback is active or as a backup
                fallback_vectors.append({
                    "id": chunk_id,
                    "embedding": embedding,
                    "text": chunk_content,
                    "metadata": metadata
                })
                total_chunks += 1
        db.commit()
    except Exception as e:
        db.rollback()
        print(f"Error saving chunks to SQL database: {e}")
    finally:
        db.close()
            
    print(f"Ingested {filename} (ID: {doc_id}): {total_chunks} chunks indexed.")
    return total_chunks


def delete_document_from_vector_store(doc_id: int):
    """Deletes all chunks associated with a document ID."""
    global fallback_vectors, use_fallback
    
    if not use_fallback and collection is not None:
        try:
            # Delete by metadata filter
            collection.delete(where={"document_id": doc_id})
        except Exception as e:
            print(f"Chroma delete error: {e}")
            
    # Clean up fallback store
    fallback_vectors = [v for v in fallback_vectors if v["metadata"]["document_id"] != doc_id]


# --- Cosine Similarity Search ---

def cosine_similarity(a: List[float], b: List[float]) -> float:
    """Computes cosine similarity between two vectors."""
    dot_product = sum(x * y for x, y in zip(a, b))
    norm_a = math.sqrt(sum(x * x for x in a))
    norm_b = math.sqrt(sum(x * x for x in b))
    if norm_a == 0 or norm_b == 0:
        return 0.0
    return dot_product / (norm_a * norm_b)


def retrieve_relevant_chunks(query: str, top_k: int = 5) -> List[Dict[str, Any]]:
    """Retrieves top_k relevant chunks from vector store."""
    global fallback_vectors, use_fallback
    
    query_vector = get_embedding(query)
    
    results = []
    
    if not use_fallback and collection is not None:
        try:
            chroma_results = collection.query(
                query_embeddings=[query_vector],
                n_results=top_k
            )
            # Format results
            if chroma_results and chroma_results["documents"]:
                for idx in range(len(chroma_results["documents"][0])):
                    results.append({
                        "id": chroma_results["ids"][0][idx],
                        "text": chroma_results["documents"][0][idx],
                        "metadata": chroma_results["metadatas"][0][idx],
                        "distance": chroma_results["distances"][0][idx] if "distances" in chroma_results else None
                    })
                return results
        except Exception as e:
            print(f"Chroma query error: {e}. Switching query to fallback NumPy store.")
            use_fallback = True
            
    # Fallback NumPy search
    if not fallback_vectors:
        return []
        
    similarities = []
    for item in fallback_vectors:
        sim = cosine_similarity(query_vector, item["embedding"])
        similarities.append((sim, item))
        
    # Sort by similarity descending
    similarities.sort(key=lambda x: x[0], reverse=True)
    
    for sim, item in similarities[:top_k]:
        results.append({
            "id": item["id"],
            "text": item["text"],
            "metadata": item["metadata"],
            "score": sim
        })
        
    return results


# --- RAG QA with Citation and Confidence Score ---

class CitationDetail(BaseModel):
    document_name: str
    page: int
    content: str


class RAGResponseSchema(BaseModel):
    answer: str
    confidence_score: int  # 0 to 100
    citations: List[CitationDetail]


def query_rag_pipeline(query: str, chat_history: List[Dict[str, str]] = None) -> Dict[str, Any]:
    """Runs the RAG pipeline: retrieves chunks and calls Gemini-2.5-flash with structured schema."""
    try:
        # 1. Retrieve top 5 relevant chunks
        chunks = retrieve_relevant_chunks(query, top_k=5)
        
        if not chunks:
            return {
                "answer": "No reference documents found in the database. Please upload industrial documents to query the Unified Operations Brain.",
                "confidence_score": 0,
                "citations": []
            }
            
        # 2. Format context for prompt
        context_str = ""
        for i, c in enumerate(chunks):
            meta = c["metadata"]
            context_str += f"[Source {i+1}]: Document: {meta['filename']}, Page: {meta['page']}\n"
            context_str += f"Content: {c['text']}\n\n"
            
        # 3. Build message history if present
        messages_prompt = ""
        if chat_history:
            messages_prompt = "Conversation History:\n"
            for h in chat_history:
                messages_prompt += f"{h['role'].capitalize()}: {h['content']}\n"
            messages_prompt += "\n"
            
        # 4. Prompt Gemini with structured schema
        system_instruction = (
            "You are the Industrial Operations Brain assistant. Your goal is to answer operational, "
            "safety, regulation, maintenance, or drawing questions based ONLY on the provided document sources.\n"
            "Guidelines:\n"
            "- Rely strictly on the provided Sources. If the sources do not contain the answer, state that you cannot find the answer and set a low confidence score.\n"
            "- Be precise, technical, and professional. Mention specific codes, standards, equipment IDs (e.g., Pump-101) where applicable.\n"
            "- For each factual statement, cite the document name and page number. Place citations inside the citations list in the JSON response.\n"
            "- Provide a confidence score (0 to 100) representing how fully the sources cover the user's question."
        )
        
        prompt = (
            f"{messages_prompt}"
            f"Sources:\n{context_str}\n"
            f"Question: {query}\n\n"
            "Generate your answer strictly adhering to the schema, with comprehensive citations matching the sources used."
        )
        
        client = get_genai_client()
        response = client.models.generate_content(
            model='gemini-3.5-flash',
            contents=prompt,
            config=types.GenerateContentConfig(
                system_instruction=system_instruction,
                response_mime_type="application/json",
                response_schema=RAGResponseSchema,
                temperature=0.1
            )
        )
        
        # Parse JSON output from Gemini
        try:
            result = json.loads(response.text)
            return result
        except Exception as json_err:
            print(f"Failed to parse Gemini RAG JSON output: {json_err}. Text: {response.text}")
            return {
                "answer": response.text or "Error parsing answer.",
                "confidence_score": 50,
                "citations": [{"document_name": c["metadata"]["filename"], "page": c["metadata"]["page"], "content": c["text"][:150]} for c in chunks[:2]]
            }
            
    except Exception as e:
        print(f"RAG Pipeline Error: {e}")
        traceback.print_exc()
        return {
            "answer": f"Error executing query: {str(e)}",
            "confidence_score": 0,
            "citations": []
        }
