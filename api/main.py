import os
import asyncio
from contextlib import asynccontextmanager
from typing import AsyncIterator

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
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
    """Stream typed SSE events for a chat message."""
    from api.callback_handler import AnalystCallbackHandler
    callback = AnalystCallbackHandler()
    agent_executor = app.state.agent_executor

    async def generate() -> AsyncIterator[str]:
        # Build conversation context from history
        context_lines = []
        for turn in req.history[-6:]:  # last 3 exchanges max
            role = turn.get("role", "")
            content = turn.get("content", "")
            if role == "user":
                context_lines.append(f"Previous question: {content}")
            elif role == "assistant":
                context_lines.append(f"Previous answer: {content[:200]}...")  # truncate long answers

        message = req.message
        if context_lines:
            context_str = "\n".join(context_lines)
            message = f"[Conversation context]\n{context_str}\n\n[Current question]\n{req.message}"

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
