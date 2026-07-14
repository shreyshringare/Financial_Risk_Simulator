import os
import asyncio
import time
import pathlib
from collections import OrderedDict
from contextlib import asynccontextmanager
from typing import Any, AsyncIterator

from fastapi import FastAPI, Request, HTTPException, UploadFile, File, Form
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse, FileResponse
from sse_starlette.sse import EventSourceResponse
from pydantic import BaseModel, Field, field_validator
from dotenv import load_dotenv

load_dotenv()

# Rate limit: 20 requests per minute per IP on /api/chat
_RATE_LIMIT = int(os.getenv("RATE_LIMIT", "20"))
_RATE_WINDOW = 60  # seconds
_BUCKET_MAX = 10_000  # max unique IPs tracked (LRU eviction beyond this)
_buckets: OrderedDict = OrderedDict()  # ip -> {"count": int, "reset_at": float}

# Optional API key (set API_KEY= in .env to enable, leave unset to disable)
_API_KEY = os.getenv("API_KEY")


_REPORT_MAX_AGE = 86400  # seconds (24 h)


def _cleanup_old_reports() -> None:
    """Delete report files older than 24 hours."""
    cutoff = time.time() - _REPORT_MAX_AGE
    for dir_name in ("reports", "powerbi_data"):
        p = pathlib.Path(dir_name)
        if not p.exists():
            continue
        for f in p.iterdir():
            if f.is_file() and f.stat().st_mtime < cutoff:
                try:
                    f.unlink()
                except OSError:
                    pass


@asynccontextmanager
async def lifespan(app: FastAPI) -> AsyncIterator[None]:
    from agent.agent import build_llm
    from agent.tools.base import get_vectorstore
    app.state.llm = build_llm()
    # Pre-warm vectorstore so first request is not slow
    await asyncio.to_thread(get_vectorstore)
    yield


app = FastAPI(title="FinSim API", lifespan=lifespan)

def _allowed_origins() -> list[str]:
    raw = os.getenv("ALLOWED_ORIGINS", "http://localhost:3000")
    return [o.strip() for o in raw.split(",") if o.strip()]


app.add_middleware(
    CORSMiddleware,
    allow_origins=_allowed_origins(),
    allow_methods=["GET", "POST"],
    allow_headers=["*"],
)


def _model_name() -> str:
    if os.getenv("GROQ_API_KEY"):
        return "groq/llama-3.3-70b-versatile"
    return "openai/gpt-4o"


@app.get("/api/health")
async def health():
    return {"status": "ok", "model": _model_name()}


_EXPORT_DIRS = ["reports", "powerbi_data"]

@app.get("/api/download/{filename}")
async def download_file(filename: str, request: Request):
    # Same API-key guard as /api/chat when key is configured
    if _API_KEY:
        key = request.headers.get("X-API-Key", "")
        if key != _API_KEY:
            raise HTTPException(status_code=401, detail="Missing or invalid X-API-Key header.")
    safe = pathlib.Path(filename).name  # strip any path traversal
    if not safe or safe.startswith("."):
        raise HTTPException(status_code=400, detail="Invalid filename.")
    # Prune stale reports on each download request (lightweight, async-safe)
    await asyncio.to_thread(_cleanup_old_reports)
    for dir_name in _EXPORT_DIRS:
        path = pathlib.Path(dir_name) / safe
        if path.exists() and path.is_file():
            return FileResponse(
                path=str(path),
                filename=safe,
                media_type="application/octet-stream",
            )
    raise HTTPException(status_code=404, detail="File not found or expired.")


@app.get("/api/suggestions")
async def suggestions():
    from api.suggestions import build_suggestions
    return await asyncio.to_thread(build_suggestions)


@app.post("/api/upload")
async def upload_document(
    request: Request,
    file: UploadFile = File(...),
    session_id: str = Form(...),
):
    """Upload a document (PDF/DOCX/TXT/MD/CSV) to be used as context for this session."""
    if _API_KEY:
        key = request.headers.get("X-API-Key", "")
        if key != _API_KEY:
            raise HTTPException(status_code=401, detail="Missing or invalid X-API-Key header.")

    suffix = pathlib.Path(file.filename or "").suffix.lower()
    if suffix not in _ALLOWED_UPLOAD_SUFFIXES:
        raise HTTPException(
            status_code=415,
            detail=f"Unsupported file type '{suffix}'. Allowed: {', '.join(sorted(_ALLOWED_UPLOAD_SUFFIXES))}",
        )

    content = await file.read()
    if len(content) > _UPLOAD_MAX_BYTES:
        raise HTTPException(status_code=413, detail="File too large. Maximum size is 10 MB.")
    if not content:
        raise HTTPException(status_code=400, detail="File is empty.")

    from rag.document_store import ingest_document
    try:
        chunks = await asyncio.to_thread(ingest_document, session_id, file.filename or "upload", content)
    except ValueError as e:
        raise HTTPException(status_code=422, detail=str(e))

    return {"session_id": session_id, "filename": file.filename, "chunks": chunks}


@app.delete("/api/session/{session_id}")
async def delete_session(session_id: str, request: Request):
    """Remove all uploaded documents for a session."""
    if _API_KEY:
        key = request.headers.get("X-API-Key", "")
        if key != _API_KEY:
            raise HTTPException(status_code=401, detail="Missing or invalid X-API-Key header.")
    from rag.document_store import delete_session_docs
    await asyncio.to_thread(delete_session_docs, session_id)
    return {"deleted": True}


_MAX_HISTORY_TURNS = 10
_VALID_ROLES = {"user", "assistant"}
_UPLOAD_MAX_BYTES = 10 * 1024 * 1024  # 10 MB
_ALLOWED_UPLOAD_SUFFIXES = {".pdf", ".docx", ".txt", ".md", ".csv"}


class ChatRequest(BaseModel):
    message: str = Field(max_length=2000)
    history: list[dict[str, Any]] = []
    session_id: str | None = None

    @field_validator("message")
    @classmethod
    def message_not_blank(cls, v: str) -> str:
        if not v.strip():
            raise ValueError("message must not be blank or whitespace-only")
        return v

    @field_validator("history")
    @classmethod
    def validate_history(cls, turns: list[dict[str, Any]]) -> list[dict[str, Any]]:
        if len(turns) > _MAX_HISTORY_TURNS:
            turns = turns[-_MAX_HISTORY_TURNS:]
        for turn in turns:
            role = turn.get("role", "")
            content = turn.get("content", "")
            if role not in _VALID_ROLES:
                raise ValueError(f"history turn role must be 'user' or 'assistant', got '{role}'")
            if not isinstance(content, str) or not content.strip():
                raise ValueError("history turn content must be a non-empty string")
        return turns


@app.post("/api/chat")
async def chat(req: ChatRequest, request: Request):
    """Stream typed SSE events for a chat message."""
    # — API key check (if API_KEY is set in env) —
    if _API_KEY:
        key = request.headers.get("X-API-Key", "")
        if key != _API_KEY:
            raise HTTPException(status_code=401, detail="Missing or invalid X-API-Key header.")

    # — Rate limiting per IP —
    ip = request.client.host if request.client else "unknown"
    now = time.time()

    # LRU-bounded rate bucket: move-to-end on access, evict oldest when over capacity
    if ip in _buckets:
        _buckets.move_to_end(ip)
    else:
        _buckets[ip] = {"count": 0, "reset_at": 0.0}
        if len(_buckets) > _BUCKET_MAX:
            _buckets.popitem(last=False)  # evict LRU entry

    bucket = _buckets[ip]
    if now > bucket["reset_at"]:
        bucket["count"] = 0
        bucket["reset_at"] = now + _RATE_WINDOW
    bucket["count"] += 1
    if bucket["count"] > _RATE_LIMIT:
        raise HTTPException(
            status_code=429,
            detail=f"Rate limit: {_RATE_LIMIT} requests/{_RATE_WINDOW}s. Try again shortly."
        )

    from api.callback_handler import AnalystCallbackHandler
    from agent.agent import make_executor

    callback = AnalystCallbackHandler()
    # Fresh executor per request — no shared state between concurrent users
    agent_executor = make_executor(app.state.llm)

    # Build enriched message from history + uploaded session documents
    context_lines = []
    for turn in req.history[-10:]:
        role = turn.get("role", "")
        content = str(turn.get("content", ""))
        if role == "user":
            context_lines.append(f"Previous question: {content}")
        elif role == "assistant":
            context_lines.append(f"Previous answer: {content[:200]}...")
    message = req.message

    # Retrieve relevant chunks from user-uploaded documents if session has any
    if req.session_id:
        try:
            from rag.document_store import query_session_docs
            doc_context = await asyncio.to_thread(query_session_docs, req.session_id, req.message, 3)
            if doc_context:
                context_lines.insert(0, f"[User document context]\n{doc_context}\n[End of document context]")
        except Exception:
            pass  # document retrieval failure is non-fatal

    if context_lines:
        message = "[Conversation context]\n" + "\n".join(context_lines) + "\n\n[Current question]\n" + req.message

    async def generate() -> AsyncIterator[str]:
        async def run() -> None:
            try:
                await agent_executor.ainvoke(
                    {"input": message},
                    config={"callbacks": [callback]},
                )
            except Exception as exc:
                await callback._put({"type": "error", "message": str(exc)})
                await callback.queue.put(None)

        task = asyncio.create_task(run())
        try:
            async for event_str in callback.aiter():
                yield event_str
            await task
        except asyncio.CancelledError:
            task.cancel()
            raise
        finally:
            if not task.done():
                task.cancel()

    return EventSourceResponse(generate())
