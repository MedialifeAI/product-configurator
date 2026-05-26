/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  // Large GLB assets — increase webpack cache + asset size limits
  webpack: (config) => {
    config.module.rules.push({
      test: /\.(glb|gltf|hdr|exr)$/,
      type: 'asset/resource',
    });
    return config;
  },
  // Allow longer cache for static binary assets
  async headers() {
    return [
      {
        source: '/models/:path*',
        headers: [{ key: 'Cache-Control', value: 'public, max-age=31536000, immutable' }],
      },
    ];
  },
};
export default nextConfig;
