import { API_BASE } from "./sseClient";

export type Suggestion = { query: string; source: string | null };

const FALLBACK: Suggestion[] = [
  { query: "What is the VaR for AAPL?", source: null },
  { query: "Price a $200 call on NVDA expiring in 90 days", source: null },
  { query: "Analyze a portfolio of AAPL, MSFT, TSLA", source: null },
  { query: "Stress test AAPL against covid 2020", source: null },
  { query: "Compute the efficient frontier for AAPL, MSFT, GOOGL", source: null },
  { query: "Get the latest news for MSFT", source: null },
  { query: "Run a Monte Carlo simulation for TSLA", source: null },
  { query: "Export a risk report for AAPL to Excel", source: null },
];

export async function fetchSuggestions(): Promise<Suggestion[]> {
  try {
    const res = await fetch(`${API_BASE}/api/suggestions`, { signal: AbortSignal.timeout(4000) });
    if (!res.ok) return FALLBACK;
    const data = await res.json();
    return Array.isArray(data.suggestions) && data.suggestions.length ? data.suggestions : FALLBACK;
  } catch {
    return FALLBACK;
  }
}
