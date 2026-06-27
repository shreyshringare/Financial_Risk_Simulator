import type { StressTestData } from "@/types/events";

export default function StressTestCard({ data }: { data: StressTestData }) {
  const scenarioLabel = data.scenario_name.replace(/_/g, " ").toUpperCase();
  const shockPct = (Math.abs(data.shock_applied) * 100).toFixed(0);
  const baseVarPct = (Math.abs(data.baseline_var_95) * 100).toFixed(2);
  const stressVarPct = (Math.abs(data.stressed_var_95) * 100).toFixed(2);
  const worstPct = (Math.abs(data.worst_case_loss) * 100).toFixed(1);

  const baseWidth = Math.min(100, (Math.abs(data.baseline_var_95) / Math.abs(data.stressed_var_95)) * 100);

  return (
    <div className="card-phosphor">
      <div className="card-label-phosphor">Stress Test</div>

      <div style={{ marginBottom: 12 }}>
        <div className="font-display" style={{ fontSize: 18, color: "var(--amber-bright)", letterSpacing: 1 }}>
          {scenarioLabel}
        </div>
        <div style={{ fontSize: 10, color: "var(--text-dim)", marginTop: 4, fontFamily: "var(--font-mono)" }}>
          {data.description}
        </div>
      </div>

      <div style={{ marginBottom: 16 }}>
        <span style={{ fontSize: 9, letterSpacing: 2, padding: "3px 8px", border: "1px solid rgba(255,49,49,0.4)", color: "var(--red)", background: "rgba(255,49,49,0.05)" }}>
          SHOCK APPLIED: -{shockPct}%
        </span>
      </div>

      <div style={{ marginBottom: 16 }}>
        <div style={{ fontSize: 9, color: "var(--text-faint)", letterSpacing: 2, marginBottom: 10 }}>VaR COMPARISON (95%)</div>

        <div style={{ marginBottom: 8 }}>
          <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 3, fontSize: 10, fontFamily: "var(--font-mono)" }}>
            <span style={{ color: "var(--text-faint)" }}>BASELINE</span>
            <span style={{ color: "var(--green)" }}>{baseVarPct}%</span>
          </div>
          <div style={{ height: 6, background: "var(--border)", position: "relative" }}>
            <div style={{ height: "100%", width: `${baseWidth}%`, background: "var(--green)", transition: "width 0.5s ease" }} />
          </div>
        </div>

        <div>
          <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 3, fontSize: 10, fontFamily: "var(--font-mono)" }}>
            <span style={{ color: "var(--text-faint)" }}>STRESSED</span>
            <span style={{ color: "var(--red)" }}>{stressVarPct}%</span>
          </div>
          <div style={{ height: 6, background: "var(--border)", position: "relative" }}>
            <div style={{ height: "100%", width: "100%", background: "var(--red)", opacity: 0.7 }} />
          </div>
        </div>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 8 }}>
        <MiniStat label="WORST CASE" value={`-${worstPct}%`} color="var(--red)" />
        <MiniStat label="BASE RETURN" value={`${(data.baseline_mean_return * 100).toFixed(1)}%`} color="var(--green)" />
        <MiniStat label="STRESSED RETURN" value={`${(data.stressed_mean_return * 100).toFixed(1)}%`} color="var(--red)" />
      </div>
    </div>
  );
}

function MiniStat({ label, value, color }: { label: string; value: string; color: string }) {
  return (
    <div style={{ border: "1px solid var(--border-dim)", padding: "5px 8px" }}>
      <div style={{ fontSize: 8, color: "var(--text-faint)", letterSpacing: 1, marginBottom: 3 }}>{label}</div>
      <div style={{ fontSize: 14, color, fontFamily: "var(--font-mono)" }}>{value}</div>
    </div>
  );
}
