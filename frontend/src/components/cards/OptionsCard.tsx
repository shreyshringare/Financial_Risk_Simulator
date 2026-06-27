// frontend/src/components/cards/OptionsCard.tsx
import type { OptionsData } from "@/types/events";
import DataGrid from "./DataGrid";

// ── Client-side BSM (Abramowitz & Stegun approximation) ──────────────────────
function normCdf(x: number): number {
  const sign = x < 0 ? -1 : 1;
  const ax = Math.abs(x);
  const t = 1 / (1 + 0.3275911 * ax);
  const y = 1 - ((((1.061405429 * t - 1.453152027) * t + 1.421413741) * t - 0.284496736) * t + 0.254829592) * t * Math.exp(-ax * ax);
  return 0.5 * (1 + sign * y);
}

function bsmPrice(S: number, K: number, T: number, r: number, sigma: number, type: string): number {
  if (T <= 0 || sigma <= 0) return Math.max(0, type === "call" ? S - K : K - S);
  const d1 = (Math.log(S / K) + (r + 0.5 * sigma * sigma) * T) / (sigma * Math.sqrt(T));
  const d2 = d1 - sigma * Math.sqrt(T);
  if (type === "call") return S * normCdf(d1) - K * Math.exp(-r * T) * normCdf(d2);
  return K * Math.exp(-r * T) * normCdf(-d2) - S * normCdf(-d1);
}

// ── Sensitivity table: BSM price × (strike × expiry) ─────────────────────────
function SensitivityTable({ data }: { data: OptionsData }) {
  const S = data.current_price;
  const T0 = data.expiry_days;
  const r = 0.05;
  const sigma = (data.implied_vol ?? 25) / 100;

  // Strike offsets: -20% to +20% in 5% steps (5 cols)
  const strikeOffsets = [-0.20, -0.10, 0, +0.10, +0.20];
  const strikes = strikeOffsets.map(o => Math.round(data.strike * (1 + o) * 100) / 100);

  // Expiry options: 30, 60, 90, 180 days
  const expiries = [30, 60, 90, 180];

  const cellColor = (price: number) => {
    const max = bsmPrice(S, strikes[0], 180 / 365, r, sigma, data.option_type);
    if (max === 0) return "var(--text-faint)";
    const ratio = price / max;
    if (ratio > 0.66) return "var(--amber-bright)";
    if (ratio > 0.33) return "var(--amber)";
    return "var(--text-dim)";
  };

  return (
    <div style={{ marginTop: 12, borderTop: "1px solid var(--border-dim)", paddingTop: 10 }}>
      <div style={{ fontSize: 9, color: "var(--text-faint)", letterSpacing: 2, marginBottom: 8 }}>
        SENSITIVITY · BSM PRICE (STRIKE × EXPIRY)
      </div>
      <div style={{ overflowX: "auto" }}>
        <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 10, fontFamily: "var(--font-mono)" }}>
          <thead>
            <tr>
              <th style={{ textAlign: "left", fontSize: 8, color: "var(--text-faint)", padding: "3px 6px", letterSpacing: 1 }}>DAYS↓ / K→</th>
              {strikes.map((k, i) => (
                <th key={k} style={{
                  fontSize: 8, color: k === data.strike ? "var(--amber)" : "var(--text-faint)",
                  padding: "3px 6px", letterSpacing: 1, textAlign: "right",
                  fontWeight: k === data.strike ? "bold" : "normal",
                }}>
                  ${k.toFixed(0)}{strikeOffsets[i] === 0 ? " ●" : ""}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {expiries.map(days => (
              <tr key={days} style={{ borderTop: "1px solid var(--border-dim)" }}>
                <td style={{
                  fontSize: 8, color: days === T0 ? "var(--amber)" : "var(--text-faint)",
                  padding: "4px 6px", letterSpacing: 1,
                  fontWeight: days === T0 ? "bold" : "normal",
                }}>
                  {days}d{days === T0 ? " ●" : ""}
                </td>
                {strikes.map(k => {
                  const price = bsmPrice(S, k, days / 365, r, sigma, data.option_type);
                  return (
                    <td key={k} style={{
                      textAlign: "right", padding: "4px 6px",
                      color: cellColor(price),
                      background: k === data.strike && days === T0 ? "var(--amber-glow)" : "transparent",
                    }}>
                      ${price.toFixed(2)}
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div style={{ fontSize: 8, color: "var(--text-faint)", marginTop: 4, fontFamily: "var(--font-mono)" }}>
        ● = current params · r=5% · σ={((data.implied_vol ?? 25)).toFixed(1)}%
      </div>
    </div>
  );
}

// ── Price-vs-Underlying mini chart ────────────────────────────────────────────
function PriceChart({ data }: { data: OptionsData }) {
  const S0 = data.current_price;
  const K  = data.strike;
  const T  = data.expiry_days / 365;
  const r  = 0.05;
  const sigma = (data.implied_vol ?? 25) / 100;

  const N = 60;
  const sMin = S0 * 0.60;
  const sMax = S0 * 1.40;

  const points = Array.from({ length: N }, (_, i) => {
    const S = sMin + (sMax - sMin) * (i / (N - 1));
    return { S, price: bsmPrice(S, K, T, r, sigma, data.option_type) };
  });

  const intrinsic = points.map(({ S }) =>
    Math.max(0, data.option_type === "call" ? S - K : K - S)
  );

  const allPrices = [...points.map(p => p.price), ...intrinsic];
  const pMin = 0;
  const pMax = Math.max(...allPrices) * 1.05 || 1;

  const W = 400, H = 80, PX = 8, PY = 6;
  const iw = W - PX * 2, ih = H - PY * 2;

  const toX = (S: number) => PX + ((S - sMin) / (sMax - sMin)) * iw;
  const toY = (p: number) => PY + ih - ((p - pMin) / (pMax - pMin)) * ih;

  const bsmPath = points.map((p, i) =>
    `${i === 0 ? "M" : "L"}${toX(p.S).toFixed(1)},${toY(p.price).toFixed(1)}`
  ).join(" ");

  const intrinsicPath = points.map(({ S }, i) =>
    `${i === 0 ? "M" : "L"}${toX(S).toFixed(1)},${toY(intrinsic[i]).toFixed(1)}`
  ).join(" ");

  const cx = toX(S0);
  const cy = toY(data.bsm_price);

  return (
    <div style={{ marginTop: 12, borderTop: "1px solid var(--border-dim)", paddingTop: 10 }}>
      <div style={{ fontSize: 9, color: "var(--text-faint)", letterSpacing: 2, marginBottom: 6 }}>
        BSM PRICE vs UNDERLYING (60%–140% of ${S0.toFixed(0)})
      </div>
      <svg viewBox={`0 0 ${W} ${H}`} style={{ width: "100%", height: 80, display: "block" }}>
        {/* intrinsic value dashed */}
        <path d={intrinsicPath} fill="none" stroke="var(--text-faint)" strokeWidth="0.8" strokeDasharray="3,3" />
        {/* BSM curve */}
        <path d={bsmPath} fill="none" stroke="var(--amber)" strokeWidth="1.5" />
        {/* current price vertical */}
        <line x1={cx} y1={PY} x2={cx} y2={H - PY} stroke="var(--green)" strokeWidth="0.8" strokeDasharray="2,2" />
        {/* current price dot */}
        <circle cx={cx} cy={cy} r="3" fill="var(--amber-bright)" />
        {/* labels */}
        <text x={cx + 3} y={PY + 8} fontSize="7" fill="var(--green)" fontFamily="monospace">S={S0.toFixed(0)}</text>
      </svg>
      <div style={{ display: "flex", gap: 12, marginTop: 4, fontSize: 8, color: "var(--text-faint)", fontFamily: "var(--font-mono)" }}>
        <span><span style={{ color: "var(--amber)" }}>——</span> BSM price</span>
        <span><span style={{ color: "var(--text-faint)" }}>- - -</span> Intrinsic value</span>
        <span><span style={{ color: "var(--green)" }}>|</span> Current price</span>
      </div>
    </div>
  );
}

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
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 8, marginBottom: 10 }}>
        <StatBox label="BSM PRICE"    value={bsmDisplay} />
        <StatBox label="HIST VOL"     value={ivDisplay} />
        <StatBox label="INTRINSIC"    value={intrinsicDisplay} />
      </div>

      {/* Call / Put comparison */}
      {(() => {
        const S = data.current_price, K = data.strike, T = data.expiry_days / 365, r = 0.05;
        const sigma = (data.implied_vol ?? 25) / 100;
        const callPrice = bsmPrice(S, K, T, r, sigma, "call");
        const putPrice  = bsmPrice(S, K, T, r, sigma, "put");
        const parity    = Math.abs((callPrice - putPrice) - (S - K * Math.exp(-r * T)));
        return (
          <div style={{ display: "flex", gap: 8, marginBottom: 14, fontSize: 9, fontFamily: "var(--font-mono)" }}>
            <div style={{ flex: 1, border: "1px solid rgba(57,255,20,0.25)", padding: "5px 8px", background: data.option_type === "call" ? "var(--amber-glow)" : "transparent" }}>
              <span style={{ color: "var(--green)", letterSpacing: 1 }}>CALL </span>
              <span style={{ color: "var(--text)" }}>${callPrice.toFixed(2)}</span>
            </div>
            <div style={{ flex: 1, border: "1px solid rgba(255,49,49,0.25)", padding: "5px 8px", background: data.option_type === "put" ? "var(--amber-glow)" : "transparent" }}>
              <span style={{ color: "var(--red)", letterSpacing: 1 }}>PUT  </span>
              <span style={{ color: "var(--text)" }}>${putPrice.toFixed(2)}</span>
            </div>
            <div style={{ flex: 1, border: "1px solid var(--border-dim)", padding: "5px 8px" }}>
              <span style={{ color: "var(--text-faint)", letterSpacing: 1 }}>PARITY ERR </span>
              <span style={{ color: parity < 0.01 ? "var(--green)" : "var(--amber)" }}>${parity.toFixed(4)}</span>
            </div>
          </div>
        );
      })()}

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

      {/* Sensitivity table */}
      <SensitivityTable data={data} />

      {/* Price vs underlying chart */}
      <PriceChart data={data} />
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
