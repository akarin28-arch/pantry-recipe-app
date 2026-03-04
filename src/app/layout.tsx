import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "うちの食材で何つくる？",
  description: "家にある食材でレシピを提案。買い物なしで作れる料理、ちょい足しで作れる料理を即座に発見。",
  viewport: "width=device-width, initial-scale=1, maximum-scale=1",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="ja">
      <body>{children}</body>
    </html>
  );
}
