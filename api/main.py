import os
import json
import asyncio
from contextlib import asynccontextmanager
from typing import AsyncIterator

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import StreamingResponse
from sse_starlette.sse import EventSourceResponse
from pydantic import BaseModel
from dotenv import load_dotenv

load_dotenv()


@asynccontextmanager
async def lifespan(app: FastAPI) -> AsyncIterator[None]:
    from agent.agent import create_agent
    app.state.agent_executor = create_agent()
    yield


app = FastAPI(title="FinSim API", lifespan=lifespan)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000"],
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


class ChatRequest(BaseModel):
    message: str
    history: list[dict] = []


@app.post("/api/chat")
async def chat(req: ChatRequest):
    async def generate():
        yield json.dumps({"type": "error", "message": "Not yet implemented"})
    return EventSourceResponse(generate())
