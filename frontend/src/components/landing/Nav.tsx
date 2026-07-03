"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

const GITHUB_URL = "https://github.com/shreyshringare/Financial_Risk_Simulator";

export default function Nav() {
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    const fn = () => setScrolled(window.scrollY > 8);
    window.addEventListener("scroll", fn, { passive: true });
    return () => window.removeEventListener("scroll", fn);
  }, []);

  return (
    <nav
      style={{
        position: "fixed",
        top: 0,
        left: 0,
        right: 0,
        zIndex: 50,
        background: scrolled ? "rgba(250,249,245,0.85)" : "transparent",
        backdropFilter: scrolled ? "blur(12px)" : "none",
        borderBottom: scrolled ? "1px solid var(--l-border)" : "1px solid transparent",
        transition: "background 200ms ease-out, border-color 200ms ease-out",
      }}
    >
      <div
        style={{
          maxWidth: 1200,
          margin: "0 auto",
          padding: "16px 24px",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
        }}
      >
        <span className="serif" style={{ fontSize: 20, fontWeight: 600, color: "var(--l-text)" }}>
          FinSim
        </span>

        <div className="nav-links" style={{ display: "flex", alignItems: "center", gap: 32 }}>
          <a href="#features" style={{ fontSize: 14, color: "var(--l-text-dim)", textDecoration: "none" }}>
            Features
          </a>
          <a href="#how" style={{ fontSize: 14, color: "var(--l-text-dim)", textDecoration: "none" }}>
            How it works
          </a>
          <a href="#tech" style={{ fontSize: 14, color: "var(--l-text-dim)", textDecoration: "none" }}>
            Tech
          </a>
        </div>

        <div style={{ display: "flex", alignItems: "center", gap: 20 }}>
          <a
            href={GITHUB_URL}
            target="_blank"
            rel="noreferrer"
            style={{ fontSize: 14, color: "var(--l-text-dim)", textDecoration: "none" }}
          >
            GitHub
          </a>
          <Link
            href="/app"
            style={{
              background: "#141413",
              color: "#faf9f5",
              borderRadius: 999,
              padding: "9px 18px",
              fontSize: 14,
              fontWeight: 500,
              textDecoration: "none",
              whiteSpace: "nowrap",
            }}
          >
            Launch the desk
          </Link>
        </div>
      </div>
    </nav>
  );
}
