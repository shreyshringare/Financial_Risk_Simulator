# External Integrations

**Analysis Date:** 2026-06-25

## LLM Providers

**Groq (primary):**
- Model: `llama-3.3-70b-versatile`
- SDK: `langchain-groq` via `ChatGroq` (`agent/agent.py:27-33`)
- Auth: `GROQ_API_KEY` env var
- Settings: `temperature=0`, `max_tokens=2000`, `streaming=True`
- Free tier: 14,400 req/day, no credit card required

**OpenAI (fallback):**
- Model: `gpt-4o-mini` (agent creation) / reported as `openai/gpt-4o` in health endpoint (`api/main.py:89`)
- SDK: `langchain-openai` via `ChatOpenAI` (`agent/agent.py:35-36`)
- Auth: `OPENAI_API_KEY` env var
- Activated when `GROQ_API_KEY` is absent

**LLM selection logic:** `agent/agent.py:23-36` — checks `os.getenv("GROQ_API_KEY")` at agent creation time; falls through to OpenAI if unset.

## Market Data Sources

**yfinance (primary):**
- Package: `yfinance >=0.2.36`
- Used in: `data/market_data.py:29-33`, `agent/tools.py:38`, `agent/tools.py:56`, and all tool functions
- No API key required
- Supports global market suffixes: `.NS` (NSE India), `.L` (LSE), `.TO` (TSX)

**pandas_datareader / Stooq (fallback):**
- Package: `pandas-datareader >=0.10.0`
- Used in: `data/market_data.py:40-44`
- Activated when yfinance returns empty data
- Ticker mapping: `.L` → `.UK`, `.TO` → `.CA` (`data/market_data.py:41`)

**BeautifulSoup Yahoo Finance scrape (last resort):**
- Packages: `beautifulsoup4`, `requests`
- Used in: `data/market_data.py:49-61`
- Returns single-point current price only (no historical series)
- URL: `https://finance.yahoo.com/quote/{ticker}`

**Fallback chain defined at:** `data/market_data.py:13-64` — raises `RuntimeError` if all three sources fail.

## RAG / Knowledge Base

**ChromaDB (local vector store):**
- Package: `chromadb >=0.4.0`
- Persist directory: `./chroma_db/` (relative to working directory)
- Collection name: `financial_knowledge` (`rag/knowledge_base.py:29`)
- Initialized via: `rag/knowledge_base.py:31-68`
- Cold start: ~60s (model download + fetch + embed); warm: ~0.3s

**HuggingFace Embeddings (local):**
- Package: `langchain-huggingface`, `sentence-transformers >=2.7.0`
- Model: `BAAI/bge-base-en-v1.5` (~110MB, downloads once) (`rag/knowledge_base.py:37`)
- Device: CPU (`model_kwargs={"device": "cpu"}`)
- Normalization enabled (required for bge models) (`rag/knowledge_base.py:40`)
- No API key required

**RAG source documents (fetched at cold start):**
Wikipedia pages for: Value at Risk, Expected Shortfall, Geometric Brownian Motion, Sharpe Ratio, Maximum Drawdown, Fat-tailed distribution, Volatility clustering, Black-Scholes model (`rag/knowledge_base.py:16-25`)

**Chunking:** `RecursiveCharacterTextSplitter`, chunk_size=1000, overlap=200 (`rag/knowledge_base.py:56-60`)

**Query interface:** `rag/knowledge_base.py:72-78` — similarity search, top-k=3, results joined with `\n\n---\n\n`

## LangChain Hub

**Prompt pull:**
- URL: `hwchase17/react` (standard ReAct prompt) pulled via `langchain.hub.pull` (`agent/agent.py:55`)
- Auth: `LANGCHAIN_API_KEY` env var (implicit, required by LangChain Hub)
- Fallback: manually constructed ReAct prompt template at `agent/agent.py:63-85` if hub pull fails

## RSS News Feeds

**Package:** `feedparser >=6.0.0`
**Implementation:** `news/rss_feed.py`
**No API key required.**

**Feed sources:**
- Google News RSS (ticker-specific): `https://news.google.com/rss/search?q={ticker}+stock` (`news/rss_feed.py:16`)
- MarketWatch top stories: `https://feeds.marketwatch.com/marketwatch/topstories/` (`news/rss_feed.py:17`)
- CNBC Finance: `https://www.cnbc.com/id/100003114/device/rss/rss.html` (`news/rss_feed.py:18`)
- Reuters Business: `https://feeds.reuters.com/reuters/businessNews` (`news/rss_feed.py:19`)

**Sentiment analysis:** Keyword-based, no external service. Returns bullish/bearish/neutral signal lists.

## Export Integrations

**Excel (openpyxl):**
- Package: `openpyxl >=3.1.0`
- Output directory: `./reports/` (created at runtime)
- Filename pattern: `{ticker}_risk_report_{YYYYMMDD_HHMMSS}.xlsx`
- Sheets produced: Summary, Monte Carlo Paths, Return Distribution, Stress Tests (optional), Correlation (optional)
- Charts embedded: LineChart (MC paths), BarChart (return distribution) (`export/excel_exporter.py:211-273`)
- Entry point: `export/excel_exporter.py:65` — `export_risk_report()`

**PowerBI (CSV):**
- No external service — exports structured CSVs
- Output directory: `./powerbi_data/` (created at runtime)
- Connection: PowerBI Desktop → Get Data → Text/CSV (`export/powerbi_exporter.py:6-7`)
- Relationship keys: `ticker`, `date` columns
- Entry point: `export/powerbi_exporter.py:15` — `export_for_powerbi()`

## Frontend ↔ Backend Communication

**Protocol:** HTTP + Server-Sent Events (SSE)
- Library: `sse-starlette >=1.8.2` via `EventSourceResponse` (`api/main.py:9`, `api/main.py:124`)
- Endpoint: `POST /api/chat` — streams typed JSON events
- Event types: `token` (LLM stream chunk), `section` (structured data), `done`, `error`

**CORS:**
- Middleware: `CORSMiddleware` (`api/main.py:78-83`)
- Allowed origin: `http://localhost:3000` (hardcoded)
- Allowed methods: GET, POST
- Allowed headers: `*`

**Health check:** `GET /api/health` — returns `{"status": "ok", "model": "<provider/model>"}` (`api/main.py:92-94`)

**Frontend EventSource:** Next.js frontend consumes SSE stream from `POST /api/chat`; renders markdown via `react-markdown`.

## Agent Wiring (LangChain)

**Pattern:** ReAct (`create_react_agent` + `AgentExecutor`) (`agent/agent.py:93-108`)

**AsyncCallbackHandler:**
- Class: `AnalystCallbackHandler(AsyncCallbackHandler)` (`api/main.py:24-66`)
- Intercepts: `on_llm_new_token` (token streaming), `on_tool_end` (structured section data), `on_chain_end` (done signal), `on_chain_error` (error propagation)
- Internal queue: `asyncio.Queue[str | None]` — SSE events buffered here before streaming

**Memory:** `ConversationBufferWindowMemory(k=10)` (`agent/agent.py:87-91`) — retains last 10 exchanges

**Tool registration:** `ALL_TOOLS` list (`agent/tools.py:250-253`) — 11 tools bound to AgentExecutor

**Agent lifecycle:** Created once at FastAPI startup via `lifespan` context (`api/main.py:69-73`); stored at `app.state.agent_executor`

## Authentication

**Scheme:** API keys via `.env` file only — no user-facing auth layer.

**Required environment variables:**
- `GROQ_API_KEY` — Groq LLM (primary)
- `OPENAI_API_KEY` — OpenAI LLM (fallback; required if Groq key absent)
- `LANGCHAIN_API_KEY` — LangChain Hub prompt pull (implicit; hub pull fails gracefully without it)

**Secrets location:** `.env` file at project root (not committed; loaded by `python-dotenv`)

## Webhooks & Callbacks

**Incoming:** None
**Outgoing:** None (all external calls are request-initiated)

---

*Integration audit: 2026-06-25*
