import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Unified Asset & Operations Brain | Industrial Knowledge Intelligence",
  description:
    "Turn scattered industrial documents into a single queryable AI knowledge layer. RAG-powered search across P&IDs, SOPs, maintenance logs, inspection reports, and safety regulations.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link
          href="https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700;800&family=JetBrains+Mono:wght@400;500&display=swap"
          rel="stylesheet"
        />
      </head>
      <body style={{ height: "100vh", overflow: "hidden" }}>{children}</body>
    </html>
  );
}
