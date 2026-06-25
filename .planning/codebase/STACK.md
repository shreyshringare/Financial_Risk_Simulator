# Technology Stack

**Analysis Date:** 2026-06-25

## Languages

**Primary:**
- Python 3.x — backend, agent, simulation, data, RAG, export
- TypeScript 5.x — Next.js frontend (`frontend/tsconfig.json`, `frontend/package.json`)

## Runtime

**Environment:**
- Python (version unspecified; constrained by dependency floors: numpy>=1.24, pandas>=2.0, fastapi>=0.111)
- Node.js (version unspecified; Next.js 16 requires Node 18+)

**Package Manager:**
- Python: pip — lockfile not present, only `requirements.txt`
- Node: npm — `frontend/package-lock.json` (present via npm install); `frontend/package.json` defines scripts

## Frameworks

**Backend:**
- FastAPI `>=0.111.0` — REST API server (`api/main.py`)
- Uvicorn `>=0.29.0` (standard extras) — ASGI server
- sse-starlette `>=1.8.2` — SSE streaming via `EventSourceResponse` (`api/main.py:9`)
- Streamlit `>=1.30.0` — legacy UI entrypoint (retained in `requirements.txt`; primary UI is Next.js)

**Frontend:**
- Next.js `16.2.9` — React SSR framework (`frontend/package.json:11`)
- React `19.2.4` / React DOM `19.2.4`
- Tailwind CSS `^4` (via `@tailwindcss/postcss`)
- react-markdown `^10.1.0` — renders agent markdown output

**AI / Agent:**
- LangChain `>=0.3.0,<1.0.0` — core orchestration (`agent/agent.py`)
- langchain-core `>=0.3.0,<1.0.0`
- langchain-groq `>=0.2.0,<1.0.0` — Groq LLM client (`agent/agent.py:27`)
- langchain-openai `>=0.2.0,<1.0.0` — OpenAI fallback (`agent/agent.py:35`)
- langchain-community `>=0.3.0,<1.0.0` — WebBaseLoader, Chroma vectorstore
- langchain-huggingface `>=0.1.0,<1.0.0` — HuggingFace embeddings
- sentence-transformers `>=2.7.0` — local embedding model backend

**Testing:**
- Not detected — no test runner config (jest, pytest, vitest) found

**Build/Dev:**
- `next dev` / `next build` / `next start` — frontend dev/build
- `uvicorn api.main:app --reload` — backend dev (inferred from FastAPI/uvicorn setup)

## Key Dependencies

**Critical:**
- `chromadb >=0.4.0` — local vector store for RAG (`rag/knowledge_base.py:8`)
- `yfinance >=0.2.36` — primary market data source (`agent/tools.py:5`, `data/market_data.py:9`)
- `numpy >=1.24.0` — Monte Carlo simulation arrays (`simulation/`, `export/`)
- `pandas >=2.0.0` — DataFrame operations throughout
- `pydantic` — request validation via FastAPI BaseModel (`api/main.py:12`)
- `python-dotenv >=1.0.0` — `.env` loading in `agent/agent.py:11`, `api/main.py:14`

**Infrastructure:**
- `openpyxl >=3.1.0` — multi-sheet Excel report generation (`export/excel_exporter.py`)
- `feedparser >=6.0.0` — RSS news aggregation (`news/rss_feed.py:9`)
- `pandas-datareader >=0.10.0` — Stooq fallback data source (`data/market_data.py:41`)
- `beautifulsoup4 >=4.12.0` — Yahoo Finance scrape fallback (`data/market_data.py:51`)
- `requests >=2.31.0` — HTTP for scrape fallback
- `scipy >=1.11.0` — statistical computations (risk metrics, efficient frontier)
- `matplotlib >=3.7.0` — chart generation (available; not directly observed in agent flow)
- `selenium >=4.0.0` + `webdriver-manager >=4.0.0` — browser automation (present; `get_data_source_status` checks availability at `data/market_data.py:88`)

## Configuration

**Environment:**
- `.env` file loaded via `python-dotenv` at startup in `agent/agent.py:11` and `api/main.py:14`
- Required keys: `GROQ_API_KEY` (primary LLM), `OPENAI_API_KEY` (fallback LLM)
- CORS origin hardcoded to `http://localhost:3000` (`api/main.py:81`)

**Build:**
- `frontend/tsconfig.json` — TypeScript config
- `frontend/postcss.config.*` — Tailwind PostCSS pipeline
- No Dockerfile or `pyproject.toml` detected

## Platform Requirements

**Development:**
- Python environment with all `requirements.txt` packages
- Node 18+ for Next.js 16
- Internet access on first RAG cold-start (~60s, ~110MB model download to `./chroma_db/`)
- `./chroma_db/` directory created on first run; subsequent starts are ~0.3s

**Production:**
- Deployment target not detected (no Dockerfile, Vercel config, or cloud config found)
- FastAPI served via uvicorn; Next.js served via `next start`
- `./reports/` and `./powerbi_data/` directories created at runtime by export functions

---

*Stack analysis: 2026-06-25*
