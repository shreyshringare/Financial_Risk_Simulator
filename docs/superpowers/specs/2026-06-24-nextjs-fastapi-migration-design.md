# Design: Next.js + FastAPI Migration

Date: 2026-06-24  
Status: Approved

---

## Overview

Replace Streamlit frontend with Next.js 14 (TypeScript, Tailwind) + FastAPI backend. Existing Python simulation/agent/RAG stack unchanged. Agent responses stream token-by-token via Server-Sent Events (SSE).

---

## Architecture

```
frontend/ (Next.js 14 · TypeScript · Tailwind · localhost:3000)
    ↕  POST /api/chat → SSE stream
    ↕  GET  /api/health
api/ (FastAPI · uvicorn · localhost:8000)
    ↕  unchanged imports
agent/ simulation/ rag/ portfolio/ export/ news/ data/ r_analysis/
```

---

## Backend: `api/main.py`

### Endpoints

| Method | Path | Description |
|--------|------|-------------|
| `POST` | `/api/chat` | Stream agent response via SSE |
| `GET` | `/api/health` | Health check, returns `{"status":"ok"}` |

### Chat endpoint detail

- Request body: `{"message": str, "history": [{"role": str, "content": str}]}`
- Response: `text/event-stream`, CORS `localhost:3000`
- Each SSE event: `data: {"token": "..."}` or `data: {"done": true}` or `data: {"error": "..."}`
- Uses `AsyncIteratorCallbackHandler` from `langchain.callbacks.streaming_aiter`
- Agent built once at startup via `@asynccontextmanager` lifespan, stored in `app.state.agent`
- LLM built with `streaming=True` — both Groq and OpenAI paths
- On exception mid-stream: emit `data: {"error": "..."}` then close

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
- `react-markdown` for rendering agent responses

### Theme

Robinhood-inspired dark theme ported to Tailwind config:
- `bg-primary: #0F0F0F`
- `bg-card: #161616`
- `accent-green: #00C805`
- `accent-red: #FF5000`
- `accent-blue: #2196F3`
- `border: #2A2A2A`

### Pages

- `/` — main chat interface (single page app)

### Components

| Component | Responsibility |
|-----------|---------------|
| `ChatWindow` | Message list + input bar + SSE consumer |
| `ChatMessage` | Renders single message (markdown, role avatar, streaming cursor) |
| `Sidebar` | Market badges, capabilities list, quick-query buttons |
| `StatsPanel` | Tools count, simulation engine, knowledge base, model cards |

### SSE client pattern

```typescript
const response = await fetch('http://localhost:8000/api/chat', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ message, history }),
});
const reader = response.body!.getReader();
const decoder = new TextDecoder();
// parse SSE lines, append tokens to streaming message state
```

### Quick queries (sidebar)

Same 7 queries from Streamlit version. Click → auto-submit to chat.

### Streaming UX

- Streaming message renders a blinking `|` cursor while tokens arrive
- Cursor removed on `done` event
- Markdown rendered incrementally (live)

---

## Files Created / Modified

### New
```
api/__init__.py
api/main.py
frontend/          (create-next-app scaffold)
frontend/src/app/page.tsx
frontend/src/app/layout.tsx
frontend/src/app/globals.css
frontend/src/components/ChatWindow.tsx
frontend/src/components/ChatMessage.tsx
frontend/src/components/Sidebar.tsx
frontend/src/components/StatsPanel.tsx
frontend/tailwind.config.ts
```

### Modified
```
requirements.txt   (add fastapi, uvicorn[standard], sse-starlette)
```

### Unchanged
```
agent/ simulation/ rag/ portfolio/ export/ news/ data/ r_analysis/ tests/
```

---

## Dependencies

### Python (add to requirements.txt)
```
fastapi>=0.111.0
uvicorn[standard]>=0.29.0
sse-starlette>=1.8.2
```

### Node (frontend)
```
react-markdown
```

---

## Run Instructions

```bash
# Terminal 1 — backend
uvicorn api.main:app --reload --port 8000

# Terminal 2 — frontend
cd frontend && npm run dev
# → http://localhost:3000
```

---

## Error Handling

- Bad ticker → agent returns `{"error": "..."}` string, displayed as assistant message
- Groq rate limit → FastAPI catches exception, emits `data: {"error": "Rate limit hit. Try again in X min."}` 
- Network error (frontend) → show inline error in chat, allow retry
- Agent timeout (120s) → emit error event, stream closes

---

## Out of Scope

- Auth / user sessions
- Persistent chat history (in-memory per session only)
- Deployment / Docker
- Night 2 features (stress test UI panels, charts) — these remain accessible via chat queries
