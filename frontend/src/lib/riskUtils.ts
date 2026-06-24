export type RiskLevel = "LOW" | "MODERATE" | "HIGH";

export function riskLevel(varValue: number): RiskLevel {
  if (varValue > -0.05) return "LOW";
  if (varValue > -0.10) return "MODERATE";
  return "HIGH";
}

// Phosphor glow text color class (defined in globals.css / tailwind)
export function riskTextClass(level: RiskLevel): string {
  switch (level) {
    case "LOW":      return "text-phosphor-green";
    case "MODERATE": return "text-phosphor-yellow";
    case "HIGH":     return "text-phosphor-red";
  }
}

// CSS class for badge (defined in globals.css — includes text-shadow glow)
export function riskBadgeClass(level: RiskLevel): string {
  switch (level) {
    case "LOW":      return "badge-low";
    case "MODERATE": return "badge-moderate";
    case "HIGH":     return "badge-high";
  }
}

// CSS class for overall rating value (large display text + glow)
export function riskOverallClass(level: RiskLevel): string {
  switch (level) {
    case "LOW":      return "overall-low";
    case "MODERATE": return "overall-moderate";
    case "HIGH":     return "overall-high";
  }
}

export function overallRisk(varValue: number, sharpe: number, maxDrawdown: number): RiskLevel {
  const levels = [riskLevel(varValue), riskLevel(maxDrawdown)];
  if (levels.includes("HIGH")) return "HIGH";
  if (levels.includes("MODERATE") || sharpe < 0.5) return "MODERATE";
  return "LOW";
}

export function formatPct(value: number): string {
  return `${(value * 100).toFixed(2)}%`;
}

export function formatPrice(value: number): string {
  return `$${value.toFixed(2)}`;
}
