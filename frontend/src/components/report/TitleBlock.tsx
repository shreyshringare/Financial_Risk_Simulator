export default function TitleBlock({ ticker, subject }: { ticker: string; subject: string }) {
  const date = new Date().toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" });
  return (
    <header style={{ borderBottom: "1px solid var(--l-border)", paddingBottom: 20, marginBottom: 8 }}>
      <div className="mono" style={{ fontSize: 11, letterSpacing: 2, color: "var(--l-accent)", marginBottom: 8 }}>
        FINSIM RESEARCH
      </div>
      <h1 className="serif" style={{ fontSize: 28, fontWeight: 600, margin: 0, color: "var(--l-text)" }}>
        {ticker ? `${ticker} — ${subject}` : subject}
      </h1>
      <div className="mono" style={{ fontSize: 12, color: "var(--l-text-dim)", marginTop: 8 }}>
        {date} · Prepared by FinSim Agent
      </div>
    </header>
  );
}
