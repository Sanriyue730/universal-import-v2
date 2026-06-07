import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // 解决 pdfjs-dist 在服务端的兼容性问题
  serverExternalPackages: ['pdfjs-dist'],
  // Next.js 16 使用 turbopack，添加空配置避免警告
  turbopack: {},
};

export default nextConfig;
