// frontend/src/types/events.ts

export type PortfolioData = {
  tickers: string[];
  correlation_matrix: Record<string, Record<string, number>>;
  portfolio_var: {
    portfolio_var: number;
    portfolio_cvar: number;
    diversification_ratio: number;
    tickers: string[];
    weights: number[];
  };
};

export type StressTestData = {
  scenario_name: string;
  description: string;
  shock_applied: number;
  baseline_var_95: number;
  stressed_var_95: number;
  baseline_mean_return: number;
  stressed_mean_return: number;
  worst_case_loss: number;
  pct_paths_total_loss: number;
};

export type FrontierData = {
  n_portfolios_simulated: number;
  tickers: string[];
  frontier_sample: Array<{ return: number; volatility: number; sharpe: number }>;
  optimal: {
    max_sharpe:   { weights: Record<string, number>; expected_return: number; volatility: number; sharpe_ratio: number };
    min_variance: { weights: Record<string, number>; expected_return: number; volatility: number; sharpe_ratio: number };
    max_return:   { weights: Record<string, number>; expected_return: number; volatility: number; sharpe_ratio: number };
  };
};

export type NewsArticle = {
  title: string;
  link: string;
  published: string;
  summary: string;
};

export type NewsData = {
  ticker: string;
  articles: NewsArticle[];
  sentiment: {
    positive_count: number;
    negative_count: number;
    sentiment: "bullish" | "bearish" | "neutral";
    positive_hits: string[];
    negative_hits: string[];
  };
};

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
  hist_vol: number | null;
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
  | { type: "section"; section: "portfolio";   data: PortfolioData }
  | { type: "section"; section: "stress_test"; data: StressTestData }
  | { type: "section"; section: "frontier";    data: FrontierData }
  | { type: "section"; section: "news";        data: NewsData }
  | { type: "token";   token: string }
  | { type: "status";  tool: string; label: string }
  | { type: "error";   message: string }
  | { type: "done" };

export type SectionType = "stock" | "monte_carlo" | "risk" | "options" | "verdict" | "caveats" | "prose" | "portfolio" | "stress_test" | "frontier" | "news";

export type ReportSection =
  | { kind: "stock";       data: StockData }
  | { kind: "monte_carlo"; data: MonteCarloData }
  | { kind: "risk";        data: RiskData }
  | { kind: "options";     data: OptionsData }
  | { kind: "verdict";     content: string; streaming: boolean }
  | { kind: "caveats" }
  | { kind: "prose";       content: string; streaming: boolean }
  | { kind: "portfolio";   data: PortfolioData }
  | { kind: "stress_test"; data: StressTestData }
  | { kind: "frontier";    data: FrontierData }
  | { kind: "news";        data: NewsData };
