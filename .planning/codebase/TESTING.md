# Testing

## Framework

- **pytest** (no `pytest.ini` or `pyproject.toml` config found)
- `unittest.mock` for patching
- No `conftest.py`
- No CI config (no `.github/workflows/`, no `Makefile` test target)

## Test Files

| File | Coverage | Tests |
|------|----------|-------|
| `tests/test_api.py` | Health endpoint only; mocks `create_agent` | 1 |
| `tests/test_tools.py` | Error path for `fetch_stock_data`; output shape for `calculate_risk_metrics` | 2 |
| `tests/test_portfolio.py` | Correlation matrix shape/properties; portfolio VaR keys/constraints | 2 |
| `tests/test_simulation.py` | MC output shape; VaR sign; Sharpe edge case | 3 |
| `tests/test_stress_test.py` | Scenario list structure; stress worsens VaR; invalid scenario error | 3 |
| **Total** | | **11** |

## What Is Tested

- `run_monte_carlo` output shape `(simulations, days)` — `test_simulation.py`
- `calculate_var` returns negative float — `test_simulation.py`
- `calculate_sharpe` on constant-price series (edge case) — `test_simulation.py`
- `calculate_correlation_matrix` is symmetric and diagonal-ones — `test_portfolio.py`
- `calculate_portfolio_var` returns expected keys — `test_portfolio.py`
- `run_stress_test` worsens VaR vs baseline — `test_stress_test.py`
- Invalid scenario raises `ValueError` — `test_stress_test.py`
- `/api/health` returns `{"status": "ok"}` — `test_api.py`

## Critical Gaps

**Untested endpoints:**
- `/api/chat` SSE streaming endpoint — zero coverage

**Untested tools (all of these are in `ALL_TOOLS` but have no tests):**
- `explain_risk`
- `rag_financial_query`
- `export_analysis_report`
- `get_financial_news`
- `compute_efficient_frontier_tool`
- `analyze_portfolio`
- `get_market_movers`

**Untested modules:**
- `portfolio/efficient_frontier.py`
- `r_analysis/garch_bridge.py`
- `news/rss_feed.py`
- `export/excel_exporter.py`
- `export/powerbi_exporter.py`
- `rag/knowledge_base.py`
- `data/market_data.py`

**No integration or E2E tests** — no test exercises a full chat → agent → tool → SSE response cycle.

**No mocking of external calls** in most tests — `test_tools.py` tests that likely hit real yfinance on run.
