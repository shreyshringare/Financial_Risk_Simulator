// frontend/src/components/cards/OptionsCard.tsx
import type { OptionsData } from "@/types/events";
import DataGrid from "./DataGrid";

export default function OptionsCard({ data }: { data: OptionsData }) {
  const typeLabel = data.option_type.toUpperCase();
  const ivDisplay = data.implied_vol != null ? `${data.implied_vol.toFixed(1)}%` : "N/A";
  const intrinsicDisplay = `$${data.intrinsic_value.toFixed(2)}`;
  const bsmDisplay = `$${data.bsm_price.toFixed(2)}`;
  const priceDisplay = `$${data.current_price.toFixed(2)}`;

  return (
    <div className="card-phosphor">
      <div className="card-label-phosphor">Options Analysis</div>

      {/* Header row: ticker + type badge + params */}
      <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 12 }}>
        <span className="font-display" style={{ fontSize: 22, color: "var(--amber-bright)", letterSpacing: 1 }}>
          {data.ticker}
        </span>
        <span style={{
          fontSize: 9,
          letterSpacing: 2,
          padding: "2px 6px",
          border: `1px solid ${data.option_type === "call" ? "rgba(57,255,20,0.4)" : "rgba(255,49,49,0.4)"}`,
          color: data.option_type === "call" ? "var(--green)" : "var(--red)",
          fontFamily: "var(--font-mono)",
        }}>
          {typeLabel}
        </span>
        <span style={{ fontSize: 10, color: "var(--text-faint)", fontFamily: "var(--font-mono)", letterSpacing: 0.5 }}>
          ${data.strike} strike · {data.expiry_days}d exp · underlying {priceDisplay}
        </span>
      </div>

      {/* Summary stat row: BSM price / IV / intrinsic */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 8, marginBottom: 14 }}>
        <StatBox label="BSM PRICE"    value={bsmDisplay} />
        <StatBox label="HIST VOL"     value={ivDisplay} />
        <StatBox label="INTRINSIC"    value={intrinsicDisplay} />
      </div>

      {/* Greeks DataGrid */}
      <div style={{ marginBottom: 10 }}>
        <div style={{ fontSize: 9, color: "var(--text-faint)", letterSpacing: 2, marginBottom: 6 }}>
          GREEKS
        </div>
        <DataGrid
          headers={["DELTA", "GAMMA", "VEGA", "THETA", "RHO"]}
          rows={[[
            data.delta,
            data.gamma,
            data.vega,
            data.theta,
            data.rho,
          ]]}
        />
      </div>

      {/* Interpretation block */}
      <div style={{
        borderTop: "1px solid var(--border-dim)",
        paddingTop: 8,
        display: "flex",
        flexDirection: "column",
        gap: 4,
      }}>
        <div style={{ fontSize: 9, color: "var(--text-faint)", letterSpacing: 2, marginBottom: 2 }}>
          INTERPRETATION
        </div>
        {[data.delta_interp, data.vega_interp, data.theta_interp].map((line, i) => (
          <div key={i} style={{ fontSize: 11, color: "var(--text-dim)", fontFamily: "var(--font-mono)", lineHeight: 1.5 }}>
            {line}
          </div>
        ))}
      </div>
    </div>
  );
}

function StatBox({ label, value }: { label: string; value: string }) {
  return (
    <div style={{
      border: "1px solid var(--border-dim)",
      padding: "6px 10px",
      background: "var(--amber-glow)",
    }}>
      <div style={{ fontSize: 8, color: "var(--text-faint)", letterSpacing: 1.5, marginBottom: 4 }}>
        {label}
      </div>
      <div className="font-display" style={{ fontSize: 18, color: "var(--text)", letterSpacing: 1 }}>
        {value}
      </div>
    </div>
  );
}
