export default function CaveatsCard() {
  return (
    <div style={{
      border: "1px solid var(--border-dim)",
      background: "rgba(255,180,60,0.02)",
      padding: "12px 16px",
      animation: "print-in 0.25s ease-out 0.75s forwards",
      opacity: 0,
    }}>
      <div style={{ fontSize: 9, letterSpacing: 2, color: "var(--text-faint)", textTransform: "uppercase", marginBottom: 8 }}>
        Model Assumptions &amp; Caveats
      </div>
      <ul style={{ listStyle: "none", display: "flex", flexDirection: "column", gap: 4 }}>
        {[
          "GBM assumes log-normally distributed returns, constant volatility, no price jumps",
          "Real markets exhibit fat tails, volatility clustering, and regime changes",
          "CVaR exceeds VaR in severity — it captures the average of tail losses, not just the threshold",
          "Historical Sharpe is backward-looking; past risk-adjusted returns do not predict future performance",
        ].map((text) => (
          <li key={text} style={{ fontSize: 10, color: "var(--text-faint)", display: "flex", gap: 6 }}>
            <span style={{ color: "var(--amber-dim)", flexShrink: 0 }}>▸</span>
            {text}
          </li>
        ))}
      </ul>
      <div style={{
        marginTop: 6, fontSize: 10,
        color: "rgba(255,215,0,0.35)",
        borderTop: "1px solid var(--border-dim)",
        paddingTop: 6,
      }}>
        ⚠ Educational use only. Not financial advice. All figures are simulated.
      </div>
    </div>
  );
}
