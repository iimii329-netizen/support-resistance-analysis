import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "XQ 短期支撐壓力 AI Inside",
  description: "研發展示 v4",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="zh-TW" className="h-full antialiased">
      <body className="min-h-full flex flex-col font-sans">{children}</body>
    </html>
  );
}
