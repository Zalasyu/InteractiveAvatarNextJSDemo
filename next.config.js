/** @type {import('next').NextConfig} */
const nextConfig = {
  // Exclude pino and related packages from server-side bundling
  // This allows them to run in the Node.js environment with full access to native features
  // Fixes "Cannot find module .next/server/vendor-chunks/lib/worker.js" errors
  experimental: {
    serverComponentsExternalPackages: [
      'pino',
      'pino-pretty',
      'pino-std-serializers',
      'thread-stream',
      'pino-worker',
      'pino-file',
      'real-require',
    ],
  },
}

module.exports = nextConfig
