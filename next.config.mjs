import withPWAInit from "@ducanh2912/next-pwa";

const withPWA = withPWAInit({
  dest: "public",
  disable: process.env.NODE_ENV === "development",
  register: true,
  skipWaiting: true,
});

/** @type {import('next').NextConfig} */
const nextConfig = {
  output: 'export',
  images: {
    unoptimized: true,
  },
  trailingSlash: true,
  // Add this Webpack config to silence the face-api warnings
  webpack: (config) => {
    config.resolve.fallback = { fs: false, encoding: false };
    return config;
  },
};

export default withPWA(nextConfig);