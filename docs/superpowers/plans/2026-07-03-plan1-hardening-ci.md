# Plan 1: Hardening + Tests + CI Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Close the remaining CONCERNS.md gaps (rolling data window, env-based CORS, env-based API URL) with tests, add GitHub Actions CI, and refresh the stale CONCERNS.md.

**Architecture:** Small surgical fixes. A single `_default_start()` helper in `agent/tools/base.py` replaces five hardcoded `"2020-01-01"` literals. CORS origins move to an `ALLOWED_ORIGINS` env var in `api/main.py`. The frontend API base moves to `NEXT_PUBLIC_API_URL`. CI runs pytest and the Next.js production build.

**Tech Stack:** Python 3.11+, pytest, FastAPI, Next.js 16, GitHub Actions.

**Commit policy:** NO AI attribution. No `Co-Authored-By`, no "Generated with" lines. Plain conventional commits.

---

### Task 1: Rolling data window helper

**Files:**
- Modify: `agent/tools/base.py` (5 call sites at lines 43, 66, 87, 181, 197)
- Test: `tests/test_tools.py` (append)

- [ ] **Step 1: Write the failing test**

Append to `tests/test_tools.py`:

```python
from datetime import date, timedelta

from agent.tools.base import _default_start


def test_default_start_is_rolling_five_years():
    expected = date.today() - timedelta(days=5 * 365)
    assert _default_start() == expected.isoformat()


def test_default_start_not_hardcoded_2020():
    assert _default_start() != "2020-01-01"
```

- [ ] **Step 2: Run test to verify it fails**

Run: `python -m pytest tests/test_tools.py -k default_start -v`
Expected: FAIL with `ImportError: cannot import name '_default_start'`

- [ ] **Step 3: Implement the helper and replace all five literals**

In `agent/tools/base.py`, add below `_sanitize_ticker`:

```python
from datetime import date, timedelta

def _default_start() -> str:
    """Rolling 5-year window so the data range doesn't shrink as time passes."""
    return (date.today() - timedelta(days=5 * 365)).isoformat()
```

Replace every occurrence of `start="2020-01-01"` inside function bodies with
`start=_default_start()` (lines 66, 87, 181, 197). For the tool signature on
line 43 (`def fetch_stock_data(ticker: str, start: str = "2020-01-01")`),
change the default to `start: str = ""` and inside the body add:

```python
        start = start or _default_start()
```

(A LangChain `@tool` default must stay a literal; empty string sentinel keeps
the tool schema stable.)

- [ ] **Step 4: Run tests to verify they pass**

Run: `python -m pytest tests/test_tools.py -v`
Expected: PASS (all, including the two new tests)

- [ ] **Step 5: Commit**

```bash
git add agent/tools/base.py tests/test_tools.py
git commit -m "fix(tools): rolling 5y data window instead of hardcoded 2020-01-01"
```

---

### Task 2: Env-based CORS origins

**Files:**
- Modify: `api/main.py:35-40`
- Test: `tests/test_api.py` (append)

- [ ] **Step 1: Write the failing test**

Append to `tests/test_api.py`:

```python
import importlib


def test_cors_origins_from_env(monkeypatch):
    monkeypatch.setenv("ALLOWED_ORIGINS", "https://a.example,https://b.example")
    import api.main
    importlib.reload(api.main)
    origins = api.main._allowed_origins()
    assert origins == ["https://a.example", "https://b.example"]
    monkeypatch.delenv("ALLOWED_ORIGINS")
    importlib.reload(api.main)


def test_cors_origins_default_localhost():
    import api.main
    assert api.main._allowed_origins() == ["http://localhost:3000"]
```

- [ ] **Step 2: Run test to verify it fails**

Run: `python -m pytest tests/test_api.py -k cors -v`
Expected: FAIL with `AttributeError: module 'api.main' has no attribute '_allowed_origins'`

- [ ] **Step 3: Implement**

In `api/main.py`, replace the middleware block (lines 35-40) with:

```python
def _allowed_origins() -> list[str]:
    raw = os.getenv("ALLOWED_ORIGINS", "http://localhost:3000")
    return [o.strip() for o in raw.split(",") if o.strip()]


app.add_middleware(
    CORSMiddleware,
    allow_origins=_allowed_origins(),
    allow_methods=["GET", "POST"],
    allow_headers=["*"],
)
```

Also append to `.env.example`:

```
# Comma-separated list of allowed CORS origins (default: http://localhost:3000)
ALLOWED_ORIGINS=http://localhost:3000
```

- [ ] **Step 4: Run tests**

Run: `python -m pytest tests/test_api.py -v`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add api/main.py tests/test_api.py .env.example
git commit -m "feat(api): ALLOWED_ORIGINS env var for CORS"
```

---

### Task 3: Env-based frontend API URL

**Files:**
- Modify: `frontend/src/lib/sseClient.ts:3`
- Create: `frontend/.env.example`

- [ ] **Step 1: Implement (no unit test — verified by `npm run build` + E2E pass later)**

`frontend/src/lib/sseClient.ts` line 3:

```typescript
const API_BASE = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000";
```

Create `frontend/.env.example`:

```
# Base URL of the FastAPI backend (no trailing slash)
NEXT_PUBLIC_API_URL=http://localhost:8000
```

- [ ] **Step 2: Verify build**

Run: `cd frontend && npm run build`
Expected: build succeeds, no type errors

- [ ] **Step 3: Commit**

```bash
git add frontend/src/lib/sseClient.ts frontend/.env.example
git commit -m "feat(frontend): NEXT_PUBLIC_API_URL env var for API base"
```

---

### Task 4: GitHub Actions CI

**Files:**
- Create: `.github/workflows/ci.yml`

- [ ] **Step 1: Create workflow**

```yaml
name: CI

on:
  push:
    branches: [main]
  pull_request:
    branches: [main]

jobs:
  backend:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-python@v5
        with:
          python-version: "3.11"
          cache: pip
      - run: pip install -r requirements.txt
      - run: python -m pytest tests/ -v
        env:
          GROQ_API_KEY: ""

  frontend:
    runs-on: ubuntu-latest
    defaults:
      run:
        working-directory: frontend
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: 20
          cache: npm
          cache-dependency-path: frontend/package-lock.json
      - run: npm ci
      - run: npx tsc --noEmit
      - run: npm run build
```

- [ ] **Step 2: Verify tests pass locally first**

Run: `python -m pytest tests/ -v && cd frontend && npx tsc --noEmit && npm run build`
Expected: all pass

- [ ] **Step 3: Commit**

```bash
git add .github/workflows/ci.yml
git commit -m "ci: GitHub Actions — pytest + frontend typecheck/build"
```

---

### Task 5: Refresh stale CONCERNS.md

**Files:**
- Modify: `.planning/codebase/CONCERNS.md`

- [ ] **Step 1: Update document**

Mark as FIXED (with one-line note of where): PATH-01/02 (`_sanitize_ticker` in
`agent/tools/base.py:12-19`), SEC-01 (`_FORMULA_PREFIXES` in
`export/excel_exporter.py:340`), CORRECT-01 (historical VaR now primary in
`calculate_risk_metrics`), CORRECT-02/03 (seeded MC `seed=42`), CORRECT-04
(this plan Task 1), PERF-01 (`request_timeout=60` in `agent/agent.py:31`),
ARCH-01 (task cancel in `api/main.py:118-123`), BUG-01 (`.get("var")` in
`powerbi_exporter.py`), DEPLOY-01/02 (this plan Tasks 2-3). Keep open: ARCH-02
(vectorstore race), ARCH-03 (hub.pull at startup — actually now gone; verify),
ARCH-04 (stale Streamlit app.py), SEC-02 (key rotation note).

- [ ] **Step 2: Commit**

```bash
git add .planning/codebase/CONCERNS.md
git commit -m "docs: refresh CONCERNS.md — mark fixed items, keep open ones"
```
