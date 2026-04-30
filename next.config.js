/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  images: {
    // Audius content nodes are operated by many providers across many
    // hostnames (audius.co, staked.cloud, tikilabs.com, figment.io, ...)
    // and rotate. Easiest correct policy: allow any HTTPS origin.
    remotePatterns: [{ protocol: "https", hostname: "**" }],
    unoptimized: true,
  },
  webpack: (config) => {
    config.externals.push("pino-pretty", "lokijs", "encoding");
    config.resolve.fallback = {
      ...config.resolve.fallback,
      fs: false,
    };
    return config;
  },
};

module.exports = nextConfig;
