/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  experimental: {
    ssr: false // Disable SSR for WalletConnect pages
  },
  // ... other config
}

module.exports = nextConfig