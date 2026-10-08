import type { Metadata } from "next";
import localFont from "next/font/local";
import "./globals.css";

const geistSans = localFont({
  src: "./fonts/GeistVF.woff",
  variable: "--font-geist-sans",
  weight: "100 900",
});

const geistMono = localFont({
  src: "./fonts/GeistMonoVF.woff",
  variable: "--font-geist-mono",
  weight: "100 900",
});

export const metadata: Metadata = {
  title: "PatternRAG Lab — Laya vs Advanced RAG Benchmark",
  description:
    "An experimental RAG evaluation platform comparing post-retrieval relevance strategies (Advanced Cross-Encoder Reranker vs Laya Relevance Filter) with modular software design patterns.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body
        className={`${geistSans.variable} ${geistMono.variable} min-h-screen bg-canvas text-text-primary antialiased selection:bg-accent-subtle selection:text-accent`}
      >
        {children}
      </body>
    </html>
  );
}
