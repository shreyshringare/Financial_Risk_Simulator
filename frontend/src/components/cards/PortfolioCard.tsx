import type { PortfolioData } from "@/types/events";

export default function PortfolioCard({ data }: { data: PortfolioData }) {
  const tickers = data.tickers;
  const pvar = data.portfolio_var;

  function corrColor(val: number): string {
    if (val >= 0.9) return "var(--amber-bright)";
    if (val >= 0.6) return "var(--amber)";
    if (val >= 0.3) return "var(--amber-dim)";
    if (val >= 0)   return "var(--text-faint)";
    return "var(--red)";
  }

  return (
    <div className="card-phosphor">
      <div className="card-label-phosphor">Portfolio Analysis</div>

      <div style={{ marginBottom: 12 }}>
        <span className="font-display" style={{ fontSize: 20, color: "var(--amber-bright)", letterSpacing: 1 }}>
          {tickers.join(" · ")}
        </span>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 8, marginBottom: 16 }}>
        <StatBox label="PORT VaR 95%" value={`${(Math.abs(pvar.portfolio_var) * 100).toFixed(2)}%`} color="var(--red)" />
        <StatBox label="PORT CVaR 95%" value={`${(Math.abs(pvar.portfolio_cvar) * 100).toFixed(2)}%`} color="var(--red)" />
        <StatBox label="DIVERS RATIO" value={pvar.diversification_ratio.toFixed(3)} color="var(--green)" />
      </div>

      <div style={{ marginBottom: 14 }}>
        <div style={{ fontSize: 9, color: "var(--text-faint)", letterSpacing: 2, marginBottom: 6 }}>EQUAL WEIGHTS</div>
        <div style={{ display: "flex", gap: 6 }}>
          {tickers.map((t, i) => (
            <div key={t} style={{ flex: 1, border: "1px solid var(--border-dim)", padding: "5px 8px", textAlign: "center" }}>
              <div style={{ fontSize: 8, color: "var(--text-faint)", letterSpacing: 1 }}>{t}</div>
              <div style={{ fontSize: 13, color: "var(--amber)", fontFamily: "var(--font-mono)" }}>
                {(pvar.weights[i] * 100).toFixed(1)}%
              </div>
            </div>
          ))}
        </div>
      </div>

      <div>
        <div style={{ fontSize: 9, color: "var(--text-faint)", letterSpacing: 2, marginBottom: 8 }}>CORRELATION MATRIX</div>
        <div style={{ overflowX: "auto" }}>
          <table style={{ borderCollapse: "collapse", fontSize: 10, fontFamily: "var(--font-mono)" }}>
            <thead>
              <tr>
                <th style={{ width: 60, fontSize: 8, color: "var(--text-faint)" }}></th>
                {tickers.map(t => (
                  <th key={t} style={{ padding: "3px 10px", fontSize: 8, color: "var(--amber-dim)", letterSpacing: 1, textAlign: "right" }}>{t}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {tickers.map(rowT => (
                <tr key={rowT}>
                  <td style={{ fontSize: 8, color: "var(--amber-dim)", padding: "4px 6px", letterSpacing: 1 }}>{rowT}</td>
                  {tickers.map(colT => {
                    const val = data.correlation_matrix[rowT]?.[colT] ?? 0;
                    return (
                      <td key={colT} style={{
                        textAlign: "right", padding: "4px 10px",
                        color: corrColor(val),
                        background: rowT === colT ? "var(--amber-glow)" : "transparent",
                        fontWeight: rowT === colT ? "bold" : "normal",
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
    </div>
  );
}

function StatBox({ label, value, color }: { label: string; value: string; color: string }) {
  return (
    <div style={{ border: "1px solid var(--border-dim)", padding: "6px 10px", background: "var(--amber-glow)" }}>
      <div style={{ fontSize: 8, color: "var(--text-faint)", letterSpacing: 1.5, marginBottom: 4 }}>{label}</div>
      <div className="font-display" style={{ fontSize: 18, color, letterSpacing: 1 }}>{value}</div>
    </div>
  );
}
