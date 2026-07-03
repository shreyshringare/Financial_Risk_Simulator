"use client";

import Link from "next/link";
import Reveal from "./Reveal";

export default function CTABanner() {
  return (
    <section style={{ padding: "112px 24px", textAlign: "center", background: "var(--l-surface-2)" }}>
      <Reveal>
        <h2
          className="serif"
          style={{ fontSize: 40, fontWeight: 600, color: "var(--l-text)", margin: "0 0 28px" }}
        >
          Run your first analysis in ten seconds
        </h2>
        <Link
          href="/app"
          style={{
            display: "inline-block",
            background: "#003a70",
            color: "#ffffff",
            borderRadius: 999,
            padding: "14px 30px",
            fontSize: 16,
            fontWeight: 500,
            textDecoration: "none",
          }}
        >
          Launch the desk →
        </Link>
      </Reveal>
    </section>
  );
}
