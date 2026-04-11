import type { NextConfig } from "next";
import withPWA from "@ducanh2912/next-pwa";

const nextConfig: NextConfig = {
  devIndicators: false,
};

export default withPWA({
  dest: "public",
  register: true,
  skipWaiting: true,
  disable: true,
})(nextConfig);
