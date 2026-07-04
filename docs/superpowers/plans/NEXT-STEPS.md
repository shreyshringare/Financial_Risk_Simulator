# FinSim — What To Do Next

State as of 2026-07-04, branch `feat/saas-upgrade` (40 tests green, tsc + build clean).

## What's done

- **Hardening + CI**: rolling 5y data window, env-based CORS (`ALLOWED_ORIGINS`) and API URL (`NEXT_PUBLIC_API_URL`), GitHub Actions (pytest + frontend build), per-IP rate limiting, optional `X-API-Key`.
- **Design**: UX Anthropic / UI colors Goldman Sachs. Landing at `/` (serif editorial, navy `#003a70`, 3D Monte Carlo particle hero). App at `/app` = "Research Note" desk: typeset analyst cards, live agent-reasoning timeline, welcome modal, Ctrl+K palette, session history shelf, smooth transitions. Phosphor terminal fully removed.
- **Backend**: `status` SSE events (timeline), research-desk report tone, 99% VaR/CVaR, annualized vol, beta vs SPY, stress-scenario name normalizer, yfinance Series fix (13/13 tools pass direct invoke).
- **News-driven quick queries**: `GET /api/suggestions` derives queries from today's headlines (15-min cache, static fallback); wired into sidebar (LIVE tag), modal, palette, empty state.
- **Dead code removed**: `app.py` (Streamlit), `main.py` (CLI), selenium scraper + 3 deps.

## Run locally

```bash
# Terminal 1 — backend
venv/Scripts/python -m uvicorn api.main:app --port 8000

# Terminal 2 — frontend
cd frontend && npm run dev
# → http://localhost:3000
```

`.env` (repo root) needs `GROQ_API_KEY`. `frontend/.env.local` has `NEXT_PUBLIC_API_URL`.

## Remaining verification (blocked on Groq daily quota — ~3–10k tokens per query)

When quota resets, run each once in the browser:
1. "Stress test AAPL against covid 2020" → StressTest card, no tool-call loop, ends clean (verifies normalizer E2E).
2. "What is the VaR for ../../etc/passwd?" → graceful error card.
3. Any VaR query → watch timeline steps check off, title block, Assessment callout, new metrics rows (99% VaR, ann. vol, beta).
4. 21 rapid requests → readable 429 message.

## Deploy (deferred by choice)

1. **Rotate the Groq key first** — current key was pasted in chat. console.groq.com → new key → update `.env`.
2. Backend → Render free tier: `render.yaml` plan exists in
   [docs/superpowers/plans/2026-07-03-plan3-e2e-deploy.md](docs/superpowers/plans/2026-07-03-plan3-e2e-deploy.md) Task 2.
   Watch: heavy deps (chromadb) may need a slimmed `requirements-deploy.txt`; free tier sleeps (~30s cold start — welcome modal already warns).
3. Frontend → Vercel: root dir `frontend/`, env `NEXT_PUBLIC_API_URL=<render-url>`.
4. Back-fill Render `ALLOWED_ORIGINS=<vercel-url>`.
5. Re-run the 4 verification queries against live URLs.

## Presentation (biggest resume ROI still on the table)

- **README overhaul** (plan exists — plan3 Task 6): centered wordmark, badges (CI · Python · Next.js · LangChain), hero screenshot, feature table, 60-second quickstart, architecture diagram, risk-methodology paragraph, disclaimer. Capture screenshots at 1440px from the live app.
- **Screenshots to take**: landing hero, full AAPL research note with timeline, options card, portfolio card.
- Optional but high-signal: **agent eval harness** — 6 canned queries asserting expected tool-call sequence + output schema, run in CI ("built evals for agent behavior" is a rare resume line). Costs ~30-60k Groq tokens per run, so gate it behind a manual workflow trigger, not every push.

## Merge

When happy: `git checkout main && git merge feat/saas-upgrade && git push origin main`. CI runs on push. Branch has clean conventional commits, no AI attribution.

## Known open items (documented in .planning/codebase/CONCERNS.md)

- ARCH-02: vectorstore init race (no lock) — cosmetic under current usage.
- SEC-02: key rotation policy — see Deploy step 1.
- Sidebar collapse animation freezes in headless preview tabs (browser throttling artifact, not a code bug) — sanity-check once in a real browser.
