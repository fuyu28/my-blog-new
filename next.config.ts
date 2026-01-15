import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  /* config options here */
  pageExtensions: ["js", "jsx", "md", "ts", "tsx"],
  turbopack: {
    root: __dirname,
  },
};

export default nextConfig;
