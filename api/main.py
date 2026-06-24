import os
import json
import asyncio
from contextlib import asynccontextmanager
from typing import AsyncIterator, Any

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from sse_starlette.sse import EventSourceResponse
from pydantic import BaseModel
from dotenv import load_dotenv
from langchain.callbacks.base import AsyncCallbackHandler

load_dotenv()

# Tool name → SSE section type
_TOOL_SECTION_MAP = {
    "fetch_stock_data": "stock",
    "run_monte_carlo_simulation": "monte_carlo",
    "calculate_risk_metrics": "risk",
}


class AnalystCallbackHandler(AsyncCallbackHandler):
    """Intercepts LangChain events and pushes typed SSE events to self.queue."""

    def __init__(self) -> None:
        super().__init__()
        self.queue: asyncio.Queue[str | None] = asyncio.Queue()

    async def _put(self, event: dict) -> None:
        await self.queue.put(json.dumps(event))

    async def on_llm_new_token(self, token: str, **kwargs: Any) -> None:
        if token:
            await self._put({"type": "token", "token": token})

    async def on_tool_end(self, output: str, name: str = "", **kwargs: Any) -> None:
        section = _TOOL_SECTION_MAP.get(name)
        if not section:
            return
        try:
            data = json.loads(output)
        except (json.JSONDecodeError, TypeError):
            data = {"raw": str(output)}
        if "error" not in data:
            await self._put({"type": "section", "section": section, "data": data})

    async def on_chain_end(self, outputs: dict, **kwargs: Any) -> None:
        # Only the outermost AgentExecutor chain has "output" key.
        # Sub-chains (LLM calls, tool chains) have different keys — ignore them.
        if "output" in outputs:
            await self._put({"type": "section", "section": "caveats", "data": {}})
            await self._put({"type": "done"})
            await self.queue.put(None)  # poison pill

    async def on_chain_error(self, error: Exception, **kwargs: Any) -> None:
        await self._put({"type": "error", "message": str(error)})
        await self.queue.put(None)

    async def aiter(self) -> AsyncIterator[str]:
        while True:
            item = await self.queue.get()
            if item is None:
                break
            yield item


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
    callback = AnalystCallbackHandler()
    agent_executor = app.state.agent_executor

    async def generate() -> AsyncIterator[str]:
        async def run() -> None:
            try:
                await agent_executor.ainvoke(
                    {"input": req.message},
                    config={"callbacks": [callback]},
                )
            except Exception as exc:
                await callback._put({"type": "error", "message": str(exc)})
                await callback.queue.put(None)

        task = asyncio.create_task(run())
        async for event_str in callback.aiter():
            yield event_str
        await task

    return EventSourceResponse(generate())
