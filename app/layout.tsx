import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  metadataBase: new URL("https://foreman-mauve.vercel.app"),
  title: {
    default: "Foreman - Governed AI Agent Control Plane",
    template: "%s | Foreman",
  },
  description:
    "Foreman is a deployed reference implementation for governed AI agents: permissions, human approval gates, audit trails, evals, cost controls, and MCP access.",
  openGraph: {
    title: "Foreman - Governed AI Agent Control Plane",
    description:
      "A deployed reference implementation for governed AI agents: permissions, human approval gates, audit trails, evals, cost controls, and MCP access.",
    url: "/",
    siteName: "Foreman",
    type: "website",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col">{children}</body>
    </html>
  );
}
