import asyncio
import json
from typing import Any, AsyncIterator

from langchain.callbacks.base import AsyncCallbackHandler

# Tool name → SSE section type
_TOOL_SECTION_MAP = {
    "fetch_stock_data":              "stock",
    "run_monte_carlo_simulation":    "monte_carlo",
    "calculate_risk_metrics":        "risk",
    "analyze_option":                "options",
    "analyze_portfolio":             "portfolio",
    "run_stress_test_tool":          "stress_test",
    "compute_efficient_frontier_tool": "frontier",
    "get_financial_news":            "news",
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
