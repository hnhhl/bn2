/** @type {import('next').NextConfig} */
const webpack = require('webpack');

const nextConfig = {
  reactStrictMode: true,
  // Configure for dynamic deployment
  output: 'server',
  env: {
    // Ensure any upstream env var does not enable sqlite code paths
    DATABASE_URL: '',
  },
  experimental: {
    turbo: false,
  },
  // Skip static generation for API routes during build
  generateBuildId: async () => {
    return 'build-' + Date.now();
  },
  webpack: (config, { isServer }) => {
    // Prevent bundler from trying to resolve native sqlite modules we do not use
    config.resolve = config.resolve || {};
    config.resolve.fallback = {
      ...(config.resolve?.fallback || {}),
      'better-sqlite3': false,
      'sqlite3': false,
    };

    // Replace sqlite modules with an empty shim at compile time
    config.plugins = config.plugins || [];
    config.plugins.push(
      new webpack.NormalModuleReplacementPlugin(
        /^(better-sqlite3|sqlite3)$/,
        require('path').resolve(__dirname, 'src/shims/empty.js')
      )
    );

    // On server build, mark these as externals to avoid resolving them
    if (isServer) {
      const externals = config.externals || [];
      config.externals = [
        ...externals,
        function ({ request }, callback) {
          if (request === 'better-sqlite3' || request === 'sqlite3') {
            return callback(null, 'commonjs ' + request);
          }
          callback();
        },
      ];
    }

    return config;
  },
};

module.exports = nextConfig;
