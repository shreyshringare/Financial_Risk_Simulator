import { motion } from "framer-motion";
import type { PortfolioData } from "@/types/events";

export default function PortfolioCard({ data }: { data: PortfolioData }) {
  const tickers = data.tickers;
  const pvar = data.portfolio_var;

  function corrColor(val: number): string {
    if (val >= 0.9) return "rgba(0,58,112,0.85)";
    if (val >= 0.6) return "rgba(0,58,112,0.65)";
    if (val >= 0.3) return "rgba(0,58,112,0.45)";
    if (val >= 0)   return "var(--l-text-dim)";
    return "#9f1239";
  }

  return (
    <motion.section
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.35, ease: "easeOut" }}
      style={{ background: "var(--l-surface)", border: "1px solid var(--l-border)", borderRadius: 10, padding: 24 }}
    >
      <div className="mono" style={{ fontSize: 12, letterSpacing: 1.5, color: "var(--l-text-dim)", marginBottom: 6 }}>
        PORTFOLIO CORRELATION
      </div>

      <div style={{ marginTop: 12, marginBottom: 14 }}>
        <span className="serif" style={{ fontSize: 20, color: "var(--l-text)" }}>
          {tickers.join(" · ")}
        </span>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 10, marginBottom: 18 }}>
        <StatBox label="95% portfolio VaR"  value={`${(Math.abs(pvar.portfolio_var) * 100).toFixed(2)}%`} />
        <StatBox label="95% portfolio CVaR" value={`${(Math.abs(pvar.portfolio_cvar) * 100).toFixed(2)}%`} />
        <StatBox label="Diversification ratio" value={pvar.diversification_ratio.toFixed(3)} />
      </div>

      <div style={{ marginBottom: 16 }}>
        <div className="mono" style={{ fontSize: 11, color: "var(--l-text-dim)", letterSpacing: 1, marginBottom: 8 }}>EQUAL WEIGHTS</div>
        <div style={{ display: "flex", gap: 8 }}>
          {tickers.map((t, i) => (
            <div key={t} style={{ flex: 1, border: "1px solid var(--l-border)", borderRadius: 6, padding: "6px 8px", textAlign: "center" }}>
              <div className="mono" style={{ fontSize: 11, color: "var(--l-text-dim)" }}>{t}</div>
              <div className="mono" style={{ fontSize: 13, color: "var(--l-text)" }}>
                {(pvar.weights[i] * 100).toFixed(1)}%
              </div>
            </div>
          ))}
        </div>
      </div>

      <div>
        <div className="mono" style={{ fontSize: 11, color: "var(--l-text-dim)", letterSpacing: 1, marginBottom: 8 }}>CORRELATION MATRIX</div>
        <div style={{ overflowX: "auto" }}>
          <table style={{ borderCollapse: "collapse", fontSize: 12, fontFamily: "var(--font-mono)", background: "var(--l-surface)" }}>
            <thead>
              <tr>
                <th style={{ width: 60, fontSize: 11, color: "var(--l-text-dim)" }}></th>
                {tickers.map(t => (
                  <th key={t} style={{ padding: "4px 10px", fontSize: 11, color: "var(--l-text-dim)", letterSpacing: 0.5, textAlign: "right" }}>{t}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {tickers.map(rowT => (
                <tr key={rowT}>
                  <td style={{ fontSize: 11, color: "var(--l-text-dim)", padding: "5px 6px", letterSpacing: 0.5, borderTop: "1px solid rgba(16,24,32,0.06)" }}>{rowT}</td>
                  {tickers.map(colT => {
                    const val = data.correlation_matrix[rowT]?.[colT] ?? 0;
                    return (
                      <td key={colT} style={{
                        textAlign: "right", padding: "5px 10px",
                        color: corrColor(val),
                        background: rowT === colT ? "var(--l-surface-2)" : "transparent",
                        fontWeight: rowT === colT ? 600 : 400,
                        borderTop: "1px solid rgba(16,24,32,0.06)",
                      }}>
                        {val.toFixed(3)}
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </motion.section>
  );
}

function StatBox({ label, value }: { label: string; value: string }) {
  return (
    <div style={{ border: "1px solid var(--l-border)", borderRadius: 6, padding: "8px 12px", background: "var(--l-surface-2)" }}>
      <div className="mono" style={{ fontSize: 11, color: "var(--l-text-dim)", letterSpacing: 0.5, marginBottom: 4 }}>{label}</div>
      <div className="serif" style={{ fontSize: 18, color: "var(--l-text)" }}>{value}</div>
    </div>
  );
}
