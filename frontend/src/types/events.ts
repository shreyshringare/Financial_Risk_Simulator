// frontend/src/types/events.ts

export type StockData = {
  ticker: string;
  start: string;
  end: string;
  count: number;
  latest_price: number;
  min_price: number;
  max_price: number;
};

export type MonteCarloData = {
  ticker: string;
  days: number;
  simulations: number;
  mean_final_price: number;
  std_final_price: number;
  percentile_5: number;
  percentile_95: number;
};

export type RiskData = {
  var: number;
  cvar: number;
  var_hist: number;
  cvar_hist: number;
  var_sim: number;
  cvar_sim: number;
  sharpe: number;
  max_drawdown: number;
};

export type OptionsData = {
  ticker: string;
  strike: number;
  expiry_days: number;
  option_type: "call" | "put";
  current_price: number;
  bsm_price: number;
  intrinsic_value: number;
  time_value: number;
  implied_vol: number | null;
  delta: number;
  gamma: number;
  vega: number;
  theta: number;
  rho: number;
  delta_interp: string;
  vega_interp: string;
  theta_interp: string;
};

export type SSEEvent =
  | { type: "section"; section: "stock";       data: StockData }
  | { type: "section"; section: "monte_carlo"; data: MonteCarloData }
  | { type: "section"; section: "risk";        data: RiskData }
  | { type: "section"; section: "options";     data: OptionsData }
  | { type: "section"; section: "caveats";     data: Record<string, never> }
  | { type: "token";   token: string }
  | { type: "error";   message: string }
  | { type: "done" };

export type SectionType = "stock" | "monte_carlo" | "risk" | "options" | "verdict" | "caveats" | "prose";

export type ReportSection =
  | { kind: "stock";       data: StockData }
  | { kind: "monte_carlo"; data: MonteCarloData }
  | { kind: "risk";        data: RiskData }
  | { kind: "options";     data: OptionsData }
  | { kind: "verdict";     content: string; streaming: boolean }
  | { kind: "caveats" }
  | { kind: "prose";       content: string; streaming: boolean };
