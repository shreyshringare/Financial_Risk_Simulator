// frontend/src/components/cards/OptionsCard.tsx
import { motion } from "framer-motion";
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
  const sigma = (data.hist_vol ?? 25) / 100;

  // Strike offsets: -20% to +20% in 5% steps (5 cols)
  const strikeOffsets = [-0.20, -0.10, 0, +0.10, +0.20];
  const strikes = strikeOffsets.map(o => Math.round(data.strike * (1 + o) * 100) / 100);

  // Expiry options: 30, 60, 90, 180 days
  const expiries = [30, 60, 90, 180];

  const cellColor = (price: number) => {
    const max = bsmPrice(S, strikes[0], 180 / 365, r, sigma, data.option_type);
    if (max === 0) return "var(--l-text-dim)";
    const ratio = price / max;
    if (ratio > 0.66) return "var(--l-accent)";
    if (ratio > 0.33) return "var(--l-text)";
    return "var(--l-text-dim)";
  };

  return (
    <div style={{ marginTop: 16, borderTop: "1px solid var(--l-border)", paddingTop: 14 }}>
      <div className="mono" style={{ fontSize: 11, color: "var(--l-text-dim)", letterSpacing: 1, marginBottom: 8 }}>
        SENSITIVITY · BSM PRICE (STRIKE × EXPIRY)
      </div>
      <div style={{ overflowX: "auto" }}>
        <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12, fontFamily: "var(--font-mono)" }}>
          <thead>
            <tr>
              <th style={{ textAlign: "left", fontSize: 11, color: "var(--l-text-dim)", padding: "4px 6px", letterSpacing: 0.5 }}>Days↓ / K→</th>
              {strikes.map((k, i) => (
                <th key={k} style={{
                  fontSize: 11, color: k === data.strike ? "var(--l-accent)" : "var(--l-text-dim)",
                  padding: "4px 6px", letterSpacing: 0.5, textAlign: "right",
                  fontWeight: k === data.strike ? 600 : 400,
                }}>
                  ${k.toFixed(0)}{strikeOffsets[i] === 0 ? " ●" : ""}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {expiries.map(days => (
              <tr key={days} style={{ borderTop: "1px solid rgba(16,24,32,0.06)" }}>
                <td style={{
                  fontSize: 11, color: days === T0 ? "var(--l-accent)" : "var(--l-text-dim)",
                  padding: "5px 6px", letterSpacing: 0.5,
                  fontWeight: days === T0 ? 600 : 400,
                }}>
                  {days}d{days === T0 ? " ●" : ""}
                </td>
                {strikes.map(k => {
                  const price = bsmPrice(S, k, days / 365, r, sigma, data.option_type);
                  return (
                    <td key={k} style={{
                      textAlign: "right", padding: "5px 6px",
                      color: cellColor(price),
                      background: k === data.strike && days === T0 ? "var(--l-accent-soft)" : "transparent",
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
      <div className="mono" style={{ fontSize: 11, color: "var(--l-text-dim)", marginTop: 6 }}>
        ● = current params · r=5% · σ={((data.hist_vol ?? 25)).toFixed(1)}%
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
  const sigma = (data.hist_vol ?? 25) / 100;

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

  const W = 400, H = 100, PX = 8, PY = 8;
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

  // Gridlines: 4 horizontal
  const gridLines = [0.25, 0.5, 0.75, 1].map(f => PY + ih * (1 - f));

  return (
    <div style={{ marginTop: 16, borderTop: "1px solid var(--l-border)", paddingTop: 14 }}>
      <div className="mono" style={{ fontSize: 11, color: "var(--l-text-dim)", letterSpacing: 1, marginBottom: 8 }}>
        PRICE VS UNDERLYING (60%–140% OF ${S0.toFixed(0)})
      </div>
      <svg viewBox={`0 0 ${W} ${H}`} style={{ width: "100%", height: 100, display: "block", background: "var(--l-surface)" }}>
        {/* gridlines */}
        {gridLines.map((y, i) => (
          <line key={i} x1={PX} y1={y} x2={W - PX} y2={y} stroke="rgba(16,24,32,0.06)" strokeWidth="1" />
        ))}
        {/* intrinsic value dashed */}
        <path d={intrinsicPath} fill="none" stroke="#8ba3bd" strokeWidth="1" strokeDasharray="3,3" />
        {/* BSM curve */}
        <path d={bsmPath} fill="none" stroke="var(--l-accent)" strokeWidth="1.75" />
        {/* current price vertical */}
        <line x1={cx} y1={PY} x2={cx} y2={H - PY} stroke="var(--l-text-dim)" strokeWidth="0.8" strokeDasharray="2,2" />
        {/* current price dot */}
        <circle cx={cx} cy={cy} r="3" fill="var(--l-accent)" />
        {/* labels */}
        <text x={cx + 4} y={PY + 10} fontSize="9" fill="var(--l-text-dim)" fontFamily="var(--font-mono)">S={S0.toFixed(0)}</text>
      </svg>
      <div className="mono" style={{ display: "flex", gap: 14, marginTop: 6, fontSize: 11, color: "var(--l-text-dim)" }}>
        <span><span style={{ color: "var(--l-accent)" }}>——</span> BSM price</span>
        <span><span style={{ color: "#8ba3bd" }}>- - -</span> Intrinsic value</span>
        <span><span style={{ color: "var(--l-text-dim)" }}>|</span> Current price</span>
      </div>
      <div style={{ fontSize: 12, color: "var(--l-text-dim)", fontStyle: "italic", marginTop: 10 }}>
        Fig. — BSM price vs spot at strike ${data.strike}, T={data.expiry_days}d
      </div>
    </div>
  );
}

export default function OptionsCard({ data }: { data: OptionsData }) {
  const typeLabel = data.option_type.toUpperCase();
  const ivDisplay = data.hist_vol != null ? `${data.hist_vol.toFixed(1)}%` : "N/A";
  const intrinsicDisplay = `$${data.intrinsic_value.toFixed(2)}`;
  const bsmDisplay = `$${data.bsm_price.toFixed(2)}`;
  const priceDisplay = `$${data.current_price.toFixed(2)}`;

  return (
    <motion.section
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.35, ease: "easeOut" }}
      style={{ background: "var(--l-surface)", border: "1px solid var(--l-border)", borderRadius: 10, padding: 24 }}
    >
      <div className="mono" style={{ fontSize: 12, letterSpacing: 1.5, color: "var(--l-text-dim)", marginBottom: 6 }}>
        OPTIONS — BLACK-SCHOLES
      </div>

      {/* Header row: ticker + type badge + params */}
      <div style={{ display: "flex", alignItems: "center", gap: 10, marginTop: 12, marginBottom: 14, flexWrap: "wrap" }}>
        <span className="serif" style={{ fontSize: 22, color: "var(--l-text)" }}>
          {data.ticker}
        </span>
        <span className="mono" style={{
          fontSize: 11,
          letterSpacing: 1,
          padding: "3px 8px",
          borderRadius: 6,
          border: `1px solid ${data.option_type === "call" ? "rgba(63,98,18,0.25)" : "rgba(159,18,57,0.25)"}`,
          color: data.option_type === "call" ? "#3f6212" : "#9f1239",
          background: data.option_type === "call" ? "#f3f8e8" : "#fdf0f3",
        }}>
          {typeLabel}
        </span>
        <span className="mono" style={{ fontSize: 12, color: "var(--l-text-dim)", letterSpacing: 0.2 }}>
          ${data.strike} strike · {data.expiry_days}d exp · underlying {priceDisplay}
        </span>
      </div>

      {/* Summary stat row: BSM price / IV / intrinsic */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 10, marginBottom: 14 }}>
        <StatBox label="BSM price"                            value={bsmDisplay} />
        <StatBox label="Historical volatility (σ, annualized)" value={ivDisplay} />
        <StatBox label="Intrinsic value"                       value={intrinsicDisplay} />
      </div>

      {/* Call / Put comparison */}
      {(() => {
        const S = data.current_price, K = data.strike, T = data.expiry_days / 365, r = 0.05;
        const sigma = (data.hist_vol ?? 25) / 100;
        const callPrice = bsmPrice(S, K, T, r, sigma, "call");
        const putPrice  = bsmPrice(S, K, T, r, sigma, "put");
        const parity    = Math.abs((callPrice - putPrice) - (S - K * Math.exp(-r * T)));
        return (
          <div className="mono" style={{ display: "flex", gap: 10, marginBottom: 18, fontSize: 12 }}>
            <div style={{ flex: 1, border: "1px solid var(--l-border)", borderRadius: 6, padding: "6px 10px", background: data.option_type === "call" ? "var(--l-accent-soft)" : "transparent" }}>
              <span style={{ color: "#3f6212", letterSpacing: 0.5 }}>CALL </span>
              <span style={{ color: "var(--l-text)" }}>${callPrice.toFixed(2)}</span>
            </div>
            <div style={{ flex: 1, border: "1px solid var(--l-border)", borderRadius: 6, padding: "6px 10px", background: data.option_type === "put" ? "var(--l-accent-soft)" : "transparent" }}>
              <span style={{ color: "#9f1239", letterSpacing: 0.5 }}>PUT  </span>
              <span style={{ color: "var(--l-text)" }}>${putPrice.toFixed(2)}</span>
            </div>
            <div style={{ flex: 1, border: "1px solid var(--l-border)", borderRadius: 6, padding: "6px 10px" }}>
              <span style={{ color: "var(--l-text-dim)", letterSpacing: 0.5 }}>PARITY ERR </span>
              <span style={{ color: parity < 0.01 ? "#3f6212" : "#92400e" }}>${parity.toFixed(4)}</span>
            </div>
          </div>
        );
      })()}

      {/* Greeks DataGrid */}
      <div style={{ marginBottom: 14 }}>
        <div className="mono" style={{ fontSize: 11, color: "var(--l-text-dim)", letterSpacing: 1, marginBottom: 8 }}>
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
        borderTop: "1px solid var(--l-border)",
        paddingTop: 12,
        display: "flex",
        flexDirection: "column",
        gap: 6,
      }}>
        <div className="mono" style={{ fontSize: 11, color: "var(--l-text-dim)", letterSpacing: 1, marginBottom: 2 }}>
          INTERPRETATION
        </div>
        {[data.delta_interp, data.vega_interp, data.theta_interp].map((line, i) => (
          <div key={i} style={{ fontSize: 13, color: "var(--l-text-dim)", lineHeight: 1.6 }}>
            {line}
          </div>
        ))}
      </div>

      {/* Sensitivity table */}
      <SensitivityTable data={data} />

      {/* Price vs underlying chart */}
      <PriceChart data={data} />
    </motion.section>
  );
}

function StatBox({ label, value }: { label: string; value: string }) {
  return (
    <div style={{
      border: "1px solid var(--l-border)",
      borderRadius: 6,
      padding: "8px 12px",
      background: "var(--l-surface-2)",
    }}>
      <div className="mono" style={{ fontSize: 11, color: "var(--l-text-dim)", letterSpacing: 0.5, marginBottom: 4 }}>
        {label}
      </div>
      <div className="serif" style={{ fontSize: 18, color: "var(--l-text)" }}>
        {value}
      </div>
    </div>
  );
}
