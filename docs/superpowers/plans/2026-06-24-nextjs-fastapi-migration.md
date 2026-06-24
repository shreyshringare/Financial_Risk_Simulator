# Next.js + FastAPI Migration Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace Streamlit with a Next.js 14 analyst-report UI backed by a FastAPI SSE streaming server, keeping all Python simulation/agent/RAG code untouched.

**Architecture:** FastAPI at `localhost:8000` wraps the LangChain ReAct agent and emits typed SSE events (`section` / `token` / `done` / `error`). A custom `AnalystCallbackHandler` intercepts tool completions and LLM tokens to drive the event stream. Next.js at `localhost:3000` consumes the stream and progressively reveals structured section cards — stock overview, Monte Carlo stats, risk metrics, verdict (streaming) — in a Goldman/JPM analyst report aesthetic.

**Tech Stack:** Python 3.11, FastAPI, uvicorn, sse-starlette, LangChain 0.3, Next.js 14 App Router, TypeScript, Tailwind CSS 3, react-markdown.

---

## File Map

### New Python files
```
api/__init__.py                  — package marker
api/main.py                      — FastAPI app, lifespan, CORS, endpoints, AnalystCallbackHandler
```

### Modified Python files
```
requirements.txt                 — add fastapi, uvicorn[standard], sse-starlette
```

### New frontend files
```
frontend/
  package.json
  tsconfig.json
  next.config.ts
  tailwind.config.ts
  postcss.config.mjs
  src/
    app/
      layout.tsx                 — root layout, fonts, metadata
      page.tsx                   — Terminal: query bar + report area + SSE orchestration
      globals.css                — Tailwind base + CSS vars + scrollbar
    components/
      QueryBar.tsx               — Bloomberg-style command input + RUN button
      ReportArea.tsx             — ordered section cards, reveal state
      Sidebar.tsx                — quick queries, market badges, capabilities
      cards/
        StockCard.tsx            — ticker, price, period, count, min/max
        MonteCarloCard.tsx       — paths, days, mean, P5, P95
        RiskCard.tsx             — VaR/CVaR/Sharpe/MaxDD + risk badges + overall rating
        VerdictCard.tsx          — streaming markdown + blinking cursor
        CaveatsCard.tsx          — static GBM assumptions
        ProseCard.tsx            — non-analysis responses (news, portfolio, RAG)
    lib/
      sseClient.ts               — async SSE line reader
      riskUtils.ts               — riskLevel(), formatPct(), formatPrice()
    types/
      events.ts                  — SSEEvent union type
```

---

## Task 1: Python dependencies

**Files:**
- Modify: `requirements.txt`

- [ ] **Step 1: Add FastAPI dependencies**

Append to `requirements.txt`:
```
fastapi>=0.111.0
uvicorn[standard]>=0.29.0
sse-starlette>=1.8.2
```

- [ ] **Step 2: Install**

```bash
cd "D:/SDE Projects/FinancialSim"
venv/Scripts/pip install fastapi "uvicorn[standard]" sse-starlette
```

Expected: installs without conflict.

- [ ] **Step 3: Commit**

```bash
git add requirements.txt
git commit -m "chore: add fastapi, uvicorn, sse-starlette dependencies"
```

---

## Task 2: FastAPI backend — skeleton + health endpoint

**Files:**
- Create: `api/__init__.py`
- Create: `api/main.py`

- [ ] **Step 1: Create package marker**

Create `api/__init__.py` — empty file.

- [ ] **Step 2: Write health endpoint test**

Create `tests/test_api.py`:
```python
import pytest
from fastapi.testclient import TestClient

def test_health():
    from api.main import app
    client = TestClient(app)
    response = client.get("/api/health")
    assert response.status_code == 200
    data = response.json()
    assert data["status"] == "ok"
    assert "model" in data
```

- [ ] **Step 3: Run test — expect FAIL**

```bash
cd "D:/SDE Projects/FinancialSim"
venv/Scripts/python -m pytest tests/test_api.py::test_health -v
```

Expected: `ModuleNotFoundError: No module named 'api.main'`

- [ ] **Step 4: Implement skeleton `api/main.py`**

```python
import os
import json
import asyncio
from contextlib import asynccontextmanager
from typing import AsyncIterator

from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import StreamingResponse
from sse_starlette.sse import EventSourceResponse
from pydantic import BaseModel
from dotenv import load_dotenv

load_dotenv()


@asynccontextmanager
async def lifespan(app: FastAPI) -> AsyncIterator[None]:
    # Import here so test client doesn't hit network on import
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
    async def generate():
        yield json.dumps({"type": "error", "message": "Not yet implemented"})

    return EventSourceResponse(generate())
```

- [ ] **Step 5: Run test — expect PASS**

```bash
venv/Scripts/python -m pytest tests/test_api.py::test_health -v
```

Expected: `PASSED`

- [ ] **Step 6: Commit**

```bash
git add api/__init__.py api/main.py tests/test_api.py
git commit -m "feat: FastAPI skeleton with health endpoint"
```

---

## Task 3: AnalystCallbackHandler + streaming chat endpoint

**Files:**
- Modify: `api/main.py`

The callback handler intercepts LangChain events and pushes typed SSE events into an async queue. The `/api/chat` endpoint drains that queue as an SSE stream.

- [ ] **Step 1: Replace `api/main.py` with full implementation**

```python
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

# ── Tool name → section type mapping ─────────────────────────────────────────
_TOOL_SECTION_MAP = {
    "fetch_stock_data": "stock",
    "run_monte_carlo_simulation": "monte_carlo",
    "calculate_risk_metrics": "risk",
}

# ── Callback handler ──────────────────────────────────────────────────────────

class AnalystCallbackHandler(AsyncCallbackHandler):
    """Intercepts LangChain events → typed SSE events in self.queue."""

    def __init__(self) -> None:
        super().__init__()
        self.queue: asyncio.Queue[str | None] = asyncio.Queue()
        self._done = False

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
        # Emit caveats section and done sentinel after agent finishes
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


# ── App + lifespan ────────────────────────────────────────────────────────────

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
        # Run agent in background task
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
```

- [ ] **Step 2: Verify health test still passes**

```bash
venv/Scripts/python -m pytest tests/test_api.py::test_health -v
```

Expected: `PASSED`

- [ ] **Step 3: Smoke test the streaming endpoint manually**

```bash
cd "D:/SDE Projects/FinancialSim"
venv/Scripts/python -m pytest tests/test_api.py -v
```

Expected: all pass. (Full streaming test requires live Groq — skip for now, covered by agent unit tests.)

- [ ] **Step 4: Commit**

```bash
git add api/main.py
git commit -m "feat: AnalystCallbackHandler + SSE streaming chat endpoint"
```

---

## Task 4: Scaffold Next.js frontend

**Files:**
- Create: `frontend/` (via create-next-app)

- [ ] **Step 1: Scaffold**

```bash
cd "D:/SDE Projects/FinancialSim"
npx create-next-app@latest frontend --typescript --tailwind --app --no-src-dir --import-alias "@/*" --no-eslint
```

When prompted — accept all defaults (TypeScript: yes, Tailwind: yes, App Router: yes).

- [ ] **Step 2: Install additional dependencies**

```bash
cd "D:/SDE Projects/FinancialSim/frontend"
npm install react-markdown
```

- [ ] **Step 3: Verify dev server starts**

```bash
npm run dev -- --port 3000
```

Expected: `✓ Ready on http://localhost:3000`. Stop with Ctrl+C.

- [ ] **Step 4: Commit**

```bash
cd "D:/SDE Projects/FinancialSim"
git add frontend/
git commit -m "chore: scaffold Next.js 14 frontend with Tailwind"
```

---

## Task 5: Types, utilities, SSE client

**Files:**
- Create: `frontend/src/types/events.ts`
- Create: `frontend/src/lib/riskUtils.ts`
- Create: `frontend/src/lib/sseClient.ts`

- [ ] **Step 1: Create `frontend/src/types/events.ts`**

```typescript
export type StockData = {
  ticker: string;
  start: string;
  end: string;
  count: number;
  latest_price: number;
  min_price: number;
  max_price: number;
};

export type MonteCarloData = {
  ticker: string;
  days: number;
  simulations: number;
  mean_final_price: number;
  std_final_price: number;
  percentile_5: number;
  percentile_95: number;
};

export type RiskData = {
  var: number;
  cvar: number;
  sharpe: number;
  max_drawdown: number;
};

export type SSEEvent =
  | { type: "section"; section: "stock"; data: StockData }
  | { type: "section"; section: "monte_carlo"; data: MonteCarloData }
  | { type: "section"; section: "risk"; data: RiskData }
  | { type: "section"; section: "caveats"; data: Record<string, never> }
  | { type: "token"; token: string }
  | { type: "error"; message: string }
  | { type: "done" };

export type SectionType = "stock" | "monte_carlo" | "risk" | "verdict" | "caveats" | "prose";

export type ReportSection =
  | { kind: "stock"; data: StockData }
  | { kind: "monte_carlo"; data: MonteCarloData }
  | { kind: "risk"; data: RiskData }
  | { kind: "verdict"; content: string; streaming: boolean }
  | { kind: "caveats" }
  | { kind: "prose"; content: string; streaming: boolean };
```

- [ ] **Step 2: Create `frontend/src/lib/riskUtils.ts`**

```typescript
export type RiskLevel = "LOW" | "MODERATE" | "HIGH";

export function riskLevel(varValue: number): RiskLevel {
  if (varValue > -0.05) return "LOW";
  if (varValue > -0.10) return "MODERATE";
  return "HIGH";
}

export function riskColor(level: RiskLevel): string {
  switch (level) {
    case "LOW": return "text-green-400";
    case "MODERATE": return "text-yellow-400";
    case "HIGH": return "text-red-400";
  }
}

export function riskBg(level: RiskLevel): string {
  switch (level) {
    case "LOW": return "bg-green-400/10 border-green-400/30";
    case "MODERATE": return "bg-yellow-400/10 border-yellow-400/30";
    case "HIGH": return "bg-red-400/10 border-red-400/30";
  }
}

export function overallRisk(varValue: number, sharpe: number, maxDrawdown: number): RiskLevel {
  const levels = [riskLevel(varValue), riskLevel(maxDrawdown)];
  if (levels.includes("HIGH")) return "HIGH";
  if (levels.includes("MODERATE") || sharpe < 0.5) return "MODERATE";
  return "LOW";
}

export function formatPct(value: number): string {
  return `${(value * 100).toFixed(2)}%`;
}

export function formatPrice(value: number): string {
  return `$${value.toFixed(2)}`;
}
```

- [ ] **Step 3: Create `frontend/src/lib/sseClient.ts`**

```typescript
import type { SSEEvent } from "@/types/events";

const API_BASE = "http://localhost:8000";

export async function* streamChat(
  message: string,
  history: Array<{ role: string; content: string }> = []
): AsyncGenerator<SSEEvent> {
  const res = await fetch(`${API_BASE}/api/chat`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ message, history }),
  });

  if (!res.ok || !res.body) {
    yield { type: "error", message: `HTTP ${res.status}` };
    return;
  }

  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";

  try {
    while (true) {
      const { value, done } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split("\n");
      buffer = lines.pop() ?? "";
      for (const line of lines) {
        const trimmed = line.trim();
        if (trimmed.startsWith("data: ")) {
          const raw = trimmed.slice(6);
          try {
            const event = JSON.parse(raw) as SSEEvent;
            yield event;
            if (event.type === "done") return;
          } catch {
            // malformed JSON — skip
          }
        }
      }
    }
  } finally {
    reader.releaseLock();
  }
}
```

- [ ] **Step 4: Commit**

```bash
cd "D:/SDE Projects/FinancialSim"
git add frontend/src/types/ frontend/src/lib/
git commit -m "feat: SSE types, risk utilities, sseClient"
```

---

## Task 6: Tailwind config + global CSS + layout

**Files:**
- Modify: `frontend/tailwind.config.ts`
- Modify: `frontend/src/app/globals.css`
- Modify: `frontend/src/app/layout.tsx`

- [ ] **Step 1: Replace `frontend/tailwind.config.ts`**

```typescript
import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./src/**/*.{js,ts,jsx,tsx,mdx}"],
  theme: {
    extend: {
      colors: {
        terminal: "#0A0A0A",
        card: "#111111",
        "card-hover": "#191919",
        "accent-green": "#00C805",
        "accent-yellow": "#F5C518",
        "accent-red": "#FF3B30",
        "accent-blue": "#2196F3",
        "text-primary": "#F5F5F5",
        "text-secondary": "#888888",
        border: "#222222",
        "border-accent": "#333333",
      },
      fontFamily: {
        mono: ["'JetBrains Mono'", "'Fira Code'", "monospace"],
      },
      animation: {
        "fade-up": "fadeUp 150ms ease-out forwards",
        blink: "blink 1s step-end infinite",
      },
      keyframes: {
        fadeUp: {
          "0%": { opacity: "0", transform: "translateY(6px)" },
          "100%": { opacity: "1", transform: "translateY(0)" },
        },
        blink: {
          "0%, 100%": { opacity: "1" },
          "50%": { opacity: "0" },
        },
      },
    },
  },
  plugins: [],
};

export default config;
```

- [ ] **Step 2: Replace `frontend/src/app/globals.css`**

```css
@tailwind base;
@tailwind components;
@tailwind utilities;

:root {
  color-scheme: dark;
}

body {
  background-color: #0A0A0A;
  color: #F5F5F5;
  font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
  -webkit-font-smoothing: antialiased;
}

/* Scrollbar */
::-webkit-scrollbar { width: 5px; }
::-webkit-scrollbar-track { background: #0A0A0A; }
::-webkit-scrollbar-thumb { background: #333; border-radius: 3px; }
::-webkit-scrollbar-thumb:hover { background: #555; }

/* Section card reveal */
.section-card {
  opacity: 0;
  animation: fadeUp 150ms ease-out forwards;
}

/* Blinking cursor */
.streaming-cursor::after {
  content: "▋";
  animation: blink 1s step-end infinite;
  color: #00C805;
  margin-left: 1px;
}

/* Markdown prose overrides */
.analyst-prose h1, .analyst-prose h2, .analyst-prose h3 {
  color: #F5F5F5;
  font-weight: 700;
  margin-top: 1em;
  margin-bottom: 0.4em;
}
.analyst-prose p { margin: 0.5em 0; line-height: 1.7; }
.analyst-prose strong { color: #F5F5F5; }
.analyst-prose ul { list-style: disc; padding-left: 1.5em; }
.analyst-prose li { margin: 0.25em 0; }
```

- [ ] **Step 3: Replace `frontend/src/app/layout.tsx`**

```tsx
import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "FinSim — Quantitative Risk Terminal",
  description: "AI-powered financial risk analysis · Monte Carlo · VaR · CVaR",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className="dark">
      <body className="bg-terminal text-text-primary min-h-screen">
        {children}
      </body>
    </html>
  );
}
```

- [ ] **Step 4: Commit**

```bash
cd "D:/SDE Projects/FinancialSim"
git add frontend/tailwind.config.ts frontend/src/app/globals.css frontend/src/app/layout.tsx
git commit -m "feat: Tailwind theme, global CSS, root layout"
```

---

## Task 7: Section cards

**Files:**
- Create: `frontend/src/components/cards/StockCard.tsx`
- Create: `frontend/src/components/cards/MonteCarloCard.tsx`
- Create: `frontend/src/components/cards/RiskCard.tsx`
- Create: `frontend/src/components/cards/VerdictCard.tsx`
- Create: `frontend/src/components/cards/CaveatsCard.tsx`
- Create: `frontend/src/components/cards/ProseCard.tsx`

- [ ] **Step 1: Create `frontend/src/components/cards/StockCard.tsx`**

```tsx
import type { StockData } from "@/types/events";
import { formatPrice } from "@/lib/riskUtils";

export default function StockCard({ data }: { data: StockData }) {
  return (
    <div className="section-card border border-border rounded-lg p-5 bg-card">
      <div className="text-xs font-semibold tracking-widest text-text-secondary uppercase mb-3">
        Stock Overview
      </div>
      <div className="flex items-baseline gap-3 mb-4">
        <span className="text-3xl font-bold font-mono text-text-primary">
          {formatPrice(data.latest_price)}
        </span>
        <span className="text-sm text-text-secondary">{data.ticker}</span>
      </div>
      <div className="grid grid-cols-3 gap-3">
        <Stat label="Period" value={`${data.start} – ${data.end}`} />
        <Stat label="Trading Days" value={data.count.toLocaleString()} />
        <Stat label="52W Range" value={`${formatPrice(data.min_price)} – ${formatPrice(data.max_price)}`} />
      </div>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <div className="text-xs text-text-secondary uppercase tracking-wider mb-1">{label}</div>
      <div className="text-sm font-mono text-text-primary">{value}</div>
    </div>
  );
}
```

- [ ] **Step 2: Create `frontend/src/components/cards/MonteCarloCard.tsx`**

```tsx
import type { MonteCarloData } from "@/types/events";
import { formatPrice } from "@/lib/riskUtils";

export default function MonteCarloCard({ data }: { data: MonteCarloData }) {
  return (
    <div className="section-card border border-border rounded-lg p-5 bg-card">
      <div className="text-xs font-semibold tracking-widest text-text-secondary uppercase mb-3">
        Monte Carlo Simulation
      </div>
      <div className="text-xs text-text-secondary mb-4 font-mono">
        {data.simulations.toLocaleString()} paths · {data.days} days · GBM
      </div>
      <div className="grid grid-cols-3 gap-4">
        <SimStat label="Mean Final Price" value={formatPrice(data.mean_final_price)} color="text-accent-blue" />
        <SimStat label="5th Percentile" value={formatPrice(data.percentile_5)} color="text-accent-red" />
        <SimStat label="95th Percentile" value={formatPrice(data.percentile_95)} color="text-accent-green" />
      </div>
      <div className="mt-3 text-xs text-text-secondary font-mono">
        Std Dev: {formatPrice(data.std_final_price)}
      </div>
    </div>
  );
}

function SimStat({ label, value, color }: { label: string; value: string; color: string }) {
  return (
    <div>
      <div className="text-xs text-text-secondary uppercase tracking-wider mb-1">{label}</div>
      <div className={`text-lg font-bold font-mono ${color}`}>{value}</div>
    </div>
  );
}
```

- [ ] **Step 3: Create `frontend/src/components/cards/RiskCard.tsx`**

```tsx
import type { RiskData } from "@/types/events";
import { riskLevel, riskColor, riskBg, overallRisk, formatPct, type RiskLevel } from "@/lib/riskUtils";

export default function RiskCard({ data }: { data: RiskData }) {
  const overall = overallRisk(data.var, data.sharpe, data.max_drawdown);

  return (
    <div className="section-card border border-border rounded-lg p-5 bg-card">
      <div className="text-xs font-semibold tracking-widest text-text-secondary uppercase mb-3">
        Risk Metrics
      </div>
      <div className="flex gap-6">
        <div className="flex-1 space-y-3">
          <RiskRow label="VaR (95%)" value={formatPct(data.var)} level={riskLevel(data.var)} />
          <RiskRow label="CVaR (Expected Shortfall)" value={formatPct(data.cvar)} level={riskLevel(data.cvar)} />
          <RiskRow label="Sharpe Ratio" value={data.sharpe.toFixed(4)} level={data.sharpe > 1 ? "LOW" : data.sharpe > 0.5 ? "MODERATE" : "HIGH"} />
          <RiskRow label="Max Drawdown" value={formatPct(data.max_drawdown)} level={riskLevel(data.max_drawdown)} />
        </div>
        <OverallRating level={overall} />
      </div>
    </div>
  );
}

function RiskRow({ label, value, level }: { label: string; value: string; level: RiskLevel }) {
  return (
    <div className="flex items-center justify-between">
      <span className="text-sm text-text-secondary">{label}</span>
      <div className="flex items-center gap-3">
        <span className="font-mono text-sm text-text-primary">{value}</span>
        <span className={`text-xs font-semibold px-2 py-0.5 rounded border ${riskBg(level)} ${riskColor(level)}`}>
          {level}
        </span>
      </div>
    </div>
  );
}

function OverallRating({ level }: { level: RiskLevel }) {
  return (
    <div className={`flex flex-col items-center justify-center px-6 rounded-lg border ${riskBg(level)}`}>
      <div className="text-xs text-text-secondary uppercase tracking-wider mb-1">Risk Rating</div>
      <div className={`text-xl font-bold ${riskColor(level)}`}>{level}</div>
    </div>
  );
}
```

- [ ] **Step 4: Create `frontend/src/components/cards/VerdictCard.tsx`**

```tsx
import ReactMarkdown from "react-markdown";

interface Props {
  content: string;
  streaming: boolean;
}

export default function VerdictCard({ content, streaming }: Props) {
  return (
    <div className="section-card border border-border rounded-lg p-5 bg-card">
      <div className="text-xs font-semibold tracking-widest text-text-secondary uppercase mb-3">
        Analyst Verdict
      </div>
      <div className={`analyst-prose text-sm text-text-primary leading-relaxed ${streaming ? "streaming-cursor" : ""}`}>
        <ReactMarkdown>{content}</ReactMarkdown>
      </div>
    </div>
  );
}
```

- [ ] **Step 5: Create `frontend/src/components/cards/CaveatsCard.tsx`**

```tsx
export default function CaveatsCard() {
  return (
    <div className="section-card border border-border-accent rounded-lg p-4 bg-card">
      <div className="text-xs font-semibold tracking-widest text-text-secondary uppercase mb-2">
        Model Assumptions &amp; Caveats
      </div>
      <div className="text-xs text-text-secondary space-y-1 font-mono">
        <p>▸ GBM assumes log-normally distributed returns, constant volatility, no price jumps</p>
        <p>▸ Real markets exhibit fat tails, volatility clustering, and regime changes</p>
        <p>▸ CVaR &gt; VaR in severity — captures average tail loss, not just the threshold</p>
        <p>▸ Historical Sharpe is backward-looking; past risk-adjusted return ≠ future performance</p>
        <p className="text-yellow-400/60 pt-1">⚠ Educational use only. Not financial advice.</p>
      </div>
    </div>
  );
}
```

- [ ] **Step 6: Create `frontend/src/components/cards/ProseCard.tsx`**

```tsx
import ReactMarkdown from "react-markdown";

interface Props {
  content: string;
  streaming: boolean;
}

export default function ProseCard({ content, streaming }: Props) {
  return (
    <div className="section-card border border-border rounded-lg p-5 bg-card">
      <div className={`analyst-prose text-sm text-text-primary leading-relaxed ${streaming ? "streaming-cursor" : ""}`}>
        <ReactMarkdown>{content}</ReactMarkdown>
      </div>
    </div>
  );
}
```

- [ ] **Step 7: Commit**

```bash
cd "D:/SDE Projects/FinancialSim"
git add frontend/src/components/cards/
git commit -m "feat: section cards — StockCard, MonteCarloCard, RiskCard, VerdictCard, CaveatsCard, ProseCard"
```

---

## Task 8: QueryBar + Sidebar

**Files:**
- Create: `frontend/src/components/QueryBar.tsx`
- Create: `frontend/src/components/Sidebar.tsx`

- [ ] **Step 1: Create `frontend/src/components/QueryBar.tsx`**

```tsx
import { FormEvent, useRef } from "react";

interface Props {
  onSubmit: (message: string) => void;
  disabled: boolean;
}

export default function QueryBar({ onSubmit, disabled }: Props) {
  const inputRef = useRef<HTMLInputElement>(null);

  function handleSubmit(e: FormEvent) {
    e.preventDefault();
    const value = inputRef.current?.value.trim();
    if (!value || disabled) return;
    onSubmit(value);
    if (inputRef.current) inputRef.current.value = "";
  }

  return (
    <form onSubmit={handleSubmit} className="flex gap-2">
      <div className="flex-1 flex items-center gap-2 bg-card border border-border rounded-lg px-4 py-3 focus-within:border-accent-green transition-colors">
        <span className="text-accent-green font-mono text-sm select-none">▶</span>
        <input
          ref={inputRef}
          type="text"
          placeholder="Ask about any stock or portfolio... (e.g. What is the VaR for AAPL?)"
          disabled={disabled}
          className="flex-1 bg-transparent text-text-primary placeholder-text-secondary text-sm outline-none font-mono disabled:opacity-50"
        />
      </div>
      <button
        type="submit"
        disabled={disabled}
        className="px-5 py-3 bg-accent-green text-black font-bold text-sm rounded-lg hover:bg-green-400 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
      >
        {disabled ? "RUNNING" : "RUN ▶"}
      </button>
    </form>
  );
}
```

- [ ] **Step 2: Create `frontend/src/components/Sidebar.tsx`**

```tsx
interface Props {
  onQuery: (q: string) => void;
  disabled: boolean;
}

const QUICK_QUERIES = [
  "What is the VaR for AAPL?",
  "Run Monte Carlo on RELIANCE.NS",
  "Analyze portfolio: AAPL, MSFT, TSLA",
  "2008 crisis stress test on TSLA",
  "Efficient frontier for AAPL, GOOGL, MSFT",
  "Latest news for NVDA",
  "Export AAPL report to Excel",
];

const MARKETS = [
  { flag: "🇺🇸", label: "NYSE/NASDAQ" },
  { flag: "🇮🇳", label: "NSE .NS" },
  { flag: "🇬🇧", label: "LSE .L" },
  { flag: "🇨🇦", label: "TSX .TO" },
];

const CAPABILITIES = [
  "📉 VaR · CVaR · Sharpe · Drawdown",
  "🎲 Monte Carlo GBM (1,000 paths)",
  "📊 Portfolio Correlation + VaR",
  "⚡ Stress Testing (5 crises)",
  "📐 Markowitz Efficient Frontier",
  "📰 RSS News + Sentiment",
  "💾 Excel & PowerBI Export",
];

export default function Sidebar({ onQuery, disabled }: Props) {
  return (
    <aside className="w-64 shrink-0 flex flex-col gap-6">
      {/* Brand */}
      <div>
        <div className="text-accent-green font-bold text-lg tracking-tight">◆ FinSim</div>
        <div className="text-text-secondary text-xs mt-0.5">Risk Terminal v2.0</div>
      </div>

      <hr className="border-border" />

      {/* Markets */}
      <div>
        <div className="text-xs font-semibold tracking-widest text-text-secondary uppercase mb-2">Markets</div>
        <div className="flex flex-wrap gap-1.5">
          {MARKETS.map((m) => (
            <span key={m.label} className="text-xs bg-green-400/10 text-accent-green border border-green-400/20 px-2 py-0.5 rounded font-semibold">
              {m.flag} {m.label}
            </span>
          ))}
        </div>
      </div>

      {/* Capabilities */}
      <div>
        <div className="text-xs font-semibold tracking-widest text-text-secondary uppercase mb-2">Capabilities</div>
        <ul className="space-y-1.5">
          {CAPABILITIES.map((c) => (
            <li key={c} className="text-xs text-text-secondary">{c}</li>
          ))}
        </ul>
      </div>

      <hr className="border-border" />

      {/* Quick queries */}
      <div>
        <div className="text-xs font-semibold tracking-widest text-text-secondary uppercase mb-2">Quick Queries</div>
        <div className="flex flex-col gap-1.5">
          {QUICK_QUERIES.map((q) => (
            <button
              key={q}
              onClick={() => onQuery(q)}
              disabled={disabled}
              className="text-left text-xs text-text-secondary hover:text-accent-green hover:bg-green-400/5 px-3 py-2 rounded border border-border hover:border-green-400/20 transition-colors disabled:opacity-40 disabled:cursor-not-allowed truncate"
            >
              {q}
            </button>
          ))}
        </div>
      </div>

      <hr className="border-border" />

      <p className="text-xs text-text-secondary/50 text-center">
        ⚠ Educational use only.<br />Not financial advice.
      </p>
    </aside>
  );
}
```

- [ ] **Step 3: Commit**

```bash
cd "D:/SDE Projects/FinancialSim"
git add frontend/src/components/QueryBar.tsx frontend/src/components/Sidebar.tsx
git commit -m "feat: QueryBar and Sidebar components"
```

---

## Task 9: ReportArea

**Files:**
- Create: `frontend/src/components/ReportArea.tsx`

- [ ] **Step 1: Create `frontend/src/components/ReportArea.tsx`**

```tsx
import type { ReportSection } from "@/types/events";
import StockCard from "./cards/StockCard";
import MonteCarloCard from "./cards/MonteCarloCard";
import RiskCard from "./cards/RiskCard";
import VerdictCard from "./cards/VerdictCard";
import CaveatsCard from "./cards/CaveatsCard";
import ProseCard from "./cards/ProseCard";

interface Props {
  sections: ReportSection[];
  error: string | null;
}

export default function ReportArea({ sections, error }: Props) {
  if (error) {
    return (
      <div className="border border-accent-red/40 bg-red-400/5 rounded-lg p-4 text-sm text-accent-red font-mono">
        ⚠ {error}
      </div>
    );
  }

  if (sections.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-64 text-text-secondary text-sm">
        <div className="text-4xl mb-4 text-accent-green/30">◆</div>
        <p>Enter a query above to begin analysis.</p>
        <p className="text-xs mt-2 text-text-secondary/50">
          Try: "What is the VaR for AAPL?" or "Analyze portfolio: AAPL, MSFT, TSLA"
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {sections.map((section, i) => (
        <SectionRenderer key={i} section={section} />
      ))}
    </div>
  );
}

function SectionRenderer({ section }: { section: ReportSection }) {
  switch (section.kind) {
    case "stock": return <StockCard data={section.data} />;
    case "monte_carlo": return <MonteCarloCard data={section.data} />;
    case "risk": return <RiskCard data={section.data} />;
    case "verdict": return <VerdictCard content={section.content} streaming={section.streaming} />;
    case "caveats": return <CaveatsCard />;
    case "prose": return <ProseCard content={section.content} streaming={section.streaming} />;
  }
}
```

- [ ] **Step 2: Commit**

```bash
cd "D:/SDE Projects/FinancialSim"
git add frontend/src/components/ReportArea.tsx
git commit -m "feat: ReportArea component"
```

---

## Task 10: Terminal page (SSE orchestration)

**Files:**
- Modify: `frontend/src/app/page.tsx`

This is the root of the app. It manages the report state via `useReducer` and drives the SSE consumer.

- [ ] **Step 1: Replace `frontend/src/app/page.tsx`**

```tsx
"use client";

import { useReducer, useCallback } from "react";
import type { ReportSection, SSEEvent } from "@/types/events";
import { streamChat } from "@/lib/sseClient";
import QueryBar from "@/components/QueryBar";
import ReportArea from "@/components/ReportArea";
import Sidebar from "@/components/Sidebar";

// ── State ─────────────────────────────────────────────────────────────────────

type State = {
  sections: ReportSection[];
  streaming: boolean;
  error: string | null;
  hasAnalysisSections: boolean; // true if any stock/mc/risk sections arrived
};

type Action =
  | { type: "START" }
  | { type: "ADD_STOCK"; data: Extract<SSEEvent, { section: "stock" }>["data"] }
  | { type: "ADD_MONTE_CARLO"; data: Extract<SSEEvent, { section: "monte_carlo" }>["data"] }
  | { type: "ADD_RISK"; data: Extract<SSEEvent, { section: "risk" }>["data"] }
  | { type: "ADD_CAVEATS" }
  | { type: "APPEND_TOKEN"; token: string }
  | { type: "DONE" }
  | { type: "ERROR"; message: string };

const initial: State = { sections: [], streaming: false, error: null, hasAnalysisSections: false };

function reducer(state: State, action: Action): State {
  switch (action.type) {
    case "START":
      return { sections: [], streaming: true, error: null, hasAnalysisSections: false };

    case "ADD_STOCK":
      return { ...state, hasAnalysisSections: true, sections: [...state.sections, { kind: "stock", data: action.data }] };

    case "ADD_MONTE_CARLO":
      return { ...state, sections: [...state.sections, { kind: "monte_carlo", data: action.data }] };

    case "ADD_RISK":
      // Also seed the verdict card so tokens can append to it
      return {
        ...state,
        sections: [
          ...state.sections,
          { kind: "risk", data: action.data },
          { kind: "verdict", content: "", streaming: true },
        ],
      };

    case "APPEND_TOKEN": {
      const sections = [...state.sections];
      // Find the streaming verdict card (or prose card) and append token
      const idx = sections.findLastIndex(
        (s) => (s.kind === "verdict" || s.kind === "prose") && s.streaming
      );
      if (idx === -1) {
        // No analysis sections arrived — this is a prose response
        if (!state.hasAnalysisSections) {
          const last = sections[sections.length - 1];
          if (last?.kind === "prose" && last.streaming) {
            sections[sections.length - 1] = { ...last, content: last.content + action.token };
          } else {
            sections.push({ kind: "prose", content: action.token, streaming: true });
          }
        }
        return { ...state, sections };
      }
      const card = sections[idx] as Extract<ReportSection, { kind: "verdict" | "prose" }>;
      sections[idx] = { ...card, content: card.content + action.token };
      return { ...state, sections };
    }

    case "ADD_CAVEATS":
      return { ...state, sections: [...state.sections, { kind: "caveats" }] };

    case "DONE": {
      // Mark streaming cards as done
      const sections = state.sections.map((s) =>
        (s.kind === "verdict" || s.kind === "prose") && s.streaming
          ? { ...s, streaming: false }
          : s
      );
      return { ...state, streaming: false, sections };
    }

    case "ERROR":
      return { ...state, streaming: false, error: action.message };

    default:
      return state;
  }
}

// ── Component ─────────────────────────────────────────────────────────────────

export default function Terminal() {
  const [state, dispatch] = useReducer(reducer, initial);

  const handleQuery = useCallback(async (message: string) => {
    dispatch({ type: "START" });
    try {
      for await (const event of streamChat(message)) {
        switch (event.type) {
          case "section":
            if (event.section === "stock") dispatch({ type: "ADD_STOCK", data: event.data });
            else if (event.section === "monte_carlo") dispatch({ type: "ADD_MONTE_CARLO", data: event.data });
            else if (event.section === "risk") dispatch({ type: "ADD_RISK", data: event.data });
            else if (event.section === "caveats") dispatch({ type: "ADD_CAVEATS" });
            break;
          case "token":
            dispatch({ type: "APPEND_TOKEN", token: event.token });
            break;
          case "done":
            dispatch({ type: "DONE" });
            break;
          case "error":
            dispatch({ type: "ERROR", message: event.message });
            break;
        }
      }
    } catch (err) {
      dispatch({ type: "ERROR", message: err instanceof Error ? err.message : "Network error" });
    }
  }, []);

  return (
    <div className="flex h-screen overflow-hidden">
      {/* Sidebar */}
      <div className="hidden lg:block w-64 shrink-0 border-r border-border overflow-y-auto p-5">
        <Sidebar onQuery={handleQuery} disabled={state.streaming} />
      </div>

      {/* Main */}
      <div className="flex-1 flex flex-col overflow-hidden">
        {/* Header */}
        <header className="border-b border-border px-6 py-4 flex items-center gap-3 shrink-0">
          <span className="text-accent-green font-bold text-lg">◆ FinSim</span>
          <span className="text-text-secondary text-xs">
            Quantitative Risk Terminal · Monte Carlo · VaR · GBM · RAG
          </span>
          {state.streaming && (
            <span className="ml-auto text-xs font-mono text-accent-green animate-pulse">● LIVE</span>
          )}
        </header>

        {/* Query bar */}
        <div className="px-6 py-4 border-b border-border shrink-0">
          <QueryBar onSubmit={handleQuery} disabled={state.streaming} />
        </div>

        {/* Report area */}
        <main className="flex-1 overflow-y-auto px-6 py-5">
          <ReportArea sections={state.sections} error={state.error} />
        </main>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Verify TypeScript compiles**

```bash
cd "D:/SDE Projects/FinancialSim/frontend"
npx tsc --noEmit
```

Expected: no errors (or only minor `react-markdown` type warnings).

- [ ] **Step 3: Verify dev server starts**

```bash
npm run dev -- --port 3000
```

Expected: `✓ Ready on http://localhost:3000`. Stop with Ctrl+C.

- [ ] **Step 4: Commit**

```bash
cd "D:/SDE Projects/FinancialSim"
git add frontend/src/app/page.tsx
git commit -m "feat: Terminal page with useReducer SSE orchestration"
```

---

## Task 11: Integration smoke test

**Files:**
- No new files — manual verification

- [ ] **Step 1: Start FastAPI backend**

```bash
cd "D:/SDE Projects/FinancialSim"
venv/Scripts/python -m uvicorn api.main:app --reload --port 8000
```

Expected: `INFO: Uvicorn running on http://0.0.0.0:8000`

- [ ] **Step 2: Verify health endpoint**

```bash
curl http://localhost:8000/api/health
```

Expected: `{"status":"ok","model":"groq/llama-3.3-70b-versatile"}`

- [ ] **Step 3: Start Next.js frontend**

In a second terminal:
```bash
cd "D:/SDE Projects/FinancialSim/frontend"
npm run dev -- --port 3000
```

Expected: `✓ Ready on http://localhost:3000`

- [ ] **Step 4: Open browser, run query**

Navigate to `http://localhost:3000`. Type: `What is the VaR for AAPL?` → click RUN.

Expected sequence:
1. Header shows `● LIVE` indicator
2. StockCard appears (price, period, count)
3. MonteCarloCard appears (mean, P5, P95)
4. RiskCard appears with color-coded badges
5. VerdictCard streams token-by-token with blinking cursor
6. CaveatsCard appears
7. `● LIVE` disappears

- [ ] **Step 5: Run a prose query**

Type: `Explain what CVaR means`

Expected: ProseCard appears, streams agent response as markdown.

- [ ] **Step 6: Run all Python tests — verify nothing broke**

```bash
cd "D:/SDE Projects/FinancialSim"
venv/Scripts/python -m pytest tests/ -v
```

Expected: 10 passed, 0 failed.

- [ ] **Step 7: Final commit**

```bash
cd "D:/SDE Projects/FinancialSim"
git add -A
git commit -m "feat: Next.js + FastAPI analyst report UI — complete migration"
```

---

## Run Reference

```bash
# Backend
cd "D:/SDE Projects/FinancialSim"
venv/Scripts/python -m uvicorn api.main:app --reload --port 8000

# Frontend
cd "D:/SDE Projects/FinancialSim/frontend"
npm run dev
# → http://localhost:3000
```
