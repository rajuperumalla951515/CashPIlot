import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "CashPilot | Your AI CFO for cash flow",
  description: "See what will happen to your company cash and what to do next.",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en" className="h-full antialiased">
      <body className="min-h-full flex flex-col">{children}</body>
    </html>
  );
}
