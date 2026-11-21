import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  experimental: { serverActions: { bodySizeLimit: "50mb" } },
  serverExternalPackages: ["@prisma/client"],
};

export default nextConfig;
