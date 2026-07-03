export default function CaveatsCard() {
  return (
    <div style={{
      borderTop: "1px solid var(--l-border)",
      paddingTop: 16,
    }}>
      <div className="mono" style={{ fontSize: 12, letterSpacing: 1.5, color: "var(--l-text-dim)", marginBottom: 8 }}>
        METHODOLOGY & CAVEATS
      </div>
      <div style={{ fontSize: 12, color: "var(--l-text-dim)", lineHeight: 1.6 }}>
        Historical VaR/CVaR from realized daily returns (5-year window). Monte Carlo companion under GBM assumptions
        (Black &amp; Scholes 1973; seed 42, 10,000 paths). Portfolio optimization per Markowitz (1952) mean-variance
        framework. Confidence methodology follows RiskMetrics (1996) conventions. Markets exhibit fat tails,
        volatility clustering, and regime change — realized tail losses may exceed modeled estimates. Educational
        use only; not investment advice.
      </div>
    </div>
  );
}
