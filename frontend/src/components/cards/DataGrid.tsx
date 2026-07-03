// frontend/src/components/cards/DataGrid.tsx

interface DataGridProps {
  /** Column header labels — rendered in muted mono uppercase. */
  headers: string[];
  /** Table rows. Each row must have the same length as headers. */
  rows: (string | number)[][];
  /** Optional row indices (0-based) to render in navy accent instead of default text color. */
  highlightRows?: number[];
}

export default function DataGrid({ headers, rows, highlightRows = [] }: DataGridProps) {
  const colCount = headers.length;
  const colWidth = `${Math.floor(100 / colCount)}%`;

  return (
    <div
      className="mono"
      style={{
        fontSize: 13,
        overflowX: "auto",
      }}
    >
      {/* Header row */}
      <div style={{
        display: "grid",
        gridTemplateColumns: `repeat(${colCount}, ${colWidth})`,
        borderBottom: "1px solid var(--l-border)",
        paddingBottom: 6,
        marginBottom: 6,
      }}>
        {headers.map((h) => (
          <span key={h} style={{
            color: "var(--l-text-dim)",
            fontSize: 11,
            letterSpacing: 1,
            textTransform: "uppercase" as const,
            textAlign: "right",
          }}>
            {h}
          </span>
        ))}
      </div>

      {/* Data rows */}
      {rows.map((row, ri) => {
        const highlighted = highlightRows.includes(ri);
        return (
          <div key={ri} style={{
            display: "grid",
            gridTemplateColumns: `repeat(${colCount}, ${colWidth})`,
            padding: "4px 0",
            borderBottom: "1px solid rgba(16,24,32,0.06)",
          }}>
            {row.map((cell, ci) => (
              <span key={ci} style={{
                color: highlighted ? "var(--l-accent)" : "var(--l-text)",
                fontSize: 13,
                textAlign: "right",
              }}>
                {typeof cell === "number" ? cell.toFixed(4) : cell}
              </span>
            ))}
          </div>
        );
      })}
    </div>
  );
}
