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
  title: "Workflow | Local-First PR Management & AI Agent Hub",
  description: "Developer-centric PR management dashboard & CLI AI agent dispatcher. Streamline pull request reviews, evaluate gate rules, and launch AI terminal agents.",
  keywords: ["Git", "Pull Request", "PR Viewer", "Code Review", "AI Agent", "Codex", "Claude", "Worktree"],
  icons: {
    icon: [
      { url: "/icon.png", type: "image/png" },
      { url: "/icon.svg", type: "image/svg+xml" },
      { url: "/favicon.svg", type: "image/svg+xml" },
    ],
    shortcut: "/icon.png",
    apple: "/icon.png",
  },
  openGraph: {
    title: "Workflow | Local-First PR Management & AI Agent Hub",
    description: "Streamline PR reviews, evaluate logic gates, and dispatch AI coding agents into local Git worktrees.",
    siteName: "Workflow PR Viewer",
    type: "website",
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html
      lang="en"
      suppressHydrationWarning
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col" suppressHydrationWarning>{children}</body>
    </html>
  );
}
