# Code Conventions

## Naming

| Scope | Convention | Examples |
|-------|-----------|---------|
| Python files | `snake_case` | `monte_carlo.py`, `risk_metrics.py`, `knowledge_base.py` |
| Python functions | `snake_case` | `run_monte_carlo`, `calculate_var`, `fetch_prices` |
| TypeScript files | `PascalCase` (components), `camelCase` (utils) | `MonteCarloCard.tsx`, `sseClient.ts`, `riskUtils.ts` |
| TypeScript components | `PascalCase` | `QueryBar`, `ReportArea`, `VerdictCard` |
| React event handlers | `camelCase` inline | standard Next.js/React conventions |

## Tool Pattern (`agent/tools.py`)

All agent tools follow a strict pattern:
- Decorated with `@tool` from `langchain.tools`
- Return type: always `str` (JSON-encoded dict or plain text)
- Error handling: `try/except` → `return json.dumps({"error": "..."})`
- Registered in `ALL_TOOLS` list at `agent/tools.py:250`
- Tool description string doubles as the LLM's usage hint — kept concise

```python
@tool
def my_tool(param: str) -> str:
    """One-line description the LLM reads to decide when to call this."""
    try:
        # ... work ...
        return json.dumps({"key": value})
    except Exception as e:
        return json.dumps({"error": str(e)})
```

## Async Pattern (`api/main.py`)

- `AsyncCallbackHandler` subclass (`AnalystCallbackHandler`) for LangChain events
- `asyncio.Queue[str | None]` as the SSE event buffer
- `None` used as poison-pill to signal stream end (`api/main.py:on_chain_end`)
- `asyncio.create_task()` to run agent in background while streaming queue
- `EventSourceResponse(generate())` wraps the async generator

## Config Pattern

- `.env` + `python-dotenv` `load_dotenv()` called at module top in `agent/agent.py` and `agent/tools.py`
- Values read via `os.getenv("KEY_NAME")` with no defaults for secrets
- No config object or settings class — direct `os.getenv` throughout

## Import Order

Python files generally follow:
1. stdlib (`os`, `json`, `asyncio`, `datetime`)
2. third-party (`numpy`, `pandas`, `yfinance`, `langchain_*`)
3. project-local (`from simulation.monte_carlo import ...`)

## TypeScript Patterns (`frontend/`)

- Discriminated union type for SSE events (`frontend/src/types/events.ts`) — `type` field as discriminant
- `useReducer` for chat state management in `page.tsx`
- Inline styles used throughout (no CSS modules, no styled-components)
- `"use client"` directive at top of interactive components
- Async generator (`async function*`) for SSE consumption in `sseClient.ts`

## No Linting / Formatting Config

No `eslint.config.*`, `.prettierrc`, `ruff.toml`, or `pyproject.toml` found at repo root. Code formatting is manual/editor-driven.
