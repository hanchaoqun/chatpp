/** @type {import('next').NextConfig} */

const nextConfig = {
  webpack(config) {
    config.module.rules.push({
      test: /\.(svg|node)$/,
      use: ["@svgr/webpack", "node-loader"],
    });

    return config;
  },
  output: "standalone",
};

module.exports = nextConfig;
