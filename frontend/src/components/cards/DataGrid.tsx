// frontend/src/components/cards/DataGrid.tsx

interface DataGridProps {
  /** Column header labels — rendered uppercase in amber. */
  headers: string[];
  /** Table rows. Each row must have the same length as headers. */
  rows: (string | number)[][];
  /** Optional row indices (0-based) to render in amber instead of default text color. */
  highlightRows?: number[];
}

export default function DataGrid({ headers, rows, highlightRows = [] }: DataGridProps) {
  const colCount = headers.length;
  const colWidth = `${Math.floor(100 / colCount)}%`;

  return (
    <div style={{
      fontFamily: "var(--font-mono)",
      fontSize: 11,
      overflowX: "auto",
    }}>
      {/* Header row */}
      <div style={{
        display: "grid",
        gridTemplateColumns: `repeat(${colCount}, ${colWidth})`,
        borderBottom: "1px solid var(--border)",
        paddingBottom: 4,
        marginBottom: 4,
      }}>
        {headers.map((h) => (
          <span key={h} style={{
            color: "var(--amber)",
            fontSize: 9,
            letterSpacing: 1.5,
            textTransform: "uppercase" as const,
            fontWeight: 600,
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
            padding: "3px 0",
            borderBottom: "1px solid var(--border-dim)",
          }}>
            {row.map((cell, ci) => (
              <span key={ci} style={{
                color: highlighted ? "var(--amber-bright)" : "var(--text)",
                fontSize: 12,
                letterSpacing: 0.5,
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
