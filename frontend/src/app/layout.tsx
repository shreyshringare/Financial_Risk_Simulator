import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "FinSim — Quantitative Risk Terminal",
  description: "AI-powered financial risk analysis · Monte Carlo · VaR · CVaR",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className="h-full">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link
          href="https://fonts.googleapis.com/css2?family=VT323&family=IBM+Plex+Mono:wght@300;400;500;600&display=swap"
          rel="stylesheet"
        />
      </head>
      <body className="h-full bg-terminal-black text-text-amber">
        {children}
      </body>
    </html>
  );
}
