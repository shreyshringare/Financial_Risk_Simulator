"use client";

interface Props {
  onQuery: (q: string) => void;
  disabled: boolean;
  open: boolean;
  history: { query: string; at: number }[];
  onRestore: (i: number) => void;
}

const QUICK_QUERIES = [
  "What is the VaR for AAPL?",
  "Price AAPL $200 call expiring in 90 days",
  "Price TSLA $300 put expiring in 60 days",
  "Run Monte Carlo on RELIANCE.NS",
  "Analyze portfolio: AAPL, MSFT, TSLA",
  "2008 crisis stress test on TSLA",
  "Efficient frontier for AAPL, GOOGL, MSFT",
  "Latest news for NVDA",
  "Export AAPL report to Excel",
];

const MARKETS = [
  { flag: "🇺🇸", label: "NYSE/NASDAQ" },
  { flag: "🇮🇳", label: "NSE .NS" },
  { flag: "🇬🇧", label: "LSE .L" },
  { flag: "🇨🇦", label: "TSX .TO" },
];

const CAPABILITIES = [
  "📉 VaR · CVaR · Sharpe · Drawdown",
  "🎲 Monte Carlo GBM (1,000 paths)",
  "📊 Portfolio Correlation + VaR",
  "⚡ Stress Testing (5 crises)",
  "📐 Markowitz Efficient Frontier",
  "🧮 Options BSM · Greeks · IV",
  "📰 RSS News + Sentiment",
  "💾 Excel & PowerBI Export",
];

function formatTime(at: number): string {
  return new Date(at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
}

export default function Sidebar({ onQuery, disabled, open, history, onRestore }: Props) {
  return (
    <aside style={{
      width: open ? 200 : 0,
      flexShrink: 0,
      overflow: "hidden",
      background: "var(--l-bg)",
      borderRight: "1px solid var(--l-border)",
      display: "flex",
      flexDirection: "column",
      transition: "width 250ms ease-out, transform 250ms ease-out",
      scrollbarWidth: "none",
    }}>
      <div style={{ width: 200, display: "flex", flexDirection: "column", overflowY: "auto", scrollbarWidth: "none", flex: 1 }}>
        {/* Brand */}
        <div style={{ padding: 16, borderBottom: "1px solid var(--l-border)" }}>
          <div className="serif" style={{ fontSize: 20, fontWeight: 600, color: "var(--l-text)", lineHeight: 1 }}>
            FinSim
          </div>
          <div className="mono" style={{ fontSize: 10, color: "var(--l-text-dim)", letterSpacing: 1, textTransform: "uppercase", marginTop: 4 }}>
            Risk Terminal v2.0
          </div>
        </div>

        {/* Markets */}
        <div style={{ padding: 16, borderBottom: "1px solid var(--l-border)" }}>
          <SectionLabel>Markets</SectionLabel>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 4 }}>
            {MARKETS.map((m) => (
              <span key={m.label} style={{ fontSize: 9, padding: "2px 6px", border: "1px solid var(--l-border)", color: "var(--l-text-dim)", letterSpacing: 1 }}>
                {m.flag} {m.label}
              </span>
            ))}
          </div>
        </div>

        {/* Capabilities */}
        <div style={{ padding: 16, borderBottom: "1px solid var(--l-border)" }}>
          <SectionLabel>Capabilities</SectionLabel>
          <ul style={{ listStyle: "none", display: "flex", flexDirection: "column", gap: 6 }}>
            {CAPABILITIES.map((c) => (
              <li key={c} style={{ fontSize: 10, color: "var(--l-text-dim)", display: "flex", alignItems: "center", gap: 6 }}>
                <span style={{ color: "var(--l-text-dim)", fontSize: 8 }}>▸</span>
                {c}
              </li>
            ))}
          </ul>
        </div>

        {/* Quick queries */}
        <div style={{ padding: 16, flex: 1 }}>
          <SectionLabel>Quick Queries</SectionLabel>
          <div style={{ display: "flex", flexDirection: "column", gap: 3 }}>
            {QUICK_QUERIES.map((q) => (
              <button
                key={q}
                onClick={() => !disabled && onQuery(q)}
                disabled={disabled}
                style={{
                  fontSize: 13,
                  color: "var(--l-text)",
                  background: "none", border: "none",
                  borderRadius: 6,
                  padding: "7px 10px", textAlign: "left",
                  cursor: disabled ? "not-allowed" : "pointer",
                  transition: "150ms ease-out",
                  whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis",
                  opacity: disabled ? 0.4 : 1,
                }}
                onMouseEnter={(e) => {
                  if (!disabled) {
                    e.currentTarget.style.background = "var(--l-surface-2)";
                  }
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.background = "none";
                }}
              >
                {q}
              </button>
            ))}
          </div>
        </div>

        {/* Session history */}
        {history.length > 0 && (
          <div style={{ padding: 16, borderTop: "1px solid var(--l-border)" }}>
            <SectionLabel>Session History</SectionLabel>
            <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
              {history.map((h, i) => (
                <button
                  key={h.at}
                  onClick={() => onRestore(i)}
                  title={h.query}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 8,
                    fontSize: 12,
                    color: "var(--l-text)",
                    background: "none",
                    border: "none",
                    borderRadius: 6,
                    padding: "6px 10px",
                    textAlign: "left",
                    cursor: "pointer",
                    transition: "background 150ms ease-out",
                  }}
                  onMouseEnter={(e) => { e.currentTarget.style.background = "var(--l-surface-2)"; }}
                  onMouseLeave={(e) => { e.currentTarget.style.background = "none"; }}
                >
                  <span className="mono" style={{ fontSize: 10, color: "var(--l-text-dim)", flexShrink: 0 }}>
                    {formatTime(h.at)}
                  </span>
                  <span style={{ whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                    {h.query}
                  </span>
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Disclaimer */}
        <div style={{ fontSize: 9, color: "var(--l-text-dim)", textAlign: "center", padding: "12px 16px", lineHeight: 1.5, borderTop: "1px solid var(--l-border)" }}>
          ⚠ Educational use only.<br />Not financial advice.
        </div>
      </div>
    </aside>
  );
}

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <div className="mono" style={{ fontSize: 9, letterSpacing: 2, textTransform: "uppercase", color: "var(--l-text-dim)", marginBottom: 10 }}>
      {children}
    </div>
  );
}
