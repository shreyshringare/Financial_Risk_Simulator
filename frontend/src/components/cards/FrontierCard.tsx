import { motion } from "framer-motion";
import type { FrontierData } from "@/types/events";

export default function FrontierCard({ data }: { data: FrontierData }) {
  const { optimal, tickers } = data;
  const maxSharpe = optimal.max_sharpe;

  return (
    <motion.section
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.35, ease: "easeOut" }}
      style={{ background: "var(--l-surface)", border: "1px solid var(--l-border)", borderRadius: 10, padding: 24 }}
    >
      <div className="mono" style={{ fontSize: 12, letterSpacing: 1.5, color: "var(--l-text-dim)", marginBottom: 6 }}>
        EFFICIENT FRONTIER — FIG. 2
      </div>

      <div style={{ marginTop: 12, marginBottom: 14 }}>
        <span className="serif" style={{ fontSize: 18, color: "var(--l-text)" }}>
          {tickers.join(" · ")}
        </span>
        <span className="mono" style={{ fontSize: 11, color: "var(--l-text-dim)", marginLeft: 10, letterSpacing: 0.5 }}>
          {data.n_portfolios_simulated.toLocaleString()} portfolios simulated
        </span>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 10, marginBottom: 18 }}>
        {[
          { key: "max_sharpe",   label: "MAX SHARPE",   portfolio: optimal.max_sharpe,   highlight: true },
          { key: "min_variance", label: "MIN VARIANCE", portfolio: optimal.min_variance,  highlight: false },
          { key: "max_return",   label: "MAX RETURN",   portfolio: optimal.max_return,    highlight: false },
        ].map(({ key, label, portfolio, highlight }) => (
          <div key={key} style={{
            border: `1px solid ${highlight ? "var(--l-accent)" : "var(--l-border)"}`,
            borderRadius: 6,
            padding: "10px 12px",
            background: highlight ? "var(--l-accent-soft)" : "transparent",
          }}>
            <div className="mono" style={{ fontSize: 11, color: highlight ? "var(--l-accent)" : "var(--l-text-dim)", letterSpacing: 1, marginBottom: 6 }}>{label}</div>
            <div className="mono" style={{ fontSize: 12, color: "var(--l-text-dim)", display: "flex", flexDirection: "column", gap: 3 }}>
              <span>Return: <span style={{ color: "var(--l-text)" }}>{(portfolio.expected_return * 100).toFixed(1)}%</span></span>
              <span>Vol: <span style={{ color: "var(--l-text)" }}>{(portfolio.volatility * 100).toFixed(1)}%</span></span>
              <span>Sharpe: <span style={{ color: "var(--l-text)" }}>{portfolio.sharpe_ratio.toFixed(2)}</span></span>
            </div>
          </div>
        ))}
      </div>

      <div>
        <div className="mono" style={{ fontSize: 11, color: "var(--l-text-dim)", letterSpacing: 1, marginBottom: 8 }}>
          MAX SHARPE WEIGHTS
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
          {tickers.map(t => {
            const w = maxSharpe.weights[t] ?? 0;
            return (
              <div key={t} style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <span className="mono" style={{ width: 50, fontSize: 11, color: "var(--l-text-dim)", flexShrink: 0 }}>{t}</span>
                <div style={{ flex: 1, height: 8, background: "var(--l-surface-2)", borderRadius: 4, overflow: "hidden" }}>
                  <div style={{ height: "100%", width: `${(w * 100).toFixed(1)}%`, background: "var(--l-accent)", opacity: 0.7, transition: "width 0.4s ease" }} />
                </div>
                <span className="mono" style={{ width: 42, fontSize: 12, color: "var(--l-text)", textAlign: "right" }}>
                  {(w * 100).toFixed(1)}%
                </span>
              </div>
            );
          })}
        </div>
      </div>
    </motion.section>
  );
}
