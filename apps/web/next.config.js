/** @type {import('next').NextConfig} */
const nextConfig = {
  transpilePackages: ["@sharp-edge/shared", "@sharp-edge/ui"],
  images: {
    domains: ["pbs.twimg.com", "instagram.com", "cdn.tiktok.com"],
  },
  experimental: {
    serverComponentsExternalPackages: ["pg"],
  },
};

module.exports = nextConfig;
