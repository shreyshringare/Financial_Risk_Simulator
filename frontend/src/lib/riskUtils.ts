export type RiskLevel = "LOW" | "MODERATE" | "HIGH";

export function riskLevel(varValue: number): RiskLevel {
  if (varValue > -0.05) return "LOW";
  if (varValue > -0.10) return "MODERATE";
  return "HIGH";
}

// Muted text color class (defined in globals.css)
export function riskTextClass(level: RiskLevel): string {
  switch (level) {
    case "LOW":      return "risk-text-low";
    case "MODERATE": return "risk-text-moderate";
    case "HIGH":     return "risk-text-high";
  }
}

// CSS class for badge (defined in globals.css — muted research-note palette)
export function riskBadgeClass(level: RiskLevel): string {
  switch (level) {
    case "LOW":      return "badge-note-low";
    case "MODERATE": return "badge-note-moderate";
    case "HIGH":     return "badge-note-high";
  }
}

// CSS class for overall rating value (serif ink text, no glow)
export function riskOverallClass(level: RiskLevel): string {
  switch (level) {
    case "LOW":      return "overall-note-low";
    case "MODERATE": return "overall-note-moderate";
    case "HIGH":     return "overall-note-high";
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
