import type { FrontierData } from "@/types/events";

export default function FrontierCard({ data }: { data: FrontierData }) {
  const { optimal, tickers } = data;
  const maxSharpe = optimal.max_sharpe;

  return (
    <div className="card-phosphor">
      <div className="card-label-phosphor">Efficient Frontier</div>

      <div style={{ marginBottom: 12 }}>
        <span className="font-display" style={{ fontSize: 18, color: "var(--amber-bright)", letterSpacing: 1 }}>
          {tickers.join(" · ")}
        </span>
        <span style={{ fontSize: 9, color: "var(--text-faint)", marginLeft: 10, fontFamily: "var(--font-mono)", letterSpacing: 1 }}>
          {data.n_portfolios_simulated.toLocaleString()} PORTFOLIOS SIMULATED
        </span>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 8, marginBottom: 16 }}>
        {[
          { key: "max_sharpe",   label: "MAX SHARPE",   portfolio: optimal.max_sharpe,   highlight: true },
          { key: "min_variance", label: "MIN VARIANCE", portfolio: optimal.min_variance,  highlight: false },
          { key: "max_return",   label: "MAX RETURN",   portfolio: optimal.max_return,    highlight: false },
        ].map(({ key, label, portfolio, highlight }) => (
          <div key={key} style={{
            border: `1px solid ${highlight ? "var(--amber-dim)" : "var(--border-dim)"}`,
            padding: "8px 10px",
            background: highlight ? "var(--amber-glow)" : "transparent",
          }}>
            <div style={{ fontSize: 8, color: highlight ? "var(--amber)" : "var(--text-faint)", letterSpacing: 2, marginBottom: 6 }}>{label}</div>
            <div style={{ fontSize: 9, color: "var(--text-dim)", fontFamily: "var(--font-mono)", display: "flex", flexDirection: "column", gap: 3 }}>
              <span>RET: <span style={{ color: "var(--green)" }}>{(portfolio.expected_return * 100).toFixed(1)}%</span></span>
              <span>VOL: <span style={{ color: "var(--amber)" }}>{(portfolio.volatility * 100).toFixed(1)}%</span></span>
              <span>SHP: <span style={{ color: portfolio.sharpe_ratio > 1 ? "var(--green)" : "var(--amber)" }}>{portfolio.sharpe_ratio.toFixed(2)}</span></span>
            </div>
          </div>
        ))}
      </div>

      <div>
        <div style={{ fontSize: 9, color: "var(--text-faint)", letterSpacing: 2, marginBottom: 8 }}>
          MAX SHARPE WEIGHTS
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: 5 }}>
          {tickers.map(t => {
            const w = maxSharpe.weights[t] ?? 0;
            return (
              <div key={t} style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <span style={{ width: 50, fontSize: 9, color: "var(--amber-dim)", fontFamily: "var(--font-mono)", flexShrink: 0 }}>{t}</span>
                <div style={{ flex: 1, height: 8, background: "var(--border)" }}>
                  <div style={{ height: "100%", width: `${(w * 100).toFixed(1)}%`, background: "var(--amber)", transition: "width 0.4s ease" }} />
                </div>
                <span style={{ width: 40, fontSize: 9, color: "var(--text)", fontFamily: "var(--font-mono)", textAlign: "right" }}>
                  {(w * 100).toFixed(1)}%
                </span>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
