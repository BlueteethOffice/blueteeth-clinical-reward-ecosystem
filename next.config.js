/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  compress: true,
  compiler: {
    removeConsole: process.env.NODE_ENV === 'production',
  },
  images: {
    unoptimized: true,
  },
  allowedDevOrigins: ['172.16.3.136', '192.168.1.5', 'localhost:3000'],
};

export default nextConfig;
