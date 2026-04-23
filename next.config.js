/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,

  // Build fully-static HTML so the site can be hosted on DigitalOcean App
  // Platform's free Static Site tier. All Supabase queries happen at build
  // time (in `getMascots`) and bake results into the HTML; the submission
  // form talks to Supabase directly from the browser at runtime.
  output: 'export',

  // The next/image optimizer doesn't work with static exports.
  images: { unoptimized: true },

  // Trailing slashes make DO's static file routing happier.
  trailingSlash: true,
};

module.exports = nextConfig;
