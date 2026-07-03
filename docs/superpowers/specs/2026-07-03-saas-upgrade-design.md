# SaaS Upgrade — Design Spec

Date: 2026-07-03
Status: Approved direction, pending user review of this document

## Goal

Elevate FinancialRiskSimulator from a working demo to a product that reads like it was
built by a top-1% product company (Linear / Stripe / Vercel bar). Four sub-projects,
executed in order:

1. **Hardening** — fix remaining CONCERNS.md issues
2. **Tests + CI** — cover the fixes, GitHub Actions
3. **Frontend** — SaaS landing page with 3D hero + full `/app` terminal upgrade (primary effort)
4. **Deploy + presentation** — Render (backend) + Vercel (frontend), README overhaul

Inspiration: [TREK](https://github.com/mauriceboe/TREK) — professional product feel,
welcome onboarding, "try the demo, no registration" CTA, README with badges/screenshots,
live demo link.

## Non-goals

- No new analytics features (no backtesting, no new asset classes)
- No auth/user accounts (API key header stays optional)
- No Streamlit app rework (`app.py` gets a deprecation note only)
- No paid infrastructure

---

## Sub-project 1: Hardening

Fix remaining items from `.planning/codebase/CONCERNS.md` (verified still present;
rate limiting, API key, and Monte Carlo seed are already fixed):

| ID | Fix |
|----|-----|
| PATH-01/02 | Validate ticker with `^[A-Z0-9.^=-]{1,12}$` at the API boundary and in every export path; reject otherwise |
| SEC-01 | Prefix `'` to any cell value starting with `=`, `+`, `-`, `@` in Excel exports |
| CORRECT-01 | Rename user-facing label to "Simulation-based (GBM) VaR"; docstring correction |
| CORRECT-02 | Exports reuse the same fetched data + seeded run so exported numbers match screen |
| CORRECT-04 | Replace hardcoded `start="2020-01-01"` with rolling window (`today - 5y`) |
| ARCH-01 | Cancel the agent task when the SSE client disconnects |
| DEPLOY-01 | `NEXT_PUBLIC_API_URL` env var in `sseClient.ts`, falls back to localhost |
| DEPLOY-02 | `ALLOWED_ORIGINS` env var for CORS, comma-separated, falls back to localhost:3000 |
| BUG-01 | Align PowerBI exporter metric keys with what tools pass (`var`, `cvar`, `sharpe`, `max_drawdown`) |
| PERF-01 | Groq client timeout (30s request timeout) |

## Sub-project 2: Tests + CI

- pytest: ticker validation (valid/traversal/formula-injection cases), export key
  alignment, rolling window, seeded reproducibility (same seed → same VaR)
- Existing test suites keep passing (`tests/test_api.py`, `test_simulation.py`,
  `test_options.py`, `test_portfolio.py`)
- GitHub Actions workflow: job 1 `pytest` (Python 3.11), job 2 `npm run build` +
  `tsc --noEmit` (frontend). Runs on push + PR to main.

## Sub-project 3: Frontend (primary effort)

### Route split

- `/` — new marketing landing page (dark SaaS aesthetic)
- `/app` — the analyst terminal (existing UI, upgraded)
- Current `page.tsx` moves to `app/app/page.tsx`; landing is a new `app/page.tsx`

### Design system (landing)

Top-1% bar. References: Linear (typography discipline, dark restraint), Stripe
(depth, gradients), Vercel (contrast, spacing).

- **Colors**: near-black base `#0A0A0B`, elevated surfaces via subtle white alpha
  (`rgba(255,255,255,0.03–0.06)`), amber brand accent `#FFB43C` reserved for CTAs and
  key highlights only (restraint = premium), muted text `#8A8F98`-style grays
- **Type**: Geist or Inter variable — display sizes with tight tracking (-0.02em) for
  headlines, 15–16px body, mono (IBM Plex Mono) for numbers/tickers as brand echo
- **Spacing**: 8px rhythm, generous section padding (128px+ desktop)
- **Motion**: 150–250ms ease-out micro-interactions; scroll reveals via framer-motion
  (fade + 12px rise, once); no bounce, no gimmicks; respects `prefers-reduced-motion`
- **Cards**: 1px `rgba(255,255,255,0.08)` borders, gradient-border hover, glass blur
  only where content overlaps the 3D canvas

### Landing sections

1. **Nav** — logo, pill links (Features · How it works · Tech), GitHub star link,
   amber "Launch Terminal" CTA. Sticky, blurs on scroll.
2. **Hero** — R3F 3D scene: Monte Carlo particle fan — thousands of glowing amber
   price-path particles flowing from an origin point, slow orbital drift, mouse
   parallax, additive blending for glow. Headline + subline + dual CTA
   ("Try the demo — no sign-up needed" primary, "View on GitHub" ghost).
   Lazy-loaded via `next/dynamic`; static gradient fallback while loading and for
   `prefers-reduced-motion`.
3. **Stat strip** — animated counters (10k simulated paths · 8 analysis tools ·
   4 risk metrics · <1s first token) triggered on scroll into view.
4. **Feature grid** — TREK-style chip cards: VaR/CVaR, Monte Carlo, Options/BSM,
   Efficient Frontier, Stress Tests, News Sentiment, Excel/PowerBI Export, AI Agent.
   Icon + title + one-liner. Hover lift + border glow.
5. **Product frame** — terminal screenshot in a browser-chrome frame, subtle
   3D tilt on hover, amber glow shadow.
6. **How it works** — 3 steps: ask in English → agent runs the math → analyst
   report streams in. Small inline visuals.
7. **Tech strip** — logo row: Python, LangChain, FastAPI, Next.js, Three.js, Groq.
8. **CTA banner** — full-width, gradient mesh background, "Launch Terminal".
9. **Footer** — open-source note, GitHub, stack credits.

### `/app` terminal upgrade (full)

Keeps phosphor-amber identity; tightened to product grade:

- **Welcome modal** (first visit, localStorage-dismissed): what it does, 3 sample
  queries as clickable chips, demo-mode note (rate limit, data source)
- **Command palette** (Ctrl+K / ⌘K): quick queries, recent tickers, section jump;
  fuzzy match; phosphor styling
- **History rail**: session analyses list (ticker + timestamp) in sidebar; click
  restores that report from client-side state
- **Skeleton loaders**: shimmer placeholder cards replace spinner during tool runs
- **Chart upgrades**: Monte Carlo fan chart with hover tooltip (percentile at x),
  price chart crosshair; smooth entrance draws
- **Micro-polish**: consistent type scale, spacing rhythm pass, card print-in easing,
  focus states, reduced-motion support
- **Responsive pass**: mobile layout for cards, palette, and query bar
- **404 page** + page transitions + favicon/OG image (phosphor terminal motif)

### Bundle discipline

Three.js only on `/` via dynamic import; `/app` stays lean. Landing LCP target <2.5s
on Fast 3G; no layout shift from 3D canvas (fixed aspect container).

## Sub-project 4: Deploy + presentation

- **Backend → Render free tier**: `render.yaml`, uvicorn start command, env vars
  (`GROQ_API_KEY`, `ALLOWED_ORIGINS`, `RATE_LIMIT`), health check endpoint
- **Frontend → Vercel**: `NEXT_PUBLIC_API_URL` env, root dir `frontend/`
- **README overhaul** (TREK bar): centered wordmark, badges (live demo · license ·
  Python · Next.js), hero screenshot, feature table, 60-second quickstart,
  architecture diagram, screenshots grid, tech stack section
- Cold-start note in welcome modal (Render free tier sleeps; first request ~30s)

## Error handling

- Invalid ticker → 422 with clear message; frontend shows inline error card
- SSE disconnect → server task cancelled; client shows "connection lost — retry"
- 3D scene WebGL unavailable → static hero fallback (feature-detect)

## Testing

- Backend: pytest suites above
- Frontend: `tsc --noEmit` + production build in CI; manual QA pass via /qa after
  build (landing scroll, palette, modal, mobile)

## End-to-end integration (hard requirement)

The project must work as one system, verified live, not assumed:

- **Full-stack smoke run**: both servers up; a real query ("What is the VaR for AAPL?")
  produces StockCard → MonteCarloCard → RiskCard → VerdictCard → CaveatsCard streaming
  over SSE. Repeat for portfolio, options, stress test, frontier, and news queries —
  every tool's structured event renders its card, none fall back to raw prose.
- **Config chain**: one `.env` (backend) + one `.env.local` (frontend) drive everything;
  `NEXT_PUBLIC_API_URL` → `ALLOWED_ORIGINS` pairing documented; same envs map 1:1 to
  Render/Vercel dashboards.
- **Exports verified**: export tool produces Excel/CSV whose numbers match the on-screen
  report (shared seeded run).
- **Error paths verified live**: invalid ticker, rate-limit hit, backend down → each
  shows its designed UI state, not a blank screen or console error.
- **Landing ↔ app**: CTA routes to `/app`; browser back returns to landing; deep-link
  to `/app` works cold.
- Verification happens with the browse-based QA pass before deploy, and once more
  against the deployed URLs after deploy.

## Execution order

Hardening → Tests+CI → Frontend (landing → app upgrade) → E2E integration pass →
README → Deploy → post-deploy E2E pass.
Each sub-project is a separate plan + commit series. Commits carry no AI attribution.
