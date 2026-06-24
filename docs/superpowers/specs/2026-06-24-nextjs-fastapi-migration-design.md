# Design: Next.js + FastAPI — Analyst Report UI

Date: 2026-06-24  
Status: Approved

---

## Overview

Replace Streamlit with Next.js 14 (TypeScript, Tailwind) + FastAPI backend. UX style: **live Goldman/JPM research note** — structured section cards that populate progressively as the agent processes. Not a chat bubble UI. Looks like something a CIB analyst would actually use.

Existing Python simulation/agent/RAG/portfolio stack: unchanged.

---

## UX Concept: Live Research Note

The page is a **research terminal**, not a chat app.

```
┌─────────────────────────────────────────────────────────┐
│  ◆ FinSim  QUANTITATIVE RISK TERMINAL          [ticker] │
├─────────────────────────────────────────────────────────┤
│  > Ask about any stock or portfolio...          [RUN ▶] │
├─────────────────────────────────────────────────────────┤
│                                                         │
│  ── AAPL · Apple Inc.  NASDAQ ─────────────── LIVE ──  │
│                                                         │
│  ┌ STOCK OVERVIEW ──────────────────────────────────┐  │
│  │  $297.54  ▲ +1.2%    Period: Jan 2020 – Jun 2026  │  │
│  │  1,627 trading days   Min $54  Max $315           │  │
│  └───────────────────────────────────────────────────┘  │
│                                                         │
│  ┌ MONTE CARLO SIMULATION ──────────────────────────┐  │
│  │  1,000 paths · 252 days · GBM                    │  │
│  │  Mean final  $341.20   P5  $198.40   P95  $512.80│  │
│  └───────────────────────────────────────────────────┘  │
│                                                         │
│  ┌ RISK METRICS ────────────────────────────────────┐  │
│  │  VaR (95%)   -3.04%  ● LOW       │               │  │
│  │  CVaR        -3.87%  ● LOW       │ RISK RATING   │  │
│  │  Sharpe       0.79   ● MODERATE  │               │  │
│  │  Max Drawdown -33.4% ● HIGH      │   MODERATE    │  │
│  └───────────────────────────────────────────────────┘  │
│                                                         │
│  ┌ ANALYST VERDICT ─────────────────────────────────┐  │
│  │  [streaming text appears here token by token...] │  │
│  └───────────────────────────────────────────────────┘  │
│                                                         │
│  ┌ ASSUMPTIONS & CAVEATS ───────────────────────────┐  │
│  │  GBM: log-normal returns, constant vol, no jumps │  │
│  │  Real markets: fat tails, vol clustering, regime │  │
│  └───────────────────────────────────────────────────┘  │
│                                                         │
└─────────────────────────────────────────────────────────┘
```

**Progressive reveal**: each section card fades in as the corresponding tool completes. Analyst Verdict streams token-by-token. The user watches the report build live.

---

## Architecture

```
frontend/ (Next.js 14 · TypeScript · Tailwind · localhost:3000)
    ↕  POST /api/chat  →  SSE stream of typed events
api/ (FastAPI · uvicorn · localhost:8000)
    ↕  unchanged imports
agent/ simulation/ rag/ portfolio/ export/ news/ data/ r_analysis/
```

---

## SSE Event Protocol

FastAPI emits **typed JSON events**, not raw tokens. Frontend renders the right component for each event type.

```typescript
type SSEEvent =
  | { type: "section"; section: "stock" | "monte_carlo" | "risk" | "verdict" | "caveats"; data: Record<string, unknown> }
  | { type: "token"; token: string }           // verdict streams token by token
  | { type: "error"; message: string }
  | { type: "done" }
```

**Event sequence for a full analysis:**
1. `{ type: "section", section: "stock", data: { ticker, price, change, period, count, min, max } }`
2. `{ type: "section", section: "monte_carlo", data: { paths, days, mean, p5, p95 } }`
3. `{ type: "section", section: "risk", data: { var, cvar, sharpe, max_drawdown } }`
4. N × `{ type: "token", token: "..." }` — agent verdict streaming
5. `{ type: "section", section: "caveats" }`
6. `{ type: "done" }`

**For non-analysis queries** (portfolio, news, stress test, RAG):
- Only tokens stream (no section cards)
- Response renders in a plain analyst-prose card

---

## Backend: `api/main.py`

### Endpoints

| Method | Path | Description |
|--------|------|-------------|
| `POST` | `/api/chat` | Stream typed SSE events |
| `GET` | `/api/health` | `{"status": "ok", "model": "groq/llama-3.3-70b"}` |

### Streaming implementation

Custom `AnalystCallbackHandler(AsyncCallbackHandler)`:
- `on_tool_end(output, name)` → parses tool name + output → emits structured `section` event to async queue
- `on_llm_new_token(token)` → emits `token` event to queue
- Queue consumed by `StreamingResponse` generator

Agent created once at startup via FastAPI lifespan, stored in `app.state`. Per-request: new `AnalystCallbackHandler` instance passed as callback.

Both Groq and OpenAI LLM paths built with `streaming=True`.

### CORS
```python
allow_origins=["http://localhost:3000"]
allow_methods=["GET", "POST"]
allow_headers=["*"]
```

---

## Frontend: `frontend/`

### Stack
- Next.js 14, App Router
- TypeScript
- Tailwind CSS
- `react-markdown` (verdict + prose cards)

### Color system

| Token | Hex | Use |
|-------|-----|-----|
| `bg-terminal` | `#0A0A0A` | page background |
| `bg-card` | `#111111` | section cards |
| `bg-card-hover` | `#191919` | hover state |
| `accent-green` | `#00C805` | LOW risk, positive |
| `accent-yellow` | `#F5C518` | MODERATE risk |
| `accent-red` | `#FF3B30` | HIGH risk |
| `accent-blue` | `#2196F3` | neutral data |
| `text-primary` | `#F5F5F5` | headings, values |
| `text-secondary` | `#888888` | labels |
| `border` | `#222222` | card borders |
| `border-accent` | `#333333` | active state |

### Risk rating logic (frontend-computed)
```typescript
function riskLevel(var_: number): "LOW" | "MODERATE" | "HIGH" {
  if (var_ > -0.05) return "LOW"
  if (var_ > -0.10) return "MODERATE"
  return "HIGH"
}
// Color: LOW → green, MODERATE → yellow, HIGH → red
```

### Components

| Component | File | Responsibility |
|-----------|------|---------------|
| `Terminal` | `app/page.tsx` | Root: query bar, report area, SSE orchestration |
| `QueryBar` | `components/QueryBar.tsx` | Bloomberg-style command input + RUN button |
| `ReportArea` | `components/ReportArea.tsx` | Ordered list of section cards, manages reveal state |
| `StockCard` | `components/cards/StockCard.tsx` | Price, period, count, min/max |
| `MonteCarloCard` | `components/cards/MonteCarloCard.tsx` | Simulation stats grid |
| `RiskCard` | `components/cards/RiskCard.tsx` | VaR/CVaR/Sharpe/MaxDD with risk badges + overall rating |
| `VerdictCard` | `components/cards/VerdictCard.tsx` | Streaming markdown, blinking cursor |
| `CaveatsCard` | `components/cards/CaveatsCard.tsx` | Static GBM assumptions (always shown after analysis) |
| `ProseCard` | `components/cards/ProseCard.tsx` | Non-analysis responses (news, portfolio, etc.) |
| `Sidebar` | `components/Sidebar.tsx` | Quick queries, market badges, capabilities |

### SSE consumer (in `Terminal`)
```typescript
const reader = res.body!.getReader()
for await (const chunk of readLines(reader)) {
  const event = JSON.parse(chunk.replace('data: ', ''))
  switch (event.type) {
    case 'section': dispatch({ type: 'ADD_SECTION', ...event }); break
    case 'token':   dispatch({ type: 'APPEND_TOKEN', token: event.token }); break
    case 'done':    dispatch({ type: 'DONE' }); break
    case 'error':   dispatch({ type: 'ERROR', message: event.message }); break
  }
}
```

State managed with `useReducer` — report is an ordered array of revealed sections.

### Section reveal animation
Each card: `opacity-0 translate-y-2` → `opacity-100 translate-y-0` on mount, 150ms ease-out. No libraries — pure Tailwind + CSS transition.

---

## Files Created / Modified

### New
```
api/__init__.py
api/main.py
frontend/
  package.json
  tailwind.config.ts
  tsconfig.json
  next.config.ts
  src/app/
    layout.tsx
    page.tsx
    globals.css
  src/components/
    QueryBar.tsx
    ReportArea.tsx
    Sidebar.tsx
    cards/
      StockCard.tsx
      MonteCarloCard.tsx
      RiskCard.tsx
      VerdictCard.tsx
      CaveatsCard.tsx
      ProseCard.tsx
  src/lib/
    sseClient.ts     (SSE reader utility)
    riskUtils.ts     (riskLevel(), formatPct(), formatPrice())
```

### Modified
```
requirements.txt   (add: fastapi, uvicorn[standard], sse-starlette)
```

### Unchanged
```
agent/ simulation/ rag/ portfolio/ export/ news/ data/ r_analysis/ tests/ app.py
```

---

## Run Instructions

```bash
# Terminal 1 — Python backend
uvicorn api.main:app --reload --port 8000

# Terminal 2 — Next.js frontend
cd frontend && npm run dev
# → http://localhost:3000
```

---

## Error Handling

| Scenario | Behavior |
|----------|----------|
| Bad ticker | Agent returns error string → rendered in ProseCard with red border |
| Groq rate limit | Emit `{ type: "error", message: "Rate limit. Try again in ~30 min." }` |
| Agent timeout (120s) | Emit error event, stream closes cleanly |
| Network error (frontend) | Inline error state in ReportArea with retry button |
| Tool parse failure | Callback catches exception → emit error event, don't crash stream |

---

## Out of Scope

- Auth / user sessions
- Persistent chat history (in-memory per query only)
- Live Monte Carlo chart (canvas/SVG) — add in Night 3
- Deployment / Docker
- Mobile responsive layout
