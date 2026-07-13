import os
import asyncio
import time
import pathlib
from collections import defaultdict
from contextlib import asynccontextmanager
from typing import AsyncIterator

from fastapi import FastAPI, Request, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse, FileResponse
from sse_starlette.sse import EventSourceResponse
from pydantic import BaseModel
from dotenv import load_dotenv

load_dotenv()

# Rate limit: 20 requests per minute per IP on /api/chat
_RATE_LIMIT = int(os.getenv("RATE_LIMIT", "20"))
_RATE_WINDOW = 60  # seconds
_buckets: dict = defaultdict(lambda: {"count": 0, "reset_at": 0.0})

# Optional API key (set API_KEY= in .env to enable, leave unset to disable)
_API_KEY = os.getenv("API_KEY")


@asynccontextmanager
async def lifespan(app: FastAPI) -> AsyncIterator[None]:
    from agent.agent import build_llm
    app.state.llm = build_llm()
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
async def download_file(filename: str):
    safe = pathlib.Path(filename).name  # strip any path traversal
    if not safe or safe.startswith("."):
        raise HTTPException(status_code=400, detail="Invalid filename.")
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


class ChatRequest(BaseModel):
    message: str
    history: list[dict] = []


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

    # Build enriched message from history
    context_lines = []
    for turn in req.history[-6:]:
        role = turn.get("role", "")
        content = str(turn.get("content", ""))
        if role == "user":
            context_lines.append(f"Previous question: {content}")
        elif role == "assistant":
            context_lines.append(f"Previous answer: {content[:200]}...")
    message = req.message
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
