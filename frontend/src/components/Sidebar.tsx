"use client";

interface Props {
  onQuery: (q: string) => void;
  disabled: boolean;
}

const QUICK_QUERIES = [
  "What is the VaR for AAPL?",
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
  "📰 RSS News + Sentiment",
  "💾 Excel & PowerBI Export",
];

export default function Sidebar({ onQuery, disabled }: Props) {
  return (
    <aside style={{
      width: 200, flexShrink: 0,
      background: "var(--surface)",
      display: "flex", flexDirection: "column",
      overflowY: "auto",
      scrollbarWidth: "none",
    }}>
      {/* Brand */}
      <div style={{ padding: 16, borderBottom: "1px solid var(--border)" }}>
        <div className="font-display" style={{ fontSize: 28, color: "var(--amber-bright)", textShadow: "0 0 20px var(--amber-dim), 0 0 40px rgba(255,180,60,0.2)", letterSpacing: 2, lineHeight: 1 }}>
          ◆ FINSIM
        </div>
        <div style={{ fontSize: 10, color: "var(--text-faint)", letterSpacing: 1, textTransform: "uppercase", marginTop: 4 }}>
          Risk Terminal v2.0
        </div>
      </div>

      {/* Markets */}
      <div style={{ padding: 16, borderBottom: "1px solid var(--border-dim)" }}>
        <SectionLabel>Markets</SectionLabel>
        <div style={{ display: "flex", flexWrap: "wrap", gap: 4 }}>
          {MARKETS.map((m) => (
            <span key={m.label} style={{ fontSize: 9, padding: "2px 6px", border: "1px solid var(--border)", color: "var(--amber-dim)", letterSpacing: 1 }}>
              {m.flag} {m.label}
            </span>
          ))}
        </div>
      </div>

      {/* Capabilities */}
      <div style={{ padding: 16, borderBottom: "1px solid var(--border-dim)" }}>
        <SectionLabel>Capabilities</SectionLabel>
        <ul style={{ listStyle: "none", display: "flex", flexDirection: "column", gap: 6 }}>
          {CAPABILITIES.map((c) => (
            <li key={c} style={{ fontSize: 10, color: "var(--text-dim)", display: "flex", alignItems: "center", gap: 6 }}>
              <span style={{ color: "var(--amber-dim)", fontSize: 8 }}>▸</span>
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
                fontFamily: "var(--font-mono)", fontSize: 10,
                color: "var(--text-faint)",
                background: "none", border: "1px solid transparent",
                padding: "5px 8px", textAlign: "left",
                cursor: disabled ? "not-allowed" : "pointer",
                transition: "all 0.12s",
                whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis",
                opacity: disabled ? 0.4 : 1,
              }}
              onMouseEnter={(e) => {
                if (!disabled) {
                  e.currentTarget.style.color = "var(--amber)";
                  e.currentTarget.style.borderColor = "var(--border)";
                  e.currentTarget.style.background = "var(--amber-glow)";
                }
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.color = "var(--text-faint)";
                e.currentTarget.style.borderColor = "transparent";
                e.currentTarget.style.background = "none";
              }}
            >
              {q}
            </button>
          ))}
        </div>
      </div>

      {/* Disclaimer */}
      <div style={{ fontSize: 9, color: "var(--text-faint)", textAlign: "center", padding: "12px 16px", lineHeight: 1.5, borderTop: "1px solid var(--border-dim)" }}>
        ⚠ Educational use only.<br />Not financial advice.
      </div>
    </aside>
  );
}

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <div style={{ fontSize: 9, letterSpacing: 2, textTransform: "uppercase", color: "var(--text-faint)", marginBottom: 10 }}>
      {children}
    </div>
  );
}
