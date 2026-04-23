/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  images: {
    remotePatterns: [
      { protocol: 'https', hostname: 'locations.traderjoes.com' },
    ],
  },
};

module.exports = nextConfig;
