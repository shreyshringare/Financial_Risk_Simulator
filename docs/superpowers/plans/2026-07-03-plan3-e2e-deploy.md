# Plan 3: E2E Integration + README + Deploy Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Verify the whole system works end to end locally, overhaul the README to product grade, deploy backend to Render and frontend to Vercel, and re-verify against live URLs.

**Architecture:** No new code except `render.yaml` and README assets. This plan is verification + configuration + presentation.

**Tech Stack:** Render (free tier, uvicorn), Vercel (Next.js), /browse headless browser for QA.

**Commit policy:** NO AI attribution. Plain conventional commits.

---

### Task 1: Local E2E pass

**Files:** none (verification only; fix bugs found as separate commits)

- [ ] **Step 1: Start both servers**

```bash
# Terminal 1
cd "D:/Projects/SDE Projects/FinancialRiskSimulator"
venv/Scripts/python -m uvicorn api.main:app --port 8000

# Terminal 2
cd frontend && npm run dev
```

- [ ] **Step 2: Query matrix via /browse**

For each query, verify the named cards render (no raw ReAct prose fallback):

| Query | Expected cards |
|---|---|
| "What is the VaR for AAPL?" | Stock → MonteCarlo → Risk → Verdict → Caveats |
| "Analyze a portfolio of AAPL, MSFT, TSLA" | Portfolio card |
| "Price a $200 call on NVDA expiring in 90 days" | Options card |
| "Stress test AAPL against covid 2020" | StressTest card |
| "Compute the efficient frontier for AAPL, MSFT" | Frontier card |
| "Get the latest news for MSFT" | News card |

- [ ] **Step 3: Error paths**

- Invalid ticker: "What is the VaR for ../../etc?" → error card, no crash
- Kill backend, submit query → "HTTP …"/network error card, not blank screen
- Fire 21 rapid requests → 429 surfaces as readable error

- [ ] **Step 4: Export check**

Query: "Export a risk report for AAPL to Excel". Open the file from `reports/`;
VaR/CVaR match the on-screen risk card values (both use seeded MC + same
historical window).

- [ ] **Step 5: Landing ↔ app navigation**

`/` → CTA → `/app` → browser back → `/`. Cold deep-link to `/app` works.
`Ctrl+K` palette, welcome modal (fresh localStorage), history restore.

- [ ] **Step 6: Fix anything broken; commit fixes individually; then:**

```bash
git commit --allow-empty -m "test: local E2E pass — all tool cards, error paths, exports verified"
```

---

### Task 2: render.yaml + backend deploy prep

**Files:**
- Create: `render.yaml`
- Modify: `requirements.txt` (verify uvicorn pinned)

- [ ] **Step 1: render.yaml**

```yaml
services:
  - type: web
    name: finsim-api
    runtime: python
    plan: free
    buildCommand: pip install -r requirements.txt
    startCommand: uvicorn api.main:app --host 0.0.0.0 --port $PORT
    healthCheckPath: /api/health
    envVars:
      - key: GROQ_API_KEY
        sync: false
      - key: ALLOWED_ORIGINS
        sync: false
      - key: RATE_LIMIT
        value: "20"
      - key: PYTHON_VERSION
        value: "3.11.9"
```

Concerns to verify before deploy:
- ChromaDB/selenium/R deps in `requirements.txt` may exceed free-tier build.
  If build fails, split a `requirements-deploy.txt` without `selenium` and
  R-bridge extras, and point `buildCommand` at it. `rag_financial_query` and
  GARCH must degrade gracefully (they already return error strings on failure).

- [ ] **Step 2: Commit**

```bash
git add render.yaml
git commit -m "deploy: render.yaml for FastAPI backend (free tier)"
```

---

### Task 3: Deploy backend to Render

**Requires user action:** Render account + dashboard steps. Provide the user:

1. Push repo to GitHub (must be public or Render-connected)
2. Render dashboard → New → Blueprint → select repo → applies `render.yaml`
3. Set secrets: `GROQ_API_KEY` (their key), `ALLOWED_ORIGINS` (Vercel URL once
   known — can start with `http://localhost:3000` and update after Task 4)
4. Deploy; verify `https://finsim-api.onrender.com/api/health` returns
   `{"status":"ok", ...}`

- [ ] Verified health endpoint live

---

### Task 4: Deploy frontend to Vercel

**Requires user action:**

1. Vercel dashboard → New Project → import repo → Root Directory: `frontend`
2. Env var: `NEXT_PUBLIC_API_URL=https://finsim-api.onrender.com`
3. Deploy → note the URL (e.g. `https://finsim.vercel.app`)
4. Back in Render: set `ALLOWED_ORIGINS=https://finsim.vercel.app` → redeploy

- [ ] Verified landing live, `/app` live

---

### Task 5: Post-deploy E2E pass

- [ ] Repeat Task 1 Steps 2/3/5 against the live URLs via /browse.
      Expect first query to take ~30s (Render cold start) — welcome modal
      already warns about this.
- [ ] Verify CORS: browser console shows no CORS errors on live site.

---

### Task 6: README overhaul

**Files:**
- Modify: `README.md`
- Create: `docs/screenshots/landing.png`, `docs/screenshots/terminal.png`,
  `docs/screenshots/options.png`, `docs/screenshots/portfolio.png` (captured via /browse)

- [ ] **Step 1: Capture screenshots** (1440 wide, live site or local)

- [ ] **Step 2: Rewrite README.md** (TREK bar). Structure:

```markdown
<div align="center">

# ◆ FinSim

**Agentic financial risk analysis — in plain English.**

[Live demo](https://finsim.vercel.app) · [How it works](#how-it-works) · [Quickstart](#quickstart)

![CI](https://github.com/<user>/<repo>/actions/workflows/ci.yml/badge.svg)
![Python](https://img.shields.io/badge/Python-3.11-3776AB?logo=python&logoColor=white)
![Next.js](https://img.shields.io/badge/Next.js-16-000?logo=nextdotjs)
![LangChain](https://img.shields.io/badge/LangChain-ReAct_agent-1C3C3C)
![License](https://img.shields.io/badge/license-MIT-gray)

<img src="docs/screenshots/landing.png" width="100%" alt="FinSim landing page" />

</div>

Ask "What is the VaR for AAPL?" — an AI agent fetches market data, runs 10,000
Monte Carlo paths, computes VaR/CVaR/Sharpe/drawdown, and streams an analyst
report card by card.

## Features
<table with 2-col screenshot grid: terminal, options, portfolio + feature bullets>

## How it works
<3 steps + architecture diagram (ASCII or mermaid): Next.js → SSE → FastAPI → LangChain ReAct → tools>

## Quickstart
<backend: venv, pip install, .env with GROQ_API_KEY, uvicorn. frontend: npm i, npm run dev. 60 seconds.>

## Tech stack
<table: layer / choice / why>

## Risk methodology
<one paragraph: historical VaR primary, GBM simulation companion, seeded reproducibility, honest caveats>

## Disclaimer
Educational project. Not investment advice.
```

No license file exists — add MIT `LICENSE` with the user's name, or drop the
license badge. Ask user which.

- [ ] **Step 3: Commit**

```bash
git add README.md docs/screenshots LICENSE
git commit -m "docs: product-grade README — badges, screenshots, quickstart, architecture"
```

---

### Task 7: Push + verify CI

- [ ] `git push origin main`
- [ ] GitHub Actions: both jobs green
- [ ] README renders correctly on GitHub (badges, images)
