import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "天气交易系统 v2",
  description: "三城天气预测、决策与实仓监控中文看板",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="zh-CN">
      <body>{children}</body>
    </html>
  );
}
