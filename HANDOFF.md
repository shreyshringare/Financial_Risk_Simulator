# HANDOFF — Agentic Financial Risk Simulator

Session date: 2026-06-24  
Status: **IN PROGRESS — Next.js + FastAPI migration, Tasks 1-4 done, Tasks 5-11 remain**

---

## Context

Building for JPMC CIB Research & Analytics, Banking Fintech — Junior Analyst internship (Mumbai, Jan–Jun 2027). Main resume differentiator.

Resume line:
> "Built an agentic financial risk platform (Python + LangChain + FastAPI + Next.js) — Monte Carlo simulation, VaR/CVaR/Sharpe/max-drawdown, multi-ticker portfolio analysis, global market support. Natural language interface via Groq/llama-3.3-70b agent. Analyst report UI with SSE streaming."

---

## Architecture (LOCKED)

```
frontend/ (Next.js 14 · TypeScript · Tailwind · localhost:3000)
    ↕  POST /api/chat  →  SSE stream of typed events
api/ (FastAPI · uvicorn · localhost:8000)
    ↕  unchanged imports
agent/ simulation/ rag/ portfolio/ export/ news/ data/ r_analysis/
```

**SSE Event Protocol:**
```typescript
type SSEEvent =
  | { type: "section"; section: "stock"|"monte_carlo"|"risk"|"caveats"; data: {...} }
  | { type: "token"; token: string }
  | { type: "error"; message: string }
  | { type: "done" }
```

---

## UX Design (LOCKED — Phosphor Terminal aesthetic)

**Design:** Vintage trading terminal. Amber phosphor glow on near-black. VT323 font for headers/numbers. IBM Plex Mono for prose/labels. Scanline overlay. Section cards "print in" with staggered animation.

**Prototype:** `frontend/public/design-prototype.html` — open in browser to see full design.

**Color tokens:**
```css
--black:        #050505
--surface:      #0A0A0A
--card:         #0F0F0F
--amber:        #FFB43C
--amber-bright: #FFD280
--amber-dim:    rgba(255,180,60,0.45)
--green:        #39FF14   /* LOW risk */
--yellow:       #FFD700   /* MODERATE risk */
--red:          #FF3131   /* HIGH risk */
--text:         #F0C060
--text-dim:     rgba(240,192,96,0.55)
```

**Fonts:**
- `VT323` — headers, tickers, large numbers
- `IBM Plex Mono` — labels, prose, data values

**Section cards:** amber left-border accent, `1px solid rgba(255,180,60,0.12)` border, `print-in` animation (clip-path sweep + fade).

**Risk badges:** LOW=green glow, MODERATE=yellow glow, HIGH=red glow. All use `text-shadow` for phosphor effect.

---

## What's Built (Tasks 1-4 ✅)

| Task | Status | Files |
|------|--------|-------|
| Python deps | ✅ | `requirements.txt` |
| FastAPI skeleton | ✅ | `api/__init__.py`, `api/main.py`, `tests/test_api.py` |
| SSE streaming | ✅ | `api/main.py` (full `AnalystCallbackHandler`) |
| Next.js scaffold | ✅ | `frontend/` (TypeScript, Tailwind, react-markdown) |
| Design prototype | ✅ | `frontend/public/design-prototype.html` |

**Key fix applied:** `agent/tools.py` — all `data['Close']` changed to `data['Close'].squeeze()` (yfinance 0.2+ multi-level column fix). All 10 tests pass.

**Groq API key:** in `.env`. LLM: llama-3.3-70b-versatile. Free tier 100K TPD — may rate-limit after heavy use.

---

## What Remains (Tasks 5-11)

All tasks defined in: `docs/superpowers/plans/2026-06-24-nextjs-fastapi-migration.md`

| Task | What | Files |
|------|------|-------|
| 5 | Types + riskUtils + sseClient | `frontend/src/types/events.ts`, `lib/riskUtils.ts`, `lib/sseClient.ts` |
| 6 | Tailwind theme + globals + layout | `tailwind.config.ts`, `globals.css`, `layout.tsx` |
| 7 | Section cards | `cards/StockCard.tsx`, `MonteCarloCard.tsx`, `RiskCard.tsx`, `VerdictCard.tsx`, `CaveatsCard.tsx`, `ProseCard.tsx` |
| 8 | QueryBar + Sidebar | `components/QueryBar.tsx`, `Sidebar.tsx` |
| 9 | ReportArea | `components/ReportArea.tsx` |
| 10 | Terminal page | `src/app/page.tsx` (useReducer SSE orchestration) |
| 11 | Integration smoke test | Manual — start both servers, verify end-to-end |

**CRITICAL for Tasks 5-10:** Port the phosphor terminal aesthetic from `design-prototype.html` into the components. Do NOT use the default Tailwind/Robinhood theme in the plan — the plan was written before the design was finalized. Use the design prototype as the source of truth for CSS.

---

## Design → Tailwind Mapping

In `tailwind.config.ts`, add these custom colors:
```typescript
colors: {
  terminal: "#050505",
  surface: "#0A0A0A",
  card: "#0F0F0F",
  "amber": "#FFB43C",
  "amber-bright": "#FFD280",
  "phosphor-green": "#39FF14",
  "phosphor-yellow": "#FFD700",
  "phosphor-red": "#FF3131",
  "text-primary": "#F0C060",
  "text-dim": "rgba(240,192,96,0.55)",
  "text-faint": "rgba(240,192,96,0.28)",
  border: "rgba(255,180,60,0.12)",
  "border-dim": "rgba(255,180,60,0.06)",
}
```

In `globals.css`, add:
- Scanline overlay via `body::before` (repeating-linear-gradient)
- CRT vignette via `body::after` (radial-gradient)
- `.card-amber-accent::before` — 3px amber left border
- `@keyframes print-in` — clip-path sweep animation
- `@keyframes blink-cursor` — amber cursor blink
- `.streaming-cursor::after` — amber block cursor on verdict card
- Google Fonts import: VT323 + IBM Plex Mono

---

## Run Instructions

```bash
# Backend
cd "D:/SDE Projects/FinancialSim"
venv/Scripts/python -m uvicorn api.main:app --reload --port 8000

# Frontend (once built)
cd "D:/SDE Projects/FinancialSim/frontend"
npm run dev
# → http://localhost:3000
```

---

## To Resume Next Session

Say: **"resume HANDOFF"** — Claude reads this file.  
Then say: **"continue from Task 5"** to pick up where we left off.

Plan file: `docs/superpowers/plans/2026-06-24-nextjs-fastapi-migration.md`  
Design spec: `docs/superpowers/specs/2026-06-24-nextjs-fastapi-migration-design.md`  
Prototype: `frontend/public/design-prototype.html`
