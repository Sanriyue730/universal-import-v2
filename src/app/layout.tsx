import type { Metadata } from "next";
import "./globals.css";
import { Toaster } from "sonner";
import { Sidebar } from "@/components/ui/Sidebar";

export const metadata: Metadata = {
  title: "万能导入 V2 - 智能多格式批量下单系统",
  description: "通过AI辅助规则引擎实现任意格式文件智能解析与导入",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="zh-CN">
      <body className="antialiased">
        <div className="flex h-screen overflow-hidden">
          <Sidebar />
          <main className="flex-1 overflow-auto p-6">
            {children}
          </main>
        </div>
        <Toaster position="top-right" richColors />
      </body>
    </html>
  );
}
